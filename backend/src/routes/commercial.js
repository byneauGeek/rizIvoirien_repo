const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate, requireRole } = require('../middleware/auth')
const { logAction } = require('../services/adminLog')
const { notify } = require('../services/notifications')
const stockEngine = require('../services/stockEngine')

const guard = [authenticate, requireRole('ADMIN', 'COMMERCIAL')]
const { sendMail } = require('../services/mailer')
const fmt = (n) => Number(n).toLocaleString('fr-FR')

// ─── KPIs ──────────────────────────────────────────────────────────────────

router.get('/kpis', ...guard, async (req, res) => {
  try {
    const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    const [pendingApplications, pendingContracts, pendingUpgrades, expiringSubs, pendingValidation] = await Promise.all([
      prisma.shop.count({ where: { status: 'PENDING' } }),
      prisma.contract.count({ where: { status: 'PENDING_SIGNATURE' } }),
      prisma.planUpgradeRequest.count({ where: { status: 'PENDING' } }),
      prisma.subscription.count({
        where: { status: 'ACTIVE', endDate: { lte: thirtyDaysOut, gte: new Date() } },
      }),
      prisma.order.count({ where: { status: 'PENDING_VALIDATION' } }),
    ])
    res.json({ pendingApplications, pendingContracts, pendingUpgrades, expiringSubs, pendingValidation })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Commandes — file de validation ────────────────────────────────────────
// ⚠️ Déclaré AVANT /orders pour éviter que Express matche "pending-validation" comme :id

router.get('/orders/pending-validation', ...guard, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: 'PENDING_VALIDATION' },
      include: {
        buyer: { select: { id: true, name: true, phone: true, email: true } },
        shop:  { select: { id: true, name: true, userId: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ orders })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Commandes — liste complète ────────────────────────────────────────────

router.get('/orders', ...guard, async (req, res) => {
  const { status, limit = 20, offset = 0 } = req.query
  try {
    const where = {}
    if (status && status !== 'ALL') where.status = status
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          buyer:  { select: { id: true, name: true, phone: true, email: true } },
          shop:   { select: { id: true, name: true } },
          driver: { select: { user: { select: { name: true } } } },
          items:  { include: { product: { select: { name: true } } } },
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        take:    Number(limit),
        skip:    Number(offset),
      }),
      prisma.order.count({ where }),
    ])
    res.json({ orders, total })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Valider une commande PENDING_VALIDATION ───────────────────────────────

router.post('/orders/:id/validate', ...guard, async (req, res) => {
  const orderId = Number(req.params.id)
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        shop:  { select: { id: true, name: true, userId: true, notifyEmail: true } },
        items: true,
      },
    })
    if (!order) return res.status(404).json({ error: 'Commande introuvable' })
    if (order.status !== 'PENDING_VALIDATION')
      return res.status(400).json({ error: `Impossible de valider une commande en statut ${order.status}` })

    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } }),
      prisma.orderStatusHistory.create({
        data: { orderId, status: 'CONFIRMED', note: 'Validée par le commercial après appel client', actorId: req.user.id },
      }),
    ])

    // Notifier le vendeur
    const seller = await prisma.user.findUnique({ where: { id: order.shop.userId }, select: { email: true } })
    setImmediate(() => {
      notify(order.shop.userId, 'NEW_ORDER', 'Nouvelle commande !',
        `Commande #${orderId} — ${fmt(order.total)} FCFA`, { orderId })
      if (order.shop.notifyEmail) {
        sendMail(seller?.email, 'newOrder', {
          shopName: order.shop.name, orderId,
          buyerName: order.buyer?.name || 'Un client', items: order.items, total: order.total,
        })
      }
      // Notifier l'acheteur
      notify(order.buyer.id, 'ORDER_VALIDATED', 'Commande confirmée !',
        'Votre commande a été validée et transmise à la boutique.', { orderId })
    })
    setImmediate(() => logAction(req.user.id, 'ORDER_VALIDATE', 'ORDER', orderId, { shopId: order.shopId }))

    res.json({ ok: true })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Annuler une commande PENDING_VALIDATION ───────────────────────────────

router.post('/orders/:id/cancel', ...guard, async (req, res) => {
  const orderId = Number(req.params.id)
  const { reason } = req.body
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, name: true } },
        items: true,
      },
    })
    if (!order) return res.status(404).json({ error: 'Commande introuvable' })
    if (order.status !== 'PENDING_VALIDATION')
      return res.status(400).json({ error: `Impossible d'annuler une commande en statut ${order.status}` })

    // Interactive transaction (plutôt que le tableau précédent) — nécessaire
    // pour composer stockEngine.restockFromCancellation dans la même
    // transaction (LOT 4 : même Stock Engine que les autres chemins d'annulation).
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } })
      await tx.orderStatusHistory.create({
        data: {
          orderId, status: 'CANCELLED',
          note: reason?.trim() ? `Annulée par le commercial : ${reason.trim()}` : 'Annulée par le commercial',
          actorId: req.user.id,
        },
      })
      for (const item of order.items) {
        await stockEngine.restockFromCancellation(tx, {
          productId: item.productId, quantity: item.quantity, orderId, actorId: req.user.id,
          reason: reason?.trim() || 'Annulée par le commercial',
        })
      }
    })

    setImmediate(() => notify(order.buyer.id, 'ORDER_CANCELLED', 'Commande annulée',
      reason?.trim() || 'Votre commande a été annulée par notre équipe commerciale.', { orderId }
    ))
    setImmediate(() => logAction(req.user.id, 'ORDER_CANCEL', 'ORDER', orderId, { reason }))

    res.json({ ok: true })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Pipeline boutiques ────────────────────────────────────────────────────

router.get('/pipeline', ...guard, async (req, res) => {
  try {
    const { status } = req.query
    const where = {}
    if (status && status !== 'ALL') where.status = status

    const shops = await prisma.shop.findMany({
      where,
      include: {
        user:         { select: { id: true, name: true, email: true, phone: true } },
        contract:     { select: { id: true, status: true, signedAt: true } },
        subscription: { select: { id: true, plan: true, status: true, endDate: true } },
        _count:       { select: { products: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Bulk revenue aggregation (anti N+1)
    const shopIds = shops.map(s => s.id)
    const revenues = shopIds.length > 0
      ? await prisma.order.groupBy({
          by: ['shopId'],
          where: { shopId: { in: shopIds }, status: 'DELIVERED' },
          _sum: { total: true },
          _count: { id: true },
        })
      : []
    const revenueMap = new Map(revenues.map(r => [r.shopId, r]))

    const result = shops.map(s => {
      const rev = revenueMap.get(s.id)
      return {
        ...s,
        metrics: {
          totalOrders: rev?._count?.id ?? 0,
          totalRevenue: rev?._sum?.total ?? 0,
          productCount: s._count?.products ?? 0,
        },
      }
    })

    res.json({ shops: result })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Pipeline livreurs ─────────────────────────────────────────────────────

router.get('/driver-pipeline', ...guard, async (req, res) => {
  try {
    const { status } = req.query
    const where = {}
    if (status && status !== 'ALL') where.status = status

    const [drivers, settings] = await Promise.all([
      prisma.driver.findMany({
        where,
        include: {
          user:     { select: { id: true, name: true, email: true, phone: true } },
          contract: { select: { id: true, status: true, signedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.platformSettings.findUnique({ where: { id: 1 } }),
    ])

    const result = drivers.map(d => ({
      ...d,
      commissionRate: d.plan === 'PREMIUM'
        ? (settings?.premiumDriverCommission ?? 0.20)
        : (settings?.driverCommission ?? 0.15),
    }))

    res.json({ drivers: result })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Renouvellements ───────────────────────────────────────────────────────

router.get('/renewals', ...guard, async (req, res) => {
  try {
    const now = new Date()
    const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    const subs = await prisma.subscription.findMany({
      where: { status: 'ACTIVE', endDate: { lte: thirtyDaysOut, gte: now } },
      include: {
        shop: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { endDate: 'asc' },
    })
    const result = subs.map(s => ({
      ...s,
      daysRemaining: Math.ceil((new Date(s.endDate) - now) / (1000 * 60 * 60 * 24)),
    }))
    res.json({ renewals: result })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Rappel renouvellement abonnement ──────────────────────────────────────
// Même motif que remind-contract ci-dessous : GET /renewals affichait déjà
// les abonnements arrivant à échéance sous 30 jours, mais aucune action de
// relance n'existait depuis cet écran — contrairement au contrat, qui a la
// sienne (remind-contract). Un abonnement qui expire sans relance retombe
// silencieusement au plan BASIC à l'échéance.

router.post('/subscriptions/:id/remind-renewal', ...guard, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: Number(req.params.id) },
      include: { shop: { select: { id: true, name: true, userId: true } } },
    })
    if (!subscription) return res.status(404).json({ error: 'Abonnement introuvable' })

    const daysRemaining = Math.ceil((new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24))

    await notify(
      subscription.shop.userId,
      'SUBSCRIPTION_RENEWAL_REMINDER',
      'Votre abonnement arrive à échéance',
      daysRemaining > 0
        ? `Votre abonnement ${subscription.plan} expire dans ${daysRemaining} jour(s). Renouvelez-le pour conserver vos avantages.`
        : `Votre abonnement ${subscription.plan} a expiré. Renouvelez-le pour conserver vos avantages.`,
      { subscriptionId: subscription.id }
    )
    setImmediate(() =>
      logAction(req.user.id, 'SUBSCRIPTION_RENEWAL_REMINDER', 'SHOP', subscription.shop.id, { shopName: subscription.shop.name, daysRemaining })
    )
    res.json({ ok: true })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Détail boutique (vue agent commercial) ───────────────────────────────

router.get('/shops/:id', ...guard, async (req, res) => {
  const shopId = Number(req.params.id)
  try {
    const now = new Date()
    const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [shop, recentOrders, thisMonthAgg, lastMonthAgg, totalAgg] = await Promise.all([
      prisma.shop.findUnique({
        where: { id: shopId },
        include: {
          user:         { select: { id: true, name: true, email: true, phone: true } },
          contract:     { select: { id: true, status: true, signedAt: true, generatedAt: true } },
          subscription: true,
          _count:       { select: { products: true } },
        },
      }),
      prisma.order.findMany({
        where: { shopId },
        include: { buyer: { select: { name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.order.aggregate({
        where: { shopId, status: 'DELIVERED', createdAt: { gte: startOfMonth } },
        _sum: { total: true }, _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { shopId, status: 'DELIVERED', createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
        _sum: { total: true }, _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { shopId, status: 'DELIVERED' },
        _sum: { total: true }, _count: { id: true },
      }),
    ])

    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })

    const daysRemaining = shop.subscription?.endDate
      ? Math.ceil((new Date(shop.subscription.endDate) - now) / (1000 * 60 * 60 * 24))
      : null

    res.json({
      ...shop,
      daysRemaining,
      recentOrders,
      stats: {
        thisMonth: { revenue: thisMonthAgg._sum.total ?? 0, orders: thisMonthAgg._count.id ?? 0 },
        lastMonth: { revenue: lastMonthAgg._sum.total ?? 0, orders: lastMonthAgg._count.id ?? 0 },
        total:     { revenue: totalAgg._sum.total ?? 0,     orders: totalAgg._count.id ?? 0 },
      },
    })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Détail livreur (vue agent commercial) ────────────────────────────────

router.get('/drivers/:id', ...guard, async (req, res) => {
  const driverId = Number(req.params.id)
  try {
    const now = new Date()
    const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [driver, settings, recentDeliveries, thisMonthAgg, lastMonthAgg] = await Promise.all([
      prisma.driver.findUnique({
        where: { id: driverId },
        include: {
          user:     { select: { id: true, name: true, email: true, phone: true } },
          contract: { select: { id: true, status: true, signedAt: true } },
        },
      }),
      prisma.platformSettings.findUnique({ where: { id: 1 } }),
      prisma.order.findMany({
        where: { driverId, status: 'DELIVERED' },
        include: { shop: { select: { name: true } }, buyer: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.order.aggregate({
        where: { driverId, status: 'DELIVERED', updatedAt: { gte: startOfMonth } },
        _count: { id: true }, _sum: { deliveryFee: true },
      }),
      prisma.order.aggregate({
        where: { driverId, status: 'DELIVERED', updatedAt: { gte: startOfLastMonth, lt: startOfMonth } },
        _count: { id: true }, _sum: { deliveryFee: true },
      }),
    ])

    if (!driver) return res.status(404).json({ error: 'Livreur introuvable' })

    // LOT 8 (Arbitrage XXX RIZ, "cohérence logistique ↔ finance ↔
    // rémunération") : sans ce complément, un livreur ayant fait des
    // livraisons B2B apparaissait ici avec des statistiques mensuelles
    // sous-estimées par rapport à ce qu'il a réellement touché
    // (Driver.monthlyEarnings, déjà crédité pour le B2B par
    // payDriverForDelivery). Même agrégation que le B2C, via Shipment (le
    // driverId d'une livraison B2B vit sur Shipment, pas sur B2BTransaction).
    const [b2bThisMonth, b2bLastMonth] = await Promise.all([
      prisma.shipment.findMany({
        where: { driverId, status: 'DELIVERED', b2bTransactionId: { not: null }, updatedAt: { gte: startOfMonth } },
        include: { b2bTransaction: { select: { deliveryFee: true } } },
      }),
      prisma.shipment.findMany({
        where: { driverId, status: 'DELIVERED', b2bTransactionId: { not: null }, updatedAt: { gte: startOfLastMonth, lt: startOfMonth } },
        include: { b2bTransaction: { select: { deliveryFee: true } } },
      }),
    ])
    const sumB2BFees = (shipments) => shipments.reduce((s, sh) => s + (sh.b2bTransaction?.deliveryFee || 0), 0)

    const commissionRate = driver.plan === 'PREMIUM'
      ? (settings?.premiumDriverCommission ?? 0.20)
      : (settings?.driverCommission ?? 0.15)

    res.json({
      ...driver,
      commissionRate,
      recentDeliveries,
      stats: {
        thisMonth: {
          deliveries: (thisMonthAgg._count.id ?? 0) + b2bThisMonth.length,
          fees: (thisMonthAgg._sum.deliveryFee ?? 0) + sumB2BFees(b2bThisMonth),
        },
        lastMonth: {
          deliveries: (lastMonthAgg._count.id ?? 0) + b2bLastMonth.length,
          fees: (lastMonthAgg._sum.deliveryFee ?? 0) + sumB2BFees(b2bLastMonth),
        },
      },
    })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Notes CRM boutique ────────────────────────────────────────────────────

router.get('/shops/:id/notes', ...guard, async (req, res) => {
  try {
    const notes = await prisma.commercialNote.findMany({
      where: { shopId: Number(req.params.id) },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ notes })
  } catch (e) {
    sendError(res, e)
  }
})

router.post('/shops/:id/notes', ...guard, async (req, res) => {
  const { content } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Contenu requis' })
  try {
    const note = await prisma.commercialNote.create({
      data: { shopId: Number(req.params.id), authorId: req.user.id, content: content.trim() },
      include: { author: { select: { name: true } } },
    })
    res.status(201).json(note)
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Notes CRM livreur ─────────────────────────────────────────────────────

router.get('/drivers/:id/notes', ...guard, async (req, res) => {
  try {
    const notes = await prisma.commercialNote.findMany({
      where: { driverId: Number(req.params.id) },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ notes })
  } catch (e) {
    sendError(res, e)
  }
})

router.post('/drivers/:id/notes', ...guard, async (req, res) => {
  const { content } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Contenu requis' })
  try {
    const note = await prisma.commercialNote.create({
      data: { driverId: Number(req.params.id), authorId: req.user.id, content: content.trim() },
      include: { author: { select: { name: true } } },
    })
    res.status(201).json(note)
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Rappel signature contrat boutique ────────────────────────────────────

router.post('/shops/:id/remind-contract', ...guard, async (req, res) => {
  try {
    const shopId = Number(req.params.id)
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, userId: true },
    })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })

    await notify(
      shop.userId,
      'CONTRACT_REMINDER',
      'Rappel signature de contrat',
      'Votre contrat est en attente de signature. Connectez-vous pour le signer.',
      { shopId }
    )
    setImmediate(() =>
      logAction(req.user.id, 'CONTRACT_REMINDER', 'SHOP', shopId, { shopName: shop.name })
    )
    res.json({ ok: true })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Rappel signature contrat livreur ─────────────────────────────────────

router.post('/drivers/:id/remind-contract', ...guard, async (req, res) => {
  try {
    const driverId = Number(req.params.id)
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, userId: true, user: { select: { name: true } } },
    })
    if (!driver) return res.status(404).json({ error: 'Livreur introuvable' })

    await notify(
      driver.userId,
      'CONTRACT_REMINDER',
      'Rappel signature de contrat',
      'Votre contrat est en attente de signature. Connectez-vous pour le signer.',
      { driverId }
    )
    setImmediate(() =>
      logAction(req.user.id, 'CONTRACT_REMINDER', 'DRIVER', driverId, { driverName: driver.user?.name })
    )
    res.json({ ok: true })
  } catch (e) {
    sendError(res, e)
  }
})

module.exports = router
