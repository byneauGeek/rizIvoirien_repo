const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authenticate, authenticateSSE, requireRole } = require('../middleware/auth')
const { getSettings, driverRate } = require('../lib/settings')
const deliveryLifecycle = require('../services/deliveryLifecycle')

const BADGES = [
  { id: 'debutant', label: 'Débutant', icon: '🌱', minDeliveries: 0, minRate: 0 },
  { id: 'express', label: 'Express', icon: '⚡', minDeliveries: 20, minRate: 0.8 },
  { id: 'pro', label: 'Pro', icon: '🏆', minDeliveries: 100, minRate: 0.9 },
  { id: 'elite', label: 'Élite', icon: '💎', minDeliveries: 500, minRate: 0.95 },
]

const getBadge = (driver) => {
  const eligible = BADGES.filter(
    b => driver.totalDeliveries >= b.minDeliveries && driver.acceptanceRate >= b.minRate
  )
  return eligible[eligible.length - 1]
}

// GET /api/drivers/offers — offres en attente pour le livreur connecté
router.get('/offers', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } })
    if (!driver) return res.status(404).json({ error: 'Profil livreur introuvable' })

    const [offers, settings] = await Promise.all([
      prisma.driverOffer.findMany({
        where: { driverId: driver.id, status: 'PENDING', expiresAt: { gt: new Date() } },
        include: {
          order: {
            include: {
              buyer: { select: { name: true, phone: true } },
              shop: { select: { name: true, location: true } },
              items: { include: { product: { select: { name: true } } } },
            },
          },
        },
      }),
      getSettings(),
    ])

    const commission = driverRate(settings, driver.plan)
    res.json({ offers, commission })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/drivers/offers/:id/accept
router.post('/offers/:id/accept', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { name: true, phone: true } } },
    })
    const offerId = Number(req.params.id)
    const offer = await prisma.driverOffer.findFirst({
      where: { id: offerId, driverId: driver.id, status: 'PENDING' },
    })
    if (!offer) return res.status(404).json({ error: 'Offre introuvable ou expirée' })
    if (offer.expiresAt < new Date()) return res.status(400).json({ error: 'Offre expirée' })

    // Charger la commande complète pour les notifications
    const order = await prisma.order.findUnique({
      where: { id: offer.orderId },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        shop:  { select: { name: true, location: true } },
        items: { select: { quantity: true, name: true, price: true } },
      },
    })

    // Transition atomique PENDING → ACCEPTED : le where re-vérifie le statut et le
    // livreur assigné au moment de l'écriture, pour ne jamais accepter une offre déjà
    // ré-assignée/expirée entre-temps par le moteur d'affectation (course concurrente).
    // Le statut de la commande reste PRET — le livreur a accepté mais n'a pas encore
    // pris en charge la livraison. La transition vers IN_TRANSIT se fait au démarrage du trajet.
    // LOT 3 (Logistique) : c'est ici que le Shipment naît — le moment où une
    // livraison commence réellement à exister comme opération logistique.
    const claimed = await prisma.$transaction(async (tx) => {
      const { count } = await tx.driverOffer.updateMany({
        where: { id: offerId, driverId: driver.id, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      })
      if (count !== 1) return false

      await tx.order.update({ where: { id: offer.orderId }, data: { driverId: driver.id } })
      await tx.driver.update({
        where: { id: driver.id },
        data: {
          available: false,
          acceptanceRate: Math.min(1, driver.acceptanceRate + 0.01),
        },
      })
      await tx.orderStatusHistory.create({
        data: { orderId: offer.orderId, status: 'PRET', note: 'Livreur assigné — en route pour la collecte', actorId: req.user.id },
      })
      await deliveryLifecycle.createShipmentForOrder(tx, {
        orderId: offer.orderId, driverId: driver.id,
        dropoffAddress: order.address, pickupAddress: order.shop?.location || null,
      })
      return true
    })

    if (!claimed) return res.status(409).json({ error: 'Cette offre vient d\'être réattribuée. Actualisez votre liste.' })

    // Calculer la date de livraison estimée
    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    const leadDays = settings?.deliveryLeadDays ?? 1
    const deliveryDate = new Date()
    deliveryDate.setDate(deliveryDate.getDate() + leadDays)
    const deliveryDateStr = deliveryDate.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    const driverName  = driver.user?.name  || 'Votre livreur'
    const driverPhone = driver.user?.phone || ''
    const totalToPay  = (order.total || 0) + (order.deliveryFee || 0)

    // Notification in-app + email à l'acheteur (non-bloquant)
    setImmediate(async () => {
      try {
        const { notify }   = require('../services/notifications')
        const { sendMail } = require('../services/mailer')

        await notify(
          order.buyer.id,
          'DRIVER_ASSIGNED',
          '🚚 Livreur assigné à votre commande',
          `${driverName} (${driverPhone}) prendra en charge votre commande #${order.id}. Livraison prévue : ${deliveryDateStr}.`,
          { orderId: order.id }
        )

        await sendMail(order.buyer.email, 'driverAssigned', {
          name:          order.buyer.name,
          orderId:       order.id,
          driverName,
          driverPhone,
          deliveryDate:  deliveryDateStr,
          paymentMethod: order.paymentMethod,
          totalToPay,
          shopName:      order.shop?.name,
        })
      } catch (err) {
        console.error('[accept] Erreur notification acheteur :', err.message)
      }
    })

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/drivers/offers/:id/refuse
router.post('/offers/:id/refuse', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } })
    const offer = await prisma.driverOffer.findFirst({
      where: { id: Number(req.params.id), driverId: driver.id, status: 'PENDING' },
    })
    if (!offer) return res.status(404).json({ error: 'Offre introuvable' })

    await Promise.all([
      prisma.driverOffer.update({ where: { id: offer.id }, data: { status: 'REFUSED' } }),
      prisma.driver.update({
        where: { id: driver.id },
        data: { acceptanceRate: Math.max(0, driver.acceptanceRate - 0.05) },
      }),
    ])

    // Vérification des seuils de pénalité
    const { assignOrder, applyPenaltyAndCheck } = require('../services/assignmentEngine')
    const penaltySettings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    await applyPenaltyAndCheck(driver.id, penaltySettings)

    // Réassigner à un autre livreur
    setImmediate(() => assignOrder(offer.orderId))

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/drivers/me — profil complet du livreur
router.get('/me', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { name: true, email: true, phone: true } } },
    })
    if (!driver) return res.status(404).json({ error: 'Profil introuvable' })
    res.json(driver)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/drivers/profile — mise à jour profil complet
router.put('/profile', authenticate, requireRole('DRIVER'), async (req, res) => {
  const {
    avatar, idNumber, idPhoto,
    licenseNumber, licenseExpiry, licensePhoto,
    vehicleType, vehiclePlate, vehiclePhoto,
  } = req.body
  try {
    const driver = await prisma.driver.update({
      where: { userId: req.user.id },
      data: {
        ...(avatar !== undefined && { avatar }),
        ...(idNumber !== undefined && { idNumber }),
        ...(idPhoto !== undefined && { idPhoto }),
        ...(licenseNumber !== undefined && { licenseNumber }),
        ...(licenseExpiry !== undefined && { licenseExpiry }),
        ...(licensePhoto !== undefined && { licensePhoto }),
        ...(vehicleType !== undefined && { vehicleType }),
        ...(vehiclePlate !== undefined && { vehiclePlate }),
        ...(vehiclePhoto !== undefined && { vehiclePhoto }),
      },
      include: { user: { select: { name: true, email: true, phone: true } } },
    })
    res.json(driver)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/drivers/status — livreur passe online/offline
router.put('/status', authenticate, requireRole('DRIVER'), async (req, res) => {
  const { online } = req.body
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } })
    if (!driver) return res.status(404).json({ error: 'Profil introuvable' })
    // Seuls les livreurs ACTIFS peuvent se mettre en ligne
    if (driver.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Votre compte n\'est pas encore activé par l\'administration' })
    }
    const updated = await prisma.driver.update({
      where: { userId: req.user.id },
      data: { online: Boolean(online), available: Boolean(online) },
    })
    res.json({ online: updated.online })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/drivers/active-delivery — livraison en cours
router.get('/active-delivery', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } })
    if (!driver) return res.status(404).json({ error: 'Profil introuvable' })

    const [order, settings] = await Promise.all([
      prisma.order.findFirst({
        where: { driverId: driver.id, status: { in: ['IN_TRANSIT', 'PRET', 'CONFIRMED'] } },
        include: {
          buyer: { select: { name: true, phone: true, email: true } },
          shop:  { select: { name: true, location: true, phone: true, email: true, latitude: true, longitude: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
          statusHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      getSettings(),
    ])

    const commission = driverRate(settings, driver.plan)
    res.json({ order: order || null, commission })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/drivers/delivery/:orderId/status — livreur met à jour statut
// LOT 3 (Logistique) : délègue entièrement à deliveryLifecycle.advanceShipment
// — point d'entrée unique désormais partagé avec le chemin admin (voir
// orders.js), plus de logique de rémunération dupliquée ici.
router.put('/delivery/:orderId/status', authenticate, requireRole('DRIVER'), async (req, res) => {
  const { status, note } = req.body
  const ALLOWED = ['IN_TRANSIT', 'DELIVERED']
  if (!ALLOWED.includes(status)) return res.status(400).json({ error: 'Statut invalide' })

  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } })
    const order = await prisma.order.findFirst({
      where: { id: Number(req.params.orderId), driverId: driver.id },
    })
    if (!order) return res.status(404).json({ error: 'Commande introuvable' })

    const autoNote = {
      IN_TRANSIT: 'Colis récupéré par le livreur — en route pour la livraison',
      DELIVERED:  'Colis remis au client',
    }
    // 'IN_TRANSIT' côté API (vocabulaire Order, inchangé pour ne pas casser
    // le contrat avec DeliveryTab.jsx) correspond à 'PICKED_UP' côté Shipment
    // (premier point de collecte — pas d'étape distincte aujourd'hui).
    const shipmentStatus = status === 'IN_TRANSIT' ? 'PICKED_UP' : 'DELIVERED'

    await deliveryLifecycle.advanceShipment(prisma, {
      orderId: order.id, status: shipmentStatus, actorId: req.user.id, note: note || autoNote[status] || null,
    })

    const { notify } = require('../services/notifications')
    if (status === 'IN_TRANSIT') {
      setImmediate(() => notify(
        order.buyerId, 'IN_TRANSIT', 'Votre colis est en route !',
        `Le livreur a récupéré votre commande #${order.id} et est en route.`,
        { orderId: order.id }
      ))
    } else {
      await notify(order.buyerId, 'DELIVERED', 'Commande livrée !', `Votre commande #${order.id} a été livrée. Merci !`, { orderId: order.id })
      // Email de confirmation — avant le LOT 3, ce template n'était déclenché
      // que par le chemin orders.js désormais supprimé, jamais atteint par
      // l'app réelle : aucun acheteur ne le recevait en pratique.
      const [buyerUser, shopInfo] = await Promise.all([
        prisma.user.findUnique({ where: { id: order.buyerId }, select: { name: true, email: true } }),
        prisma.shop.findUnique({ where: { id: order.shopId }, select: { name: true } }),
      ])
      const { sendMail } = require('../services/mailer')
      setImmediate(() => sendMail(buyerUser?.email, 'orderDelivered', { name: buyerUser?.name || '', orderId: order.id, shopName: shopInfo?.name || '' }))
    }

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/drivers/earnings — historique gains
router.get('/earnings', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } })
    if (!driver) return res.status(404).json({ error: 'Profil introuvable' })

    const settings = await getSettings()
    const commission = driverRate(settings, driver.plan)
    const now = new Date()

    // Toutes les livraisons pour le total exact
    const allFees = await prisma.order.findMany({
      where: { driverId: driver.id, status: 'DELIVERED' },
      select: { deliveryFee: true },
    })
    const total = allFees.reduce((s, o) => s + Math.round(o.deliveryFee * commission), 0)

    // 50 dernières pour l'affichage
    const deliveries = await prisma.order.findMany({
      where: { driverId: driver.id, status: 'DELIVERED' },
      select: {
        id: true, total: true, deliveryFee: true, createdAt: true,
        buyer: { select: { name: true } },
        shop: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const earnings = deliveries.map(o => ({
      ...o,
      gain: Math.round(o.deliveryFee * commission),
    }))

    // Données mensuelles des 6 derniers mois (depuis les métriques)
    const metrics = await prisma.driverMetric.findMany({
      where: { driverId: driver.id },
    })
    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const metric = metrics.find(m => m.month === d.getMonth() + 1 && m.year === d.getFullYear())
      monthlyData.push({
        month: d.toLocaleString('fr-FR', { month: 'short' }),
        deliveries: metric?.deliveries || 0,
        earnings: metric?.earnings || 0,
      })
    }

    // ── Gains par jour de semaine (60 derniers jours) ────────────────────────
    const sixtyDaysAgo = new Date(now); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const recentForDow = await prisma.order.findMany({
      where: { driverId: driver.id, status: 'DELIVERED', createdAt: { gte: sixtyDaysAgo } },
      select: { createdAt: true, deliveryFee: true },
    })
    const DOW_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    const dowBuckets = {}
    for (const o of recentForDow) {
      const day = new Date(o.createdAt).getDay()
      if (!dowBuckets[day]) dowBuckets[day] = { count: 0, total: 0 }
      dowBuckets[day].count++
      dowBuckets[day].total += Math.round(o.deliveryFee * commission)
    }
    const dowEarnings = [1, 2, 3, 4, 5, 6, 0].map(day => ({
      label: DOW_LABELS[day],
      count: dowBuckets[day]?.count || 0,
      avgEarnings: dowBuckets[day]?.count > 0 ? Math.round(dowBuckets[day].total / dowBuckets[day].count) : 0,
    }))

    // Gains ce mois
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthFees = await prisma.order.findMany({
      where: { driverId: driver.id, status: 'DELIVERED', createdAt: { gte: startOfMonth } },
      select: { deliveryFee: true },
    })
    const monthEarnings = thisMonthFees.reduce((s, o) => s + Math.round(o.deliveryFee * commission), 0)

    res.json({ earnings, total, commission, monthlyData, dowEarnings, monthEarnings, plan: driver.plan })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/drivers/performance — dashboard livreur
router.get('/performance', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const [driver, settings] = await Promise.all([
      prisma.driver.findUnique({
        where: { userId: req.user.id },
        include: { metrics: { orderBy: { year: 'desc' } } },
      }),
      getSettings(),
    ])
    if (!driver) return res.status(404).json({ error: 'Profil introuvable' })

    const commission = driverRate(settings, driver.plan)
    const now = new Date()

    // Métriques des 6 derniers mois
    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const metric = driver.metrics.find(m => m.month === d.getMonth() + 1 && m.year === d.getFullYear())
      monthlyData.push({
        month: d.toLocaleString('fr-FR', { month: 'short' }),
        deliveries: metric?.deliveries || 0,
        earnings: metric?.earnings || 0,
      })
    }

    // Gains totaux réels (toutes livraisons DELIVERED)
    const allFees = await prisma.order.findMany({
      where: { driverId: driver.id, status: 'DELIVERED' },
      select: { deliveryFee: true },
    })
    const totalEarnings = allFees.reduce((s, o) => s + Math.round(o.deliveryFee * commission), 0)

    const score = Math.round(
      ((driver.rating / 5) * 0.4 + driver.acceptanceRate * 0.35 + Math.min(driver.totalDeliveries / 100, 1) * 0.25) * 100
    )

    const currentBadge = getBadge(driver)
    const nextBadge = BADGES.find(b => b.minDeliveries > driver.totalDeliveries) || null

    // Moyennes plateforme pour comparaison
    const platformAvgData = await prisma.driver.aggregate({
      where: { status: 'ACTIVE' },
      _avg: { rating: true, acceptanceRate: true, totalDeliveries: true },
    })
    const platformAvg = {
      rating: Math.round((platformAvgData._avg?.rating || 4.0) * 10) / 10,
      acceptanceRate: Math.round((platformAvgData._avg?.acceptanceRate || 0.75) * 100),
      monthlyDeliveries: Math.round(platformAvgData._avg?.totalDeliveries || 20),
    }

    res.json({
      driver,
      score,
      badge: currentBadge,
      nextBadge,
      badges: BADGES.map(b => ({
        ...b,
        unlocked: driver.totalDeliveries >= b.minDeliveries && driver.acceptanceRate >= b.minRate,
      })),
      monthlyData,
      platformAvg,
      stats: {
        totalDeliveries: driver.totalDeliveries,
        acceptanceRate: Math.round(driver.acceptanceRate * 100),
        rating: driver.rating,
        monthlyEarnings: driver.monthlyEarnings,
        totalEarnings,
        warningCount:  driver.warningCount,
        autoSuspended: driver.autoSuspended,
      },
      penaltyThresholds: {
        warn1:   Math.round((settings?.penaltyWarn1Rate   ?? 0.70) * 100),
        warn2:   Math.round((settings?.penaltyWarn2Rate   ?? 0.50) * 100),
        suspend: Math.round((settings?.penaltySuspendRate ?? 0.30) * 100),
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── SSE : stream d'événements temps-réel pour le livreur ──────────────────────
// GET /api/drivers/events
router.get('/events', authenticateSSE, requireRole('DRIVER'), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Nginx: désactiver buffering
  res.flushHeaders()

  const { addClient, removeClient } = require('../services/sse')
  const uid = req.user.id
  addClient(uid, res)

  // Confirmer la connexion
  res.write(`event: connected\ndata: ${JSON.stringify({ uid })}\n\n`)

  // Keep-alive ping toutes les 25s (avant timeout Nginx 30s)
  const ping = setInterval(() => {
    try { res.write(':ping\n\n') } catch { clearInterval(ping); removeClient(uid) }
  }, 25000)

  req.on('close', () => {
    clearInterval(ping)
    removeClient(uid)
  })
})

// ── GPS : position du livreur ──────────────────────────────────────────────────
// POST /api/drivers/location
// LOT 1 (Logistique, arbitrage Décision 4) : persistée en base (dernière
// position uniquement) plutôt que dans le Map en mémoire de services/sse.js,
// qui ne survivait pas à un redémarrage serveur. Pas d'historique de trajet
// ici — repoussé au LOT 9 (preuve de livraison) avec une politique de
// rétention à définir avant toute collecte d'historique GPS.
router.post('/location', authenticate, requireRole('DRIVER'), async (req, res) => {
  const { lat, lng, accuracy, orderId } = req.body
  if (lat == null || lng == null) return res.status(400).json({ error: 'lat et lng requis' })
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ error: 'Coordonnées invalides' })

  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } })
    if (!driver) return res.status(404).json({ error: 'Profil introuvable' })

    await prisma.driverCurrentLocation.upsert({
      where: { driverId: driver.id },
      update: { lat: Number(lat), lng: Number(lng), accuracy: accuracy != null ? Number(accuracy) : null, orderId: orderId ? Number(orderId) : null },
      create: { driverId: driver.id, lat: Number(lat), lng: Number(lng), accuracy: accuracy != null ? Number(accuracy) : null, orderId: orderId ? Number(orderId) : null },
    })

    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET /api/drivers/contract
router.get('/contract', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id }, include: { contract: true } })
    if (!driver) return res.status(404).json({ error: 'Profil introuvable' })
    res.json({ contract: driver.contract, contractSigned: driver.contractSigned })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/drivers/contract/sign
router.put('/contract/sign', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id }, include: { contract: true } })
    if (!driver?.contract) return res.status(404).json({ error: 'Contrat introuvable' })
    if (driver.contractSigned) return res.json({ message: 'Déjà signé' })
    await prisma.$transaction([
      prisma.contract.update({ where: { id: driver.contract.id }, data: { status: 'SIGNED', signedAt: new Date() } }),
      prisma.driver.update({ where: { id: driver.id }, data: { contractSigned: true } }),
    ])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/drivers/plan-info — tarifs et fonctionnalités des plans livreur (accessible sans admin)
router.get('/plan-info', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const [driver, settings] = await Promise.all([
      prisma.driver.findUnique({ where: { userId: req.user.id } }),
      getSettings(),
    ])
    res.json({
      plan:                    driver?.plan || 'BASIC',
      driverSubMonthly:        settings.driverSubPrice,
      driverSubAnnual:         settings.driverAnnualPrice ?? Math.round(settings.driverSubPrice * 12 * 0.85),
      driverSubPrice:          settings.driverSubPrice, // compat
      driverCommission:        settings.driverCommission,
      premiumDriverCommission: settings.premiumDriverCommission,
      driverBasicFeatures:     settings.driverBasicFeatures   ?? null,
      driverPremiumFeatures:   settings.driverPremiumFeatures ?? null,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/drivers/my/plan-upgrade-request — dernière demande de montée en plan
router.get('/my/plan-upgrade-request', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user.id } })
    if (!driver) return res.status(404).json({ error: 'Profil livreur introuvable' })
    const request = await prisma.planUpgradeRequest.findFirst({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ request })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/drivers/my/plan-upgrade-request — demander le plan PREMIUM
router.post('/my/plan-upgrade-request', authenticate, requireRole('DRIVER'), async (req, res) => {
  try {
    const { note, billingPeriod = 'monthly' } = req.body
    const [driver, settings] = await Promise.all([
      prisma.driver.findUnique({
        where: { userId: req.user.id },
        include: { planUpgradeRequests: { where: { status: 'PENDING' } } },
      }),
      prisma.platformSettings.findUnique({ where: { id: 1 } }),
    ])
    if (!driver) return res.status(404).json({ error: 'Profil livreur introuvable' })
    if (driver.plan === 'PREMIUM')
      return res.status(400).json({ error: 'Vous êtes déjà sur le plan Premium.' })
    if (driver.planUpgradeRequests.length > 0)
      return res.status(409).json({ error: 'Une demande est déjà en cours d\'examen.' })

    const monthly = settings?.driverSubPrice   ?? 5000
    const annual  = settings?.driverAnnualPrice ?? Math.round(monthly * 12 * 0.85)
    const period  = billingPeriod === 'annual' ? 'annual' : 'monthly'
    const amount  = period === 'annual' ? annual : monthly

    const request = await prisma.planUpgradeRequest.create({
      data: {
        type: 'DRIVER', driverId: driver.id,
        fromPlan: driver.plan || 'BASIC', toPlan: 'PREMIUM',
        billingPeriod: period,
        note: note || null,
        amount,
        status: 'PENDING',
      },
    })
    const { notify } = require('../services/notifications')
    setImmediate(() => {
      notify(1, 'PLAN_UPGRADE_REQUEST', 'Nouvelle demande plan Premium (livreur)',
        `Le livreur "${req.user.name}" demande à passer en plan Premium.`, { requestId: request.id }).catch(() => {})
    })
    res.status(201).json(request)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
