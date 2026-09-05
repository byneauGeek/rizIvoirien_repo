const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authenticate, requireRole } = require('../middleware/auth')
const { assignOrder } = require('../services/assignmentEngine')
const { notify } = require('../services/notifications')
const { sendMail } = require('../services/mailer')
const { parseWeightKg, geocodeAddress, calcDeliveryFee, estimateDelivery } = require('../services/deliveryService')
const { randomUUID } = require('crypto')
const stockEngine = require('../services/stockEngine')

const fmt = (n) => Number(n).toLocaleString('fr-FR')

// LOT 3 (Logistique, arbitrage Décision 3) : le livreur ne passe plus par
// cette route générique — PRET→IN_TRANSIT→DELIVERED est désormais géré par
// deliveryLifecycle.advanceShipment (PUT /api/drivers/delivery/:orderId/status),
// seul point d'entrée, qui tient aussi le Shipment à jour. L'ancienne entrée
// DRIVER ici était déjà inatteignable par l'UI et divergente (pas de reset
// mensuel des gains) — supprimée plutôt que corrigée deux fois.
const ORDER_STATUS_FLOW = {
  BUYER:  [],
  SELLER: { CONFIRMED: 'EN_PREPARATION', EN_PREPARATION: 'PRET' },
  ADMIN:  null, // tous les transitions
}

// POST /api/orders/estimate-delivery — calcul frais avant commande (public authentifié)
router.post('/estimate-delivery', authenticate, async (req, res) => {
  const { items, address } = req.body
  if (!items?.length) return res.status(400).json({ error: 'Articles requis' })

  try {
    const productIds = items.map(i => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      include: { shop: { select: { id: true, name: true, latitude: true, longitude: true, location: true } } },
    })

    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })

    // Grouper par boutique pour compter les collectes additionnelles
    const shopMap = {}
    for (const p of products) {
      if (!shopMap[p.shopId]) shopMap[p.shopId] = p.shop
    }
    const uniqueShops = Object.values(shopMap)
    const additionalShops = Math.max(0, uniqueShops.length - 1)

    // Distance calculée depuis la première boutique
    const shop = uniqueShops[0]
    let shopCoords = null
    if (shop?.latitude && shop?.longitude) {
      shopCoords = { lat: shop.latitude, lng: shop.longitude }
    } else if (shop?.location) {
      shopCoords = await geocodeAddress(shop.location)
    }

    const result = await estimateDelivery({ items, products, shopCoords, deliveryAddress: address, settings, additionalShops })
    res.json({
      ...result,
      leadDays: settings?.deliveryLeadDays ?? 1,
      shops: uniqueShops.map(s => ({ id: s.id, name: s.name })),
      additionalShops,
      additionalPickupFee: settings?.additionalPickupFee ?? 500,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/orders — acheteur passe commande (mono ou multi-boutiques)
router.post('/', authenticate, requireRole('BUYER'), async (req, res) => {
  const { items, address, note, promoCode: promoCodeInput, idempotencyKey, deliveryFee: providedFee } = req.body
  if (!items?.length || !address) return res.status(400).json({ error: 'Panier et adresse requis' })

  // Anti double-soumission : si même clé d'idempotence, retourner la commande existante
  if (idempotencyKey) {
    const existing = await prisma.order.findFirst({
      where: { buyerId: req.user.id, idempotencyKey },
    })
    if (existing) return res.status(200).json({ ...existing, duplicate: true })
  }

  try {
    const productIds = items.map(i => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      include: { shop: { select: { id: true, name: true, latitude: true, longitude: true, location: true, userId: true, notifyEmail: true } } },
    })
    if (products.length !== productIds.length) return res.status(400).json({ error: 'Produit(s) invalide(s)' })

    // Vérifier le stock
    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Stock insuffisant pour ${product.name}` })
      }
    }

    // Grouper les articles par boutique
    const shopGroups = {}
    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      if (!shopGroups[product.shopId]) shopGroups[product.shopId] = { shop: product.shop, items: [], products: [] }
      shopGroups[product.shopId].items.push(item)
      shopGroups[product.shopId].products.push(product)
    }
    const groups = Object.values(shopGroups)
    const additionalShops = Math.max(0, groups.length - 1)

    const subtotal = items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId)
      return sum + product.price * item.quantity
    }, 0)

    // Valider le code promo
    let discount = 0, appliedPromoCode = null, promoRecord = null
    if (promoCodeInput) {
      promoRecord = await prisma.promoCode.findUnique({ where: { code: promoCodeInput.toUpperCase() } })
      if (!promoRecord || !promoRecord.active) return res.status(400).json({ error: 'Code promo invalide ou inactif' })
      if (promoRecord.expiresAt && promoRecord.expiresAt < new Date()) return res.status(400).json({ error: 'Code promo expiré' })
      if (promoRecord.usedCount >= promoRecord.maxUses) return res.status(400).json({ error: 'Ce code promo a atteint son nombre maximum d\'utilisations' })
      if (subtotal < promoRecord.minOrder) return res.status(400).json({ error: `Commande minimum de ${promoRecord.minOrder.toLocaleString('fr-FR')} FCFA requise pour ce code` })
      discount = promoRecord.type === 'PERCENT'
        ? Math.round(subtotal * promoRecord.value / 100)
        : Math.min(promoRecord.value, subtotal)
      appliedPromoCode = promoRecord.code
    }

    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    const autoValidate = settings?.autoValidateOrders ?? true
    const additionalPickupFee = settings?.additionalPickupFee ?? 500

    // Calcul des frais par boutique :
    // - Boutique 1 : frais complets (base + poids + distance + N collectes additionnelles)
    // - Boutiques 2+ : frais de collecte additionnelle uniquement
    // Si le frontend envoie la fee pré-calculée (issue de l'estimation affichée), on l'utilise
    // directement pour éviter les divergences dues à un second appel géocoding (API Nominatim
    // non-déterministe) et aux différences de pondération multi-boutiques.
    const shopFees = []
    if (typeof providedFee === 'number' && providedFee >= 0) {
      const shop1Fee = Math.max(0, Math.round(providedFee - additionalShops * additionalPickupFee))
      shopFees.push(shop1Fee)
      for (let i = 1; i < groups.length; i++) shopFees.push(Math.round(additionalPickupFee))
    } else {
      for (let i = 0; i < groups.length; i++) {
        if (i === 0) {
          const geo = groups[0].shop
          let shopCoords = null
          if (geo?.latitude && geo?.longitude) shopCoords = { lat: geo.latitude, lng: geo.longitude }
          else if (geo?.location) shopCoords = await geocodeAddress(geo.location)
          const est = await estimateDelivery({ items: groups[0].items, products: groups[0].products, shopCoords, deliveryAddress: address, settings, additionalShops })
          shopFees.push(est.deliveryFee)
        } else {
          shopFees.push(Math.round(additionalPickupFee))
        }
      }
    }

    // UUID partagé pour lier les commandes d'un même panier multi-boutiques
    const groupId = groups.length > 1 ? randomUUID() : null

    // Créer toutes les commandes ET décrémenter le stock dans la même transaction (atomique).
    // Le décrément passe par le Stock Engine (LOT 3) — chaque vente est ainsi
    // tracée dans StockMovement avec sourceType=ORDER/sourceId=order.id, alors
    // que l'ancien code décrémentait sans lien vers la commande d'origine.
    const { createdOrders, stockUpdates } = await prisma.$transaction(async (tx) => {
      const orders = []
      const updates = []
      for (let i = 0; i < groups.length; i++) {
        const { shop, items: gItems } = groups[i]
        const groupSubtotal = gItems.reduce((sum, item) => {
          const product = products.find(p => p.id === item.productId)
          return sum + product.price * item.quantity
        }, 0)
        const groupDiscount = i === 0 ? discount : 0
        const order = await tx.order.create({
          data: {
            buyerId: req.user.id,
            shopId: shop.id,
            address,
            note: note || null,
            total: Math.max(0, groupSubtotal - groupDiscount),
            deliveryFee: shopFees[i],
            discount: groupDiscount,
            promoCode: i === 0 ? appliedPromoCode : null,
            groupId,
            idempotencyKey: i === 0 && idempotencyKey ? idempotencyKey : null,
            status: autoValidate ? 'CONFIRMED' : 'PENDING_VALIDATION',
            items: {
              create: gItems.map(item => {
                const product = products.find(p => p.id === item.productId)
                return { productId: item.productId, quantity: item.quantity, price: product.price, name: product.name }
              }),
            },
            statusHistory: {
              create: autoValidate
                ? [
                    { status: 'PENDING',   note: 'Commande passée',                    actorId: req.user.id },
                    { status: 'CONFIRMED', note: 'Commande confirmée automatiquement' },
                  ]
                : [
                    { status: 'PENDING_VALIDATION', note: 'En attente de validation par le commercial', actorId: req.user.id },
                  ],
            },
          },
          include: { items: true, statusHistory: true },
        })
        orders.push(order)

        // Décrémentation atomique du stock, par article de CETTE commande —
        // si un produit passe sous 0, InsufficientStockError → rollback auto.
        for (const item of gItems) {
          const product = products.find(p => p.id === item.productId)
          const { position } = await stockEngine.recordSale(tx, {
            productId: item.productId, quantity: item.quantity, orderId: order.id, actorId: req.user.id,
          })
          updates.push({ stock: position.quantity, name: product.name, shopId: product.shopId })
        }
      }
      return { createdOrders: orders, stockUpdates: updates }
    })

    // Incrémenter le code promo
    if (promoRecord) {
      await prisma.promoCode.update({ where: { id: promoRecord.id }, data: { usedCount: { increment: 1 } } })
    }

    // Alertes stock faible (hors transaction, non-bloquant)
    for (const updated of stockUpdates) {
      if (updated.stock <= 5) {
        const shopOwner = await prisma.shop.findUnique({ where: { id: updated.shopId }, select: { userId: true } })
        if (shopOwner) setImmediate(() => notify(shopOwner.userId, 'LOW_STOCK', 'Stock faible !',
          `${updated.name} n'a plus que ${updated.stock} sac${updated.stock > 1 ? 's' : ''} en stock.`,
          { productName: updated.name, stock: updated.stock }
        ))
      }
    }

    const buyer = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, email: true } })
    const totalDeliveryFee = shopFees.reduce((s, f) => s + f, 0)
    const firstOrder = createdOrders[0]
    const shopLabel = groups.length > 1 ? `${groups.length} boutiques` : groups[0].shop.name

    if (autoValidate) {
      // Notifier chaque vendeur immédiatement
      for (let i = 0; i < groups.length; i++) {
        const order = createdOrders[i]
        const { shop } = groups[i]
        const seller = await prisma.user.findUnique({ where: { id: shop.userId }, select: { email: true } })
        setImmediate(() => {
          notify(shop.userId, 'NEW_ORDER', 'Nouvelle commande !', `Commande #${order.id} — ${fmt(order.total)} FCFA`, { orderId: order.id })
          if (shop.notifyEmail) sendMail(seller?.email, 'newOrder', { shopName: shop.name, orderId: order.id, buyerName: buyer?.name || 'Un client', items: order.items, total: order.total })
        })
      }
      // Email de confirmation acheteur
      setImmediate(() => sendMail(buyer?.email, 'orderConfirmed', {
        name: buyer?.name || '',
        orderId: firstOrder.id,
        items: createdOrders.flatMap(o => o.items),
        total: Math.max(0, subtotal - discount),
        deliveryFee: totalDeliveryFee,
        discount,
        address,
        shopName: shopLabel,
      }))
    } else {
      // Validation manuelle : notifier uniquement l'acheteur que sa commande est reçue
      setImmediate(() => notify(req.user.id, 'ORDER_PENDING_VALIDATION', 'Commande reçue',
        'Notre équipe commerciale vous contactera sous peu pour confirmer votre commande.',
        { orderId: firstOrder.id }
      ))
    }

    // Réponse : commande unique ou résumé multi-boutiques
    if (groups.length === 1) {
      res.status(201).json(createdOrders[0])
    } else {
      res.status(201).json({
        multiShop: true,
        orders: createdOrders,
        totalDeliveryFee,
        firstOrderId: firstOrder.id,
      })
    }
  } catch (e) {
    if (e instanceof stockEngine.InsufficientStockError) {
      return res.status(400).json({ error: 'Stock insuffisant (concurrent). Veuillez actualiser votre panier.' })
    }
    res.status(500).json({ error: e.message })
  }
})

// GET /api/orders/my — acheteur: ses commandes
router.get('/my', authenticate, requireRole('BUYER'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { buyerId: req.user.id },
      include: {
        items: { include: { product: { select: { name: true, images: true, slug: true } } } },
        shop: { select: { name: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        driver: { include: { user: { select: { name: true, phone: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(orders)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/orders/shop/list — vendeur: commandes de sa boutique
// ⚠ Doit être AVANT /:id sinon Express capte "shop" comme id
router.get('/shop/list', authenticate, requireRole('SELLER'), async (req, res) => {
  const { status, limit = '30', offset = '0' } = req.query
  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id } })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })

    const where = { shopId: shop.id }
    if (status) where.status = status

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          buyer: { select: { name: true, phone: true } },
          items: { include: { product: { select: { name: true } } } },
          statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.order.count({ where }),
    ])
    res.json({ orders, total })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/orders/driver/assigned — livreur: ses commandes actives
// ⚠ Doit être AVANT /:id sinon Express capte "driver" comme id
router.get('/driver/assigned', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } })
    if (!driver) return res.status(404).json({ error: 'Profil livreur introuvable' })

    const orders = await prisma.order.findMany({
      where: { driverId: driver.id, status: { in: ['IN_TRANSIT', 'PRET'] } },
      include: {
        buyer: { select: { name: true, phone: true } },
        shop: { select: { name: true, location: true } },
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(orders)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/orders/:id — auth, accès contrôlé
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        items: { include: { product: true } },
        buyer: { select: { name: true, email: true, phone: true } },
        shop: { select: { name: true, location: true } },
        driver: { include: { user: { select: { name: true, phone: true } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        driverOffer: true,
      },
    })
    if (!order) return res.status(404).json({ error: 'Commande introuvable' })

    // Vérifier accès
    const { id, role } = req.user
    const shop = await prisma.shop.findUnique({ where: { userId: id } }).catch(() => null)
    const driver = await prisma.driver.findUnique({ where: { userId: id } }).catch(() => null)

    const canAccess =
      role === 'ADMIN' ||
      order.buyerId === id ||
      (role === 'SELLER' && shop?.id === order.shopId) ||
      (role === 'DRIVER' && driver?.id === order.driverId)

    if (!canAccess) return res.status(403).json({ error: 'Accès refusé' })

    res.json(order)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})


// Statuts valides d'une commande (frontend/src/utils/status.js) — LOT 4 :
// avant ce lot, un ADMIN pouvait poser n'importe quelle valeur ici sans
// validation, et passer par 'CANCELLED' via cette route ne restockait
// jamais rien (gap identifié par l'audit du Stock Engine, LOT 0 §0.4).
// 'DELIVERED' retiré de cette liste au LOT 3 (Logistique) : cette transition
// passe désormais exclusivement par deliveryLifecycle.advanceShipment, pour
// que Shipment et Order.status ne puissent jamais diverger.
const VALID_ORDER_STATUSES = ['PENDING_VALIDATION', 'PENDING', 'CONFIRMED', 'EN_PREPARATION', 'PRET', 'IN_TRANSIT', 'CANCELLED', 'ESCALATED']

// PUT /api/orders/:id/status — vendeur avance le statut, admin annule
router.put('/:id/status', authenticate, async (req, res) => {
  const { note } = req.body
  try {
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include: { items: true } })
    if (!order) return res.status(404).json({ error: 'Commande introuvable' })

    const { role, id: userId } = req.user
    let nextStatus

    if (role === 'SELLER') {
      const shop = await prisma.shop.findUnique({ where: { userId } })
      if (shop?.id !== order.shopId) return res.status(403).json({ error: 'Accès refusé' })
      nextStatus = ORDER_STATUS_FLOW.SELLER[order.status]
    } else if (role === 'ADMIN') {
      nextStatus = req.body.status
      if (!VALID_ORDER_STATUSES.includes(nextStatus)) {
        return res.status(400).json({ error: `status ∈ ${VALID_ORDER_STATUSES.join('|')}` })
      }
      if (nextStatus === 'CANCELLED' && ['CANCELLED', 'DELIVERED'].includes(order.status)) {
        return res.status(400).json({ error: `Impossible d'annuler une commande ${order.status === 'DELIVERED' ? 'déjà livrée (passer par un litige)' : 'déjà annulée'}` })
      }
    }

    if (!nextStatus) return res.status(400).json({ error: `Transition impossible depuis ${order.status}` })

    // Annulation par l'admin (seul acteur pouvant l'atteindre via cette
    // route générique) : statut + restockage dans la même transaction,
    // via le même Stock Engine que les autres chemins d'annulation.
    const updated = nextStatus === 'CANCELLED'
      ? await prisma.$transaction(async (tx) => {
          const o = await tx.order.update({
            where: { id: order.id },
            data: { status: nextStatus, statusHistory: { create: { status: nextStatus, note: note || null, actorId: userId } } },
            include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
          })
          for (const item of order.items) {
            await stockEngine.restockFromCancellation(tx, {
              productId: item.productId, quantity: item.quantity, orderId: order.id, actorId: userId, reason: note || 'Annulée par un administrateur',
            })
          }
          return o
        })
      : await prisma.order.update({
          where: { id: order.id },
          data: {
            status: nextStatus,
            statusHistory: {
              create: { status: nextStatus, note: note || null, actorId: userId },
            },
          },
          include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
        })

    // Déclencher l'assignation automatique quand la commande est prête
    if (nextStatus === 'PRET') {
      setImmediate(() => assignOrder(order.id))
    }

    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/orders/:id — acheteur annule une commande PENDING
router.delete('/:id', authenticate, requireRole('BUYER'), async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true },
    })
    if (!order) return res.status(404).json({ error: 'Commande introuvable' })
    if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Accès refusé' })
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      return res.status(400).json({ error: 'Cette commande ne peut plus être annulée' })
    }

    // Statut + restockage dans la même transaction (LOT 4 : ce chemin
    // n'était pas atomique avant — un crash entre les deux pouvait laisser
    // une commande CANCELLED avec un restockage partiel).
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          statusHistory: { create: { status: 'CANCELLED', note: 'Annulée par l\'acheteur', actorId: req.user.id } },
        },
      })
      for (const item of order.items) {
        await stockEngine.restockFromCancellation(tx, {
          productId: item.productId, quantity: item.quantity, orderId: order.id, actorId: req.user.id, reason: 'Annulée par l\'acheteur',
        })
      }
    })

    // Notifier le vendeur + email acheteur
    const shop = await prisma.shop.findUnique({ where: { id: order.shopId }, select: { userId: true } })
    const cancelBuyer = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, email: true } })
    if (shop) {
      setImmediate(() => notify(shop.userId, 'ORDER_CANCELLED', 'Commande annulée',
        `La commande #${order.id} a été annulée par l\'acheteur.`, { orderId: order.id }))
    }
    setImmediate(() => sendMail(cancelBuyer?.email, 'orderCancelled', { name: cancelBuyer?.name || '', orderId: order.id }))

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/orders/:id/rate-driver — acheteur note le livreur après livraison
router.post('/:id/rate-driver', authenticate, requireRole('BUYER'), async (req, res) => {
  const { rating } = req.body
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Note entre 1 et 5 requise' })

  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, buyerId: true, driverId: true, status: true },
    })
    if (!order) return res.status(404).json({ error: 'Commande introuvable' })
    if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Accès refusé' })
    if (order.status !== 'DELIVERED') return res.status(400).json({ error: 'Commande non livrée' })
    if (!order.driverId) return res.status(400).json({ error: 'Aucun livreur assigné' })

    const driver = await prisma.driver.findUnique({ where: { id: order.driverId } })
    const newRating = Math.round(((driver.rating * driver.totalDeliveries + Number(rating)) / (driver.totalDeliveries + 1)) * 10) / 10

    await prisma.driver.update({
      where: { id: order.driverId },
      data: { rating: Math.min(5, Math.max(1, newRating)) },
    })

    // Marquer la commande comme notée
    await prisma.order.update({ where: { id: order.id }, data: { driverRated: true } })

    res.json({ success: true, newRating })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})


// ── GET /api/orders/:id/track — position GPS du livreur (acheteur) ────────────
// LOT 1 (Logistique) : lit désormais DriverCurrentLocation (persistée en base,
// survit à un redémarrage serveur) au lieu du Map en mémoire de sse.js.
// Une position vieille de plus de 10 min est traitée comme absente — même
// seuil que l'ancienne purge automatique de sse.js, appliqué ici à la lecture
// plutôt que par un job de nettoyage périodique.
const GPS_STALE_MS = 10 * 60 * 1000

router.get('/:id/track', authenticate, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, buyerId: true, driverId: true, status: true },
    })
    if (!order) return res.status(404).json({ error: 'Commande introuvable' })
    if (order.buyerId !== req.user.id && req.user.role !== 'ADMIN')
      return res.status(403).json({ error: 'Accès refusé' })

    if (order.status !== 'IN_TRANSIT' || !order.driverId)
      return res.json({ tracking: null, status: order.status })

    const location = await prisma.driverCurrentLocation.findFirst({
      where: { driverId: order.driverId, orderId: order.id },
    })
    const fresh = location && (Date.now() - new Date(location.updatedAt).getTime()) < GPS_STALE_MS
    const tracking = fresh ? { lat: location.lat, lng: location.lng, accuracy: location.accuracy, orderId: order.id, ts: new Date(location.updatedAt).getTime() } : null

    res.json({ tracking, status: order.status })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
