const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authenticate, requireRole } = require('../middleware/auth')
const { logAction } = require('../services/adminLog')
const { notify } = require('../services/notifications')
const { pushToUser } = require('../services/sse')
const { computeScore } = require('../services/assignmentEngine')
const { isFreshLocation, haversineKm } = require('../lib/gps')
const { getSettings, driverRate } = require('../lib/settings')
const deliveryLifecycle = require('../services/deliveryLifecycle')

const guard           = [authenticate, requireRole('ADMIN')]
const commercialGuard = [authenticate, requireRole('ADMIN', 'COMMERCIAL')]

// ─── Onglet 1 : Vue d'ensemble analytique ─────────────────────────────────

router.get('/analytics', ...guard, async (req, res) => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [
      totalOrders, monthOrders, lastMonthOrders,
      totalRevenue, monthRevenue,
      totalUsers, totalShops, totalDrivers,
      pendingOrders, deliveredOrders,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
      prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { status: 'DELIVERED', createdAt: { gte: startOfMonth } }, _sum: { total: true } }),
      prisma.user.count(),
      prisma.shop.count(),
      prisma.driver.count(),
      prisma.order.count({ where: { status: { in: ['PENDING', 'CONFIRMED', 'EN_PREPARATION', 'PRET'] } } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
    ])

    // Revenus des 12 derniers mois
    const monthlyRevenue = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const [agg, count] = await Promise.all([
        prisma.order.aggregate({ where: { status: 'DELIVERED', createdAt: { gte: d, lt: end } }, _sum: { total: true } }),
        prisma.order.count({ where: { createdAt: { gte: d, lt: end } } }),
      ])
      monthlyRevenue.push({
        month: d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }),
        revenue: agg._sum.total || 0,
        orders: count,
      })
    }

    // Répartition par statut
    const byStatus = await prisma.order.groupBy({ by: ['status'], _count: { id: true } })

    // Top boutiques
    const topShops = await prisma.order.groupBy({
      by: ['shopId'],
      where: { status: 'DELIVERED' },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    })
    const topShopsWithNames = await Promise.all(
      topShops.map(async ts => {
        const shop = await prisma.shop.findUnique({ where: { id: ts.shopId }, select: { name: true, certified: true } })
        return { ...ts, shop }
      })
    )

    const settings = await getSettings()
    const commission = (totalRevenue._sum.total || 0) * settings.commissionRate

    // ── Analytics avancés ──────────────────────────────────────────────────
    const ninetyDaysAgo = new Date(now); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const [recentOrderDates, topItemsRaw, buyerCounts] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: ninetyDaysAgo }, status: { notIn: ['CANCELLED'] } },
        select: { createdAt: true },
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'name'],
        where: { order: { status: 'DELIVERED' } },
        _sum: { quantity: true, price: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      prisma.order.groupBy({
        by: ['buyerId'],
        where: { createdAt: { gte: ninetyDaysAgo }, status: { notIn: ['CANCELLED'] } },
        _count: { id: true },
      }),
    ])

    const DOW_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    const ordersByDow = [1, 2, 3, 4, 5, 6, 0].map(day => ({
      label: DOW_LABELS[day],
      count: recentOrderDates.filter(o => new Date(o.createdAt).getDay() === day).length,
    }))

    const topProductIds = topItemsRaw.map(t => t.productId).filter(Boolean)
    const topProductDetails = topProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, images: true, shop: { select: { name: true } } },
        })
      : []
    const topProducts = topItemsRaw.map(t => {
      const p = topProductDetails.find(d => d.id === t.productId)
      return {
        productId: t.productId,
        name: t.name || p?.name || 'Produit inconnu',
        shopName: p?.shop?.name || '',
        image: p?.images?.[0] || null,
        revenue: Math.round((t._sum?.price || 0) * (t._sum?.quantity || 0)),
        quantity: t._sum?.quantity || 0,
      }
    })

    const repeatBuyers = buyerCounts.filter(b => b._count.id >= 2).length
    const repeatBuyerRate = buyerCounts.length > 0 ? Math.round(repeatBuyers / buyerCounts.length * 100) : 0

    const cancellationCount = await prisma.order.count({ where: { status: 'CANCELLED' } })
    const cancellationRate = (totalOrders || 0) > 0 ? Math.round((cancellationCount / totalOrders) * 100) : 0

    res.json({
      kpis: {
        totalOrders, monthOrders, lastMonthOrders,
        growthRate: lastMonthOrders ? ((monthOrders - lastMonthOrders) / lastMonthOrders) * 100 : 0,
        totalRevenue: totalRevenue._sum.total || 0,
        monthRevenue: monthRevenue._sum.total || 0,
        commission,
        totalUsers, totalShops, totalDrivers,
        pendingOrders, deliveredOrders,
        repeatBuyerRate,
        cancellationRate,
      },
      monthlyRevenue,
      byStatus,
      topShops: topShopsWithNames,
      ordersByDow,
      topProducts,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Onglet 2 : Gestion commandes ─────────────────────────────────────────

router.get('/orders', ...guard, async (req, res) => {
  const { status, shopId, driverId, groupId, limit = '50', offset = '0' } = req.query
  try {
    const where = {}
    if (status) where.status = status
    if (shopId) where.shopId = Number(shopId)
    if (driverId) where.driverId = Number(driverId)
    if (groupId) where.groupId = groupId

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          buyer: { select: { name: true, email: true, phone: true } },
          shop: { select: { name: true } },
          driver: { include: { user: { select: { name: true } } } },
          items: { include: { product: { select: { name: true } } } },
          statusHistory: { orderBy: { createdAt: 'asc' } },
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

// ─── Assignation manuelle ─────────────────────────────────────────────────

router.get('/orders/:id/candidates', ...guard, async (req, res) => {
  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      select: { shop: { select: { latitude: true, longitude: true } } },
    })
    const shopLat = order?.shop?.latitude
    const shopLng = order?.shop?.longitude
    const drivers = await prisma.driver.findMany({
      where: {
        online: true,
        available: true,
        status: 'ACTIVE',
        rating: { gte: settings?.minDriverRating ?? 3.5 },
      },
      include: { user: { select: { id: true, name: true, phone: true } }, currentLocation: true },
    })
    const scored = drivers
      .map(d => {
        let distanceKm = null
        if (shopLat != null && shopLng != null && d.currentLocation && isFreshLocation(d.currentLocation.updatedAt)) {
          distanceKm = haversineKm(shopLat, shopLng, d.currentLocation.lat, d.currentLocation.lng)
        }
        return { ...d, distanceKm, score: computeScore(d, distanceKm) }
      })
      .sort((a, b) => b.score - a.score)
    res.json({ candidates: scored })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/orders/assign-group', ...guard, async (req, res) => {
  const { groupId, driverId } = req.body
  if (!groupId || !driverId) return res.status(400).json({ error: 'groupId et driverId requis' })
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: Number(driverId) },
      include: { user: { select: { id: true, name: true } } },
    })
    if (!driver) return res.status(404).json({ error: 'Livreur introuvable' })

    const orders = await prisma.order.findMany({
      where: { groupId, status: { in: ['PRET', 'ESCALATED'] }, driverId: null },
      include: {
        buyer: { select: { name: true, phone: true } },
        shop: { select: { name: true, location: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    })
    if (!orders.length) return res.status(400).json({ error: 'Aucune commande assignable dans ce groupe' })

    const results = await prisma.$transaction(
      orders.map(o => prisma.order.update({
        where: { id: o.id },
        data: {
          driverId: Number(driverId),
          status: o.status === 'ESCALATED' ? 'PRET' : o.status,
          statusHistory: { create: {
            status: o.status === 'ESCALATED' ? 'PRET' : o.status,
            note: `Assignation manuelle groupée — livreur : ${driver.user?.name}`,
            actorId: req.user.id,
          }},
        },
      }))
    )

    await Promise.all(orders.map(o =>
      prisma.driverOffer.upsert({
        where: { orderId: o.id },
        update: { driverId: Number(driverId), status: 'ACCEPTED', expiresAt: new Date() },
        create: { orderId: o.id, driverId: Number(driverId), status: 'ACCEPTED', attempt: 1, expiresAt: new Date() },
      }).catch(() => {})
    ))
    // LOT 3 (Logistique) : sans Shipment, le livreur ne pourrait plus mettre
    // à jour le statut de livraison via PUT /drivers/delivery/:orderId/status.
    await Promise.all(orders.map(o =>
      deliveryLifecycle.createShipmentForOrder(prisma, {
        orderId: o.id, driverId: Number(driverId), dropoffAddress: o.address, pickupAddress: o.shop?.location || null,
      })
    ))

    setImmediate(() => {
      for (const o of orders) {
        try { if (driver.user?.id) pushToUser(driver.user.id, 'new_offer', { orderId: o.id, status: 'ACCEPTED', order: o }) } catch {}
        notify(driver.user.id, 'MANUAL_ASSIGNMENT', 'Commande assignée',
          `La commande #${o.id} (groupe) vous a été assignée manuellement.`, { orderId: o.id }).catch(() => {})
      }
    })
    setImmediate(() => logAction(req.user.id, 'MANUAL_ASSIGN_GROUP', 'ORDER', null,
      { groupId, driverId: Number(driverId), orderIds: orders.map(o => o.id) }))

    res.json({ assigned: results.length, orderIds: results.map(o => o.id) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/orders/:id/assign', ...guard, async (req, res) => {
  const { driverId } = req.body
  if (!driverId) return res.status(400).json({ error: 'driverId requis' })
  const orderId = Number(req.params.id)
  try {
    const [order, driver] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        include: {
          buyer: { select: { name: true, phone: true } },
          shop: { select: { name: true, location: true } },
          items: { include: { product: { select: { name: true } } } },
        },
      }),
      prisma.driver.findUnique({
        where: { id: Number(driverId) },
        include: { user: { select: { id: true, name: true } } },
      }),
    ])

    if (!order)  return res.status(404).json({ error: 'Commande introuvable' })
    if (!driver) return res.status(404).json({ error: 'Livreur introuvable' })
    if (!['PRET', 'ESCALATED'].includes(order.status))
      return res.status(400).json({ error: `Assignation impossible depuis le statut ${order.status}` })
    if (order.driverId)
      return res.status(400).json({ error: 'Cette commande a déjà un livreur assigné' })

    await prisma.driverOffer.upsert({
      where: { orderId },
      update: { driverId: Number(driverId), status: 'ACCEPTED', expiresAt: new Date() },
      create: { orderId, driverId: Number(driverId), status: 'ACCEPTED', attempt: 1, expiresAt: new Date() },
    })

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: Number(driverId),
        status: order.status === 'ESCALATED' ? 'PRET' : order.status,
        statusHistory: { create: {
          status: order.status === 'ESCALATED' ? 'PRET' : order.status,
          note: `Assignation manuelle — livreur : ${driver.user?.name}`,
          actorId: req.user.id,
        }},
      },
    })
    await deliveryLifecycle.createShipmentForOrder(prisma, {
      orderId, driverId: Number(driverId), dropoffAddress: order.address, pickupAddress: order.shop?.location || null,
    })

    setImmediate(() => {
      try { if (driver.user?.id) pushToUser(driver.user.id, 'new_offer', { orderId, status: 'ACCEPTED', order }) } catch {}
      notify(driver.user.id, 'MANUAL_ASSIGNMENT', 'Commande assignée',
        `La commande #${orderId} vous a été assignée manuellement.`, { orderId }).catch(() => {})
    })
    setImmediate(() => logAction(req.user.id, 'MANUAL_ASSIGN', 'ORDER', orderId,
      { driverId: Number(driverId), previousStatus: order.status }))

    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Onglet 3 : Gestion boutiques ─────────────────────────────────────────

router.get('/shops', ...commercialGuard, async (req, res) => {
  const { status } = req.query
  try {
    const where = {}
    if (status) where.status = status
    const shops = await prisma.shop.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        subscription: true,
        contract: { select: { id: true, status: true, signedAt: true } },
        _count: { select: { products: true, orders: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
    // Comptes par statut
    const counts = await prisma.shop.groupBy({ by: ['status'], _count: { id: true } })
    res.json({ shops, counts })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Approuver / Suspendre / Rejeter une boutique
router.put('/shops/:id/status', ...commercialGuard, async (req, res) => {
  const { status, note } = req.body
  const VALID = ['ACTIVE', 'SUSPENDED', 'REJECTED', 'PENDING']
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Statut invalide' })
  try {
    const shop = await prisma.shop.update({
      where: { id: Number(req.params.id) },
      data: {
        status,
        active: status === 'ACTIVE',
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    // Generate contract on activation
    if (status === 'ACTIVE') {
      const { generateShopContract } = require('../services/contractGenerator')
      const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
      const owner = await prisma.user.findUnique({ where: { id: shop.userId } })
      const contractContent = generateShopContract(shop, settings || {}, owner)
      await prisma.contract.upsert({
        where: { shopId: shop.id },
        update: { content: contractContent, status: 'PENDING_SIGNATURE', generatedAt: new Date(), signedAt: null },
        create: { type: 'SHOP', shopId: shop.id, content: contractContent, status: 'PENDING_SIGNATURE' },
      })
      await prisma.shop.update({ where: { id: shop.id }, data: { contractSigned: false } })
    }
    // Notifier le vendeur + email
    const { notify } = require('../services/notifications')
    const { sendMail } = require('../services/mailer')
    const msgs = {
      ACTIVE: { title: 'Boutique approuvée !', msg: 'Votre boutique est maintenant active et visible sur la marketplace.' },
      SUSPENDED: { title: 'Boutique suspendue', msg: note || 'Votre boutique a été suspendue par l\'administration.' },
      REJECTED: { title: 'Boutique rejetée', msg: note || 'Votre demande d\'ouverture de boutique n\'a pas été acceptée.' },
    }
    if (msgs[status]) {
      setImmediate(() => {
        notify(shop.userId, `SHOP_${status}`, msgs[status].title, msgs[status].msg, { shopId: shop.id })
        if (status === 'ACTIVE')   sendMail(shop.user?.email, 'shopApproved', { name: shop.user?.name || '', shopName: shop.name })
        if (status === 'REJECTED') sendMail(shop.user?.email, 'shopRejected', { name: shop.user?.name || '', shopName: shop.name, reason: note || '' })
      })
    }
    setImmediate(() => logAction(req.user.id, 'SHOP_STATUS', 'SHOP', shop.id, { status, note, shopName: shop.name }))
    res.json(shop)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/shops/:id/certify', ...commercialGuard, async (req, res) => {
  const { certified, plan } = req.body
  try {
    const shop = await prisma.shop.update({
      where: { id: Number(req.params.id) },
      data: { certified: Boolean(certified), plan: plan || 'CERTIFIED' },
    })
    if (certified && plan === 'CERTIFIED') {
      const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
      await prisma.subscription.upsert({
        where: { shopId: shop.id },
        update: { plan: 'CERTIFIED', status: 'ACTIVE', startDate: new Date(), endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000), amount: settings?.certifiedPlanPrice ?? 15000 },
        create: { shopId: shop.id, plan: 'CERTIFIED', status: 'ACTIVE', endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000), amount: settings?.certifiedPlanPrice ?? 15000 },
      })
    }
    setImmediate(() => logAction(req.user.id, 'SHOP_CERTIFY', 'SHOP', shop.id, { certified: Boolean(certified), plan: shop.plan, shopName: shop.name }))
    res.json(shop)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Onglet 4 : Gestion livreurs ──────────────────────────────────────────

router.get('/drivers', ...commercialGuard, async (req, res) => {
  const { status } = req.query
  try {
    const where = {}
    if (status) where.status = status
    const drivers = await prisma.driver.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        _count: { select: { orders: true } },
        contract: { select: { id: true, status: true, signedAt: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
    const counts = await prisma.driver.groupBy({ by: ['status'], _count: { id: true } })
    res.json({ drivers, counts })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Approuver / Suspendre / Rejeter un livreur
router.put('/drivers/:id/status', ...commercialGuard, async (req, res) => {
  const { status, note } = req.body
  const VALID = ['ACTIVE', 'SUSPENDED', 'REJECTED', 'PENDING']
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Statut invalide' })
  try {
    const driver = await prisma.driver.update({
      where: { id: Number(req.params.id) },
      data: { status },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    })
    // Generate contract on activation
    if (status === 'ACTIVE') {
      const { generateDriverContract } = require('../services/contractGenerator')
      const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
      const driverFull = await prisma.driver.findUnique({ where: { id: driver.id } })
      const contractContent = generateDriverContract(driverFull, settings || {}, driver.user)
      await prisma.contract.upsert({
        where: { driverId: driver.id },
        update: { content: contractContent, status: 'PENDING_SIGNATURE', generatedAt: new Date(), signedAt: null },
        create: { type: 'DRIVER', driverId: driver.id, content: contractContent, status: 'PENDING_SIGNATURE' },
      })
      await prisma.driver.update({ where: { id: driver.id }, data: { contractSigned: false } })
    }
    const { notify } = require('../services/notifications')
    const { sendMail } = require('../services/mailer')
    const msgs = {
      ACTIVE: { title: 'Compte activé !', msg: 'Votre dossier a été validé. Vous pouvez maintenant vous connecter et prendre des courses.' },
      SUSPENDED: { title: 'Compte suspendu', msg: note || 'Votre compte livreur a été suspendu.' },
      REJECTED: { title: 'Dossier rejeté', msg: note || 'Votre dossier de candidature n\'a pas été accepté.' },
    }
    if (msgs[status]) {
      setImmediate(() => {
        notify(driver.userId, `DRIVER_${status}`, msgs[status].title, msgs[status].msg, { driverId: driver.id })
        if (status === 'ACTIVE') sendMail(driver.user?.email, 'driverApproved', { name: driver.user?.name || '' })
      })
    }
    setImmediate(() => logAction(req.user.id, 'DRIVER_STATUS', 'DRIVER', driver.id, { status, note, driverName: driver.user?.name }))
    res.json(driver)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/drivers/:id/plan', ...commercialGuard, async (req, res) => {
  const { plan } = req.body
  if (!['BASIC', 'PREMIUM'].includes(plan)) return res.status(400).json({ error: 'Plan invalide (BASIC | PREMIUM)' })
  try {
    const driver = await prisma.driver.update({ where: { id: Number(req.params.id) }, data: { plan } })
    setImmediate(() => logAction(req.user.id, 'DRIVER_PLAN', 'DRIVER', driver.id, { plan }))
    res.json(driver)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/drivers/:id/clear-penalties', ...guard, async (req, res) => {
  try {
    const driverId = Number(req.params.id)
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: { select: { id: true } } },
    })
    if (!driver) return res.status(404).json({ error: 'Livreur introuvable' })

    const updateData = { warningCount: 0, autoSuspended: false }
    if (driver.autoSuspended && driver.status === 'SUSPENDED') updateData.status = 'ACTIVE'

    const updated = await prisma.driver.update({ where: { id: driverId }, data: updateData })

    setImmediate(async () => {
      try {
        await notify(
          driver.user.id, 'PENALTY_CLEARED',
          updateData.status === 'ACTIVE' ? 'Compte réactivé' : 'Avertissements effacés',
          updateData.status === 'ACTIVE'
            ? 'Vos avertissements ont été effacés et votre compte réactivé par l\'administration.'
            : 'Vos avertissements ont été effacés par l\'administration.',
          { driverId }
        )
      } catch {}
    })
    setImmediate(() => logAction(req.user.id, 'DRIVER_CLEAR_PENALTIES', 'DRIVER', driverId,
      { previousWarnings: driver.warningCount, wasAutoSuspended: driver.autoSuspended }))

    res.json(updated)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/drivers/:id', ...guard, async (req, res) => {
  const { rating, available } = req.body
  try {
    const driver = await prisma.driver.update({
      where: { id: Number(req.params.id) },
      data: {
        rating: rating !== undefined ? Number(rating) : undefined,
        available: available !== undefined ? Boolean(available) : undefined,
      },
    })
    setImmediate(() => logAction(req.user.id, 'DRIVER_UPDATE', 'DRIVER', driver.id, { rating, available }))
    res.json(driver)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Onglet 5 : Codes d'invitation ────────────────────────────────────────

router.get('/invite-codes', ...commercialGuard, async (req, res) => {
  try {
    const codes = await prisma.inviteCode.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(codes)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/invite-codes', ...commercialGuard, async (req, res) => {
  const { count = 1 } = req.body
  try {
    const created = []
    for (let i = 0; i < Math.min(Number(count), 50); i++) {
      const code = `RIZ-${Math.random().toString(36).toUpperCase().slice(2, 9)}`
      const invite = await prisma.inviteCode.create({ data: { code } })
      created.push(invite)
    }
    res.status(201).json(created)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Onglet 6 : Abonnements ────────────────────────────────────────────────

router.get('/subscriptions', ...commercialGuard, async (req, res) => {
  try {
    const subs = await prisma.subscription.findMany({
      include: { shop: { select: { name: true, user: { select: { name: true, email: true } } } } },
      orderBy: { startDate: 'desc' },
    })
    res.json(subs)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/subscriptions/:id', ...guard, async (req, res) => {
  const { plan, status, endDate, amount } = req.body
  try {
    const sub = await prisma.subscription.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(plan !== undefined && { plan }),
        ...(status !== undefined && { status }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(amount !== undefined && { amount: Number(amount) }),
      },
      include: { shop: { select: { name: true, user: { select: { name: true, email: true } } } } },
    })
    setImmediate(() => logAction(req.user.id, 'SUBSCRIPTION_UPDATE', 'SUBSCRIPTION', sub.id, { plan, status, endDate, amount }))
    res.json(sub)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/subscriptions', ...guard, async (req, res) => {
  const { shopId, plan, amount, endDate } = req.body
  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    const defaultAmount = plan === 'CERTIFIED' ? (settings?.certifiedPlanPrice ?? 15000) : (settings?.basicPlanPrice ?? 0)
    const sub = await prisma.subscription.upsert({
      where: { shopId: Number(shopId) },
      update: { plan, status: 'ACTIVE', startDate: new Date(), endDate: endDate ? new Date(endDate) : null, amount: amount ?? defaultAmount },
      create: { shopId: Number(shopId), plan, status: 'ACTIVE', endDate: endDate ? new Date(endDate) : null, amount: amount ?? defaultAmount },
    })
    await prisma.shop.update({ where: { id: Number(shopId) }, data: { plan, certified: plan === 'CERTIFIED' } })
    setImmediate(() => logAction(req.user.id, 'SUBSCRIPTION_CREATE', 'SUBSCRIPTION', sub.id, { shopId, plan, amount: amount ?? defaultAmount }))
    res.status(201).json(sub)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/subscriptions/:id', ...guard, async (req, res) => {
  try {
    await prisma.subscription.update({ where: { id: Number(req.params.id) }, data: { status: 'CANCELLED' } })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/settings/plans', ...guard, async (req, res) => {
  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    res.json({
      basicPlanPrice:       settings?.basicPlanPrice      ?? 0,
      certifiedPlanPrice:   settings?.certifiedPlanPrice  ?? 15000,
      driverSubPrice:       settings?.driverSubPrice      ?? 5000,
      shopBasicFeatures:    settings?.shopBasicFeatures    ?? null,
      shopCertifiedFeatures: settings?.shopCertifiedFeatures ?? null,
      driverBasicFeatures:  settings?.driverBasicFeatures  ?? null,
      driverPremiumFeatures: settings?.driverPremiumFeatures ?? null,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Demandes de montée en plan ────────────────────────────────────────────

router.get('/plan-requests', ...commercialGuard, async (req, res) => {
  try {
    const { status, type } = req.query
    const where = {}
    if (status) where.status = status
    if (type) where.type = type
    const requests = await prisma.planUpgradeRequest.findMany({
      where,
      include: {
        shop:   { include: { user: { select: { name: true, email: true, phone: true } } } },
        driver: { include: { user: { select: { name: true, email: true, phone: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ requests })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/plan-requests/:id/approve', ...commercialGuard, async (req, res) => {
  try {
    const { adminNote } = req.body
    const request = await prisma.planUpgradeRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        shop:   { include: { user: { select: { id: true, name: true } } } },
        driver: { include: { user: { select: { id: true, name: true } } } },
      },
    })
    if (!request) return res.status(404).json({ error: 'Demande introuvable' })
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Demande déjà traitée' })

    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })

    if (request.type === 'SHOP') {
      const end = new Date(Date.now() + 365 * 24 * 3600 * 1000)
      const amount = request.amount ?? settings?.certifiedPlanPrice ?? 15000
      await prisma.$transaction([
        prisma.shop.update({ where: { id: request.shopId }, data: { plan: 'CERTIFIED', certified: true } }),
        prisma.subscription.upsert({
          where: { shopId: request.shopId },
          update: { plan: 'CERTIFIED', status: 'ACTIVE', startDate: new Date(), endDate: end, amount },
          create: { shopId: request.shopId, plan: 'CERTIFIED', status: 'ACTIVE', startDate: new Date(), endDate: end, amount },
        }),
        prisma.planUpgradeRequest.update({ where: { id: request.id }, data: { status: 'APPROVED', adminNote: adminNote || null } }),
      ])
      const targetUserId = request.shop?.user?.id
      if (targetUserId) {
        setImmediate(() => notify(targetUserId, 'PLAN_UPGRADE_APPROVED', '🎉 Certification approuvée !',
          'Votre boutique est maintenant certifiée. Le badge apparaît sur votre boutique.', { shopId: request.shopId }).catch(() => {}))
      }
    } else {
      await prisma.$transaction([
        prisma.driver.update({ where: { id: request.driverId }, data: { plan: 'PREMIUM' } }),
        prisma.planUpgradeRequest.update({ where: { id: request.id }, data: { status: 'APPROVED', adminNote: adminNote || null } }),
      ])
      const targetUserId = request.driver?.user?.id
      if (targetUserId) {
        setImmediate(() => notify(targetUserId, 'PLAN_UPGRADE_APPROVED', '🚀 Plan Premium activé !',
          'Votre plan Premium est actif. Votre taux de commission a augmenté.', { driverId: request.driverId }).catch(() => {}))
      }
    }
    setImmediate(() => logAction(req.user.id, 'PLAN_REQUEST_APPROVE', request.type, request.id, { adminNote }).catch(() => {}))
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/plan-requests/:id/reject', ...commercialGuard, async (req, res) => {
  try {
    const { adminNote } = req.body
    if (!adminNote?.trim()) return res.status(400).json({ error: 'Un motif de refus est requis.' })

    const request = await prisma.planUpgradeRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        shop:   { include: { user: { select: { id: true } } } },
        driver: { include: { user: { select: { id: true } } } },
      },
    })
    if (!request) return res.status(404).json({ error: 'Demande introuvable' })
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Demande déjà traitée' })

    await prisma.planUpgradeRequest.update({ where: { id: request.id }, data: { status: 'REJECTED', adminNote } })

    const targetUserId = request.type === 'SHOP' ? request.shop?.user?.id : request.driver?.user?.id
    if (targetUserId) {
      setImmediate(() => notify(targetUserId, 'PLAN_UPGRADE_REJECTED', 'Demande de plan refusée',
        `Motif : ${adminNote}`, { requestId: request.id }).catch(() => {}))
    }
    setImmediate(() => logAction(req.user.id, 'PLAN_REQUEST_REJECT', request.type, request.id, { adminNote }).catch(() => {}))
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Contrats ──────────────────────────────────────────────────────────────

router.get('/contracts', ...commercialGuard, async (req, res) => {
  try {
    const contracts = await prisma.contract.findMany({
      include: {
        shop:   { select: { id: true, name: true, user: { select: { name: true, email: true } } } },
        driver: { select: { id: true, user: { select: { name: true, email: true, phone: true } } } },
      },
      orderBy: { generatedAt: 'desc' },
    })
    // Flatten for frontend convenience
    const flat = contracts.map(c => ({
      ...c,
      shopName:   c.shop?.name       || null,
      driverName: c.driver?.user?.name || null,
    }))
    res.json({ contracts: flat })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/contracts/regenerate/shop/:id', ...commercialGuard, async (req, res) => {
  try {
    const { generateShopContract } = require('../services/contractGenerator')
    const shop = await prisma.shop.findUnique({ where: { id: Number(req.params.id) } })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })
    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    const owner = await prisma.user.findUnique({ where: { id: shop.userId } })
    const contractContent = generateShopContract(shop, settings || {}, owner)
    const contract = await prisma.contract.upsert({
      where: { shopId: shop.id },
      update: { content: contractContent, status: 'PENDING_SIGNATURE', generatedAt: new Date(), signedAt: null },
      create: { type: 'SHOP', shopId: shop.id, content: contractContent, status: 'PENDING_SIGNATURE' },
    })
    await prisma.shop.update({ where: { id: shop.id }, data: { contractSigned: false } })
    res.json(contract)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/contracts/regenerate/driver/:id', ...commercialGuard, async (req, res) => {
  try {
    const { generateDriverContract } = require('../services/contractGenerator')
    const driver = await prisma.driver.findUnique({
      where: { id: Number(req.params.id) },
      include: { user: { select: { name: true, email: true, phone: true } } },
    })
    if (!driver) return res.status(404).json({ error: 'Livreur introuvable' })
    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    const contractContent = generateDriverContract(driver, settings || {}, driver.user)
    const contract = await prisma.contract.upsert({
      where: { driverId: driver.id },
      update: { content: contractContent, status: 'PENDING_SIGNATURE', generatedAt: new Date(), signedAt: null },
      create: { type: 'DRIVER', driverId: driver.id, content: contractContent, status: 'PENDING_SIGNATURE' },
    })
    await prisma.driver.update({ where: { id: driver.id }, data: { contractSigned: false } })
    res.json(contract)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Onglet 7 : Paramètres plateforme ─────────────────────────────────────

router.get('/settings', ...guard, async (req, res) => {
  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    res.json(settings)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/settings', ...guard, async (req, res) => {
  try {
    const { id, createdAt, updatedAt, ...data } = req.body
    // Ces deux champs sont injectés tels quels dans un <script> côté frontend
    // (tags Google Analytics / Facebook Pixel) — un format libre ouvrirait une
    // XSS stockée servie à chaque visiteur du site. On les restreint à leur
    // format attendu.
    if (data.seoGoogleId && !/^(G|GT|UA)-[A-Za-z0-9-]+$/.test(data.seoGoogleId)) {
      return res.status(400).json({ error: 'Format Google Analytics ID invalide (attendu : G-XXXXXXX)' })
    }
    if (data.seoFbPixelId && !/^\d+$/.test(data.seoFbPixelId)) {
      return res.status(400).json({ error: 'Format Facebook Pixel ID invalide (numérique uniquement)' })
    }
    const settings = await prisma.platformSettings.upsert({
      where: { id: 1 },
      update: { ...data, updatedAt: new Date() },
      create: { id: 1, ...data },
    })
    setImmediate(() => logAction(req.user.id, 'SETTINGS_UPDATE', 'SETTINGS', 1, data))
    res.json(settings)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Journal d'audit ──────────────────────────────────────────────────────

router.get('/audit-logs', ...guard, async (req, res) => {
  try {
    const logs = await prisma.adminLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    // Enrichir avec le nom de l'admin
    const adminIds = [...new Set(logs.map(l => l.adminId))]
    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, name: true },
    })
    const adminMap = Object.fromEntries(admins.map(a => [a.id, a.name]))
    res.json(logs.map(l => ({ ...l, adminName: adminMap[l.adminId] || 'Admin' })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Onglet 8 : Analytique globale ────────────────────────────────────────

router.get('/global-analytics', ...guard, async (req, res) => {
  try {
    // Répartition géographique simulée (basée sur les boutiques)
    const shopsByLocation = await prisma.shop.groupBy({ by: ['location'], _count: { id: true } })

    // Produits par catégorie
    const productsByCategory = await prisma.product.groupBy({
      by: ['category'],
      _count: { id: true },
      _sum: { stock: true },
    })

    // Taux de livraison
    const [total, delivered, cancelled] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
    ])

    // Performance livreurs top 10
    const topDrivers = await prisma.driver.findMany({
      orderBy: { totalDeliveries: 'desc' },
      take: 10,
      include: { user: { select: { name: true } } },
    })

    // Moyennes plateforme livreurs (pour comparaison)
    const driverPlatformAvg = await prisma.driver.aggregate({
      where: { status: 'ACTIVE' },
      _avg: { rating: true, acceptanceRate: true, totalDeliveries: true },
    })

    // Note moyenne globale boutiques
    const shopRatingAvg = await prisma.shop.aggregate({
      where: { status: 'ACTIVE' },
      _avg: { rating: true },
    })

    res.json({
      shopsByLocation,
      productsByCategory,
      deliveryRate: total ? Math.round((delivered / total) * 100) : 0,
      cancellationRate: total ? Math.round((cancelled / total) * 100) : 0,
      topDrivers,
      platformAvg: {
        driverRating: Math.round((driverPlatformAvg._avg?.rating || 4.0) * 10) / 10,
        driverAcceptance: Math.round((driverPlatformAvg._avg?.acceptanceRate || 0.75) * 100),
        shopRating: Math.round((shopRatingAvg._avg?.rating || 4.0) * 10) / 10,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Gestion utilisateurs ──────────────────────────────────────────────────

router.get('/users', ...guard, async (req, res) => {
  const { role, search, limit = 50, offset = 0 } = req.query
  try {
    const where = {}
    if (role) where.role = role
    if (search) where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ]
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, banned: true },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.user.count({ where }),
    ])
    res.json({ users, total })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/users/create-commercial', ...guard, async (req, res) => {
  const { name, email, password, phone } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email et password sont requis' })
  try {
    const bcrypt = require('bcryptjs')
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ error: 'Email déjà utilisé' })
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hash, name, phone: phone || null, role: 'COMMERCIAL' },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, banned: false },
    })
    setImmediate(() => logAction(req.user.id, 'CREATE_COMMERCIAL', 'USER', user.id, { name, email }))
    res.status(201).json(user)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/users/:id', ...guard, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: Number(req.params.id) } })
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' })
    if (target.role === 'ADMIN') return res.status(403).json({ error: 'Impossible de supprimer un compte admin' })
    try {
      await prisma.user.delete({ where: { id: Number(req.params.id) } })
    } catch (e) {
      // P2003 : l'utilisateur a des données liées (boutique, commandes, litiges...) protégées
      // par une contrainte de clé étrangère RESTRICT — on ne supprime jamais silencieusement
      // l'historique commercial/financier d'un compte. Utiliser la suspension à la place.
      if (e.code === 'P2003') return res.status(409).json({
        error: 'Ce compte a des données liées (boutique, commandes, litiges...) et ne peut pas être supprimé définitivement. Suspendez-le à la place.',
      })
      throw e
    }
    setImmediate(() => logAction(req.user.id, 'USER_DELETE', 'USER', Number(req.params.id), { name: target.name, role: target.role }))
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/users/:id/ban', ...guard, async (req, res) => {
  const { banned } = req.body
  try {
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { banned: Boolean(banned) },
      select: { id: true, name: true, banned: true },
    })
    setImmediate(() => logAction(req.user.id, banned ? 'USER_BAN' : 'USER_UNBAN', 'USER', user.id, { userName: user.name }))
    res.json(user)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Finance ───────────────────────────────────────────────────────────────

router.get('/finance', ...guard, async (req, res) => {
  try {
    const settings = await getSettings()
    const rate = settings.commissionRate
    const deliveryShare = settings.driverCommission

    const [totalRevAgg, monthRevAgg, deliveredCount, totalDeliveryAgg] = await Promise.all([
      prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { total: true, deliveryFee: true } }),
      prisma.order.aggregate({
        where: { status: 'DELIVERED', createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        _sum: { total: true, deliveryFee: true },
      }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { deliveryFee: true } }),
    ])

    const totalGMV = totalRevAgg._sum.total || 0
    const monthGMV = monthRevAgg._sum.total || 0
    const totalDeliveryFees = totalDeliveryAgg._sum.deliveryFee || 0
    const platformCommission = Math.round(totalGMV * rate)
    const driverPayouts = Math.round(totalDeliveryFees * deliveryShare)
    const netRevenue = platformCommission + Math.round(totalDeliveryFees * (1 - deliveryShare))

    // Monthly breakdown (last 6 months)
    const now = new Date()
    const monthly = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const agg = await prisma.order.aggregate({
        where: { status: 'DELIVERED', createdAt: { gte: d, lt: end } },
        _sum: { total: true, deliveryFee: true },
      })
      monthly.push({
        month: d.toLocaleString('fr-FR', { month: 'short' }),
        gmv: agg._sum.total || 0,
        commission: Math.round((agg._sum.total || 0) * rate),
        deliveryFees: agg._sum.deliveryFee || 0,
      })
    }

    res.json({ totalGMV, monthGMV, platformCommission, driverPayouts, netRevenue, deliveredCount, monthly, rate, deliveryShare: deliveryShare })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Fiche de paie livreur ─────────────────────────────────────────────────

router.get('/drivers/:id/payslip', ...commercialGuard, async (req, res) => {
  const { period = 'weekly' } = req.query
  const driverId = Number(req.params.id)

  const now = new Date()
  let startDate

  if (period === 'daily') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  } else if (period === 'weekly') {
    const day = now.getDay() // 0=dim … 6=sam
    const diff = day === 0 ? -6 : 1 - day // lundi
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 0, 0, 0)
  } else { // monthly
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
  }

  try {
    const [settings, driver] = await Promise.all([
      getSettings(),
      prisma.driver.findUnique({
        where: { id: driverId },
        include: { user: { select: { name: true, email: true, phone: true } } },
      }),
    ])
    if (!driver) return res.status(404).json({ error: 'Livreur introuvable' })

    const driverShare   = driverRate(settings, driver.plan)
    const platformShare = 1 - driverShare

    // Toutes les commandes livrées dans la période
    const orders = await prisma.order.findMany({
      where: {
        driverId,
        status: 'DELIVERED',
        updatedAt: { gte: startDate, lte: now },
      },
      include: {
        buyer: { select: { name: true } },
        shop:  { select: { name: true } },
        statusHistory: {
          where: { status: 'DELIVERED' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const totalDeliveries    = orders.length
    const grossDeliveryFees  = orders.reduce((s, o) => s + (o.deliveryFee || 0), 0)
    const driverEarnings     = Math.round(grossDeliveryFees * driverShare)
    const platformEarnings   = Math.round(grossDeliveryFees * platformShare)

    res.json({
      driver,
      period,
      startDate,
      endDate: now,
      totalDeliveries,
      grossDeliveryFees,
      driverShare,
      platformShare,
      driverEarnings,
      platformEarnings,
      orders: orders.map(o => ({
        id:            o.id,
        deliveredAt:   o.statusHistory?.[0]?.createdAt || o.updatedAt,
        buyer:         o.buyer?.name || '—',
        shop:          o.shop?.name  || '—',
        orderTotal:    o.total       || 0,
        deliveryFee:   o.deliveryFee || 0,
        driverEarning: Math.round((o.deliveryFee || 0) * driverShare),
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Fiche de paie vendeur ──────────────────────────────────────────────────

router.get('/shops/:id/payslip', ...commercialGuard, async (req, res) => {
  const { period = 'weekly' } = req.query
  const shopId = Number(req.params.id)

  const now = new Date()
  let startDate

  if (period === 'daily') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  } else if (period === 'weekly') {
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 0, 0, 0)
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
  }

  try {
    const [settings, shop] = await Promise.all([
      getSettings(),
      prisma.shop.findUnique({
        where: { id: shopId },
        include: { user: { select: { name: true, email: true, phone: true } } },
      }),
    ])
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })

    const commissionRate = settings.commissionRate

    const orders = await prisma.order.findMany({
      where: {
        shopId,
        status: 'DELIVERED',
        updatedAt: { gte: startDate, lte: now },
      },
      include: {
        buyer: { select: { name: true } },
        statusHistory: {
          where: { status: 'DELIVERED' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const totalOrders      = orders.length
    const grossRevenue     = orders.reduce((s, o) => s + (o.total || 0), 0)
    const platformFees     = Math.round(grossRevenue * commissionRate)
    const vendorEarnings   = grossRevenue - platformFees

    res.json({
      shop,
      period,
      startDate,
      endDate: now,
      totalOrders,
      grossRevenue,
      commissionRate,
      platformFees,
      vendorEarnings,
      orders: orders.map(o => ({
        id:            o.id,
        deliveredAt:   o.statusHistory?.[0]?.createdAt || o.updatedAt,
        buyer:         o.buyer?.name || '—',
        orderTotal:    o.total       || 0,
        platformFee:   Math.round((o.total || 0) * commissionRate),
        vendorNet:     Math.round((o.total || 0) * (1 - commissionRate)),
        createdAt:     o.createdAt,
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Logistique — LOT 4 : architecture (arbitrage Décision 6, Option B) ─────
// Référentiels administrés (catégories de véhicule, zones, hubs). Non lus
// par le moteur d'affectation ni la tarification à ce lot — posent le
// schéma pour les lots suivants (LOT5/LOT6).

// maxDeliveryFee (LOT6) : plafond de frais propre à chaque catégorie — MOTO
// reprend le plafond global historique (8000) pour ne rien changer au cas
// majoritaire ; les catégories plus grandes ont un plafond plus haut pour
// que le poids reste significatif au-delà de ~300 kg (constat de l'audit).
const DEFAULT_VEHICLE_TYPES = [
  { code: 'VELO',        label: 'Vélo',        capacityKg: 20,   maxDeliveryFee: 3000 },
  { code: 'MOTO',        label: 'Moto',        capacityKg: 50,   maxDeliveryFee: 8000 },
  { code: 'TRICYCLE',    label: 'Tricycle',    capacityKg: 300,  maxDeliveryFee: 15000 },
  { code: 'VOITURE',     label: 'Voiture',     capacityKg: 400,  maxDeliveryFee: 20000 },
  { code: 'CAMIONNETTE', label: 'Camionnette', capacityKg: 1500, maxDeliveryFee: 50000 },
]

// Même logique que getSettings() (lib/settings.js) : jamais de valeur codée
// en dur consommée directement, on s'assure juste qu'un jeu de départ
// exploitable existe avant de le lire. `code` étant unique, une double
// initialisation concurrente ne crée pas de doublons (la 2e upsert échoue
// silencieusement en no-op sur update:{}).
async function ensureDefaultVehicleTypes() {
  const count = await prisma.vehicleType.count()
  if (count > 0) return
  for (const vt of DEFAULT_VEHICLE_TYPES) {
    await prisma.vehicleType.upsert({ where: { code: vt.code }, update: {}, create: vt })
  }
}

router.get('/logistics/vehicle-types', ...guard, async (req, res) => {
  try {
    await ensureDefaultVehicleTypes()
    const vehicleTypes = await prisma.vehicleType.findMany({ orderBy: { capacityKg: 'asc' } })
    res.json({ vehicleTypes })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/logistics/vehicle-types', ...guard, async (req, res) => {
  const { code, label, capacityKg, maxDeliveryFee } = req.body
  if (!code || !label || !(capacityKg > 0)) {
    return res.status(400).json({ error: 'code, label et capacityKg (> 0) sont requis' })
  }
  try {
    const vehicleType = await prisma.vehicleType.create({
      data: {
        code: String(code).toUpperCase().trim(), label, capacityKg: Number(capacityKg),
        maxDeliveryFee: maxDeliveryFee != null ? Number(maxDeliveryFee) : null,
      },
    })
    setImmediate(() => logAction(req.user.id, 'VEHICLE_TYPE_CREATE', 'VehicleType', vehicleType.id, { code, label, capacityKg, maxDeliveryFee }))
    res.status(201).json({ vehicleType })
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Ce code existe déjà' })
    res.status(500).json({ error: e.message })
  }
})

router.put('/logistics/vehicle-types/:id', ...guard, async (req, res) => {
  const { label, capacityKg, active, maxDeliveryFee } = req.body
  try {
    const vehicleType = await prisma.vehicleType.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(label !== undefined && { label }),
        ...(capacityKg !== undefined && { capacityKg: Number(capacityKg) }),
        ...(active !== undefined && { active: Boolean(active) }),
        ...(maxDeliveryFee !== undefined && { maxDeliveryFee: maxDeliveryFee === null ? null : Number(maxDeliveryFee) }),
      },
    })
    setImmediate(() => logAction(req.user.id, 'VEHICLE_TYPE_UPDATE', 'VehicleType', vehicleType.id, req.body))
    res.json({ vehicleType })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Catégorie introuvable' })
    res.status(500).json({ error: e.message })
  }
})

router.delete('/logistics/vehicle-types/:id', ...guard, async (req, res) => {
  try {
    await prisma.vehicleType.delete({ where: { id: Number(req.params.id) } })
    setImmediate(() => logAction(req.user.id, 'VEHICLE_TYPE_DELETE', 'VehicleType', Number(req.params.id), {}))
    res.status(204).end()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Catégorie introuvable' })
    res.status(500).json({ error: e.message })
  }
})

router.get('/logistics/zones', ...guard, async (req, res) => {
  try {
    const zones = await prisma.zone.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { shops: true, hubs: true } } },
    })
    res.json({ zones })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/logistics/zones', ...guard, async (req, res) => {
  const { name, city } = req.body
  if (!name) return res.status(400).json({ error: 'name est requis' })
  try {
    const zone = await prisma.zone.create({ data: { name, city: city || null } })
    setImmediate(() => logAction(req.user.id, 'ZONE_CREATE', 'Zone', zone.id, { name, city }))
    res.status(201).json({ zone })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/logistics/zones/:id', ...guard, async (req, res) => {
  const { name, city, active } = req.body
  try {
    const zone = await prisma.zone.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(city !== undefined && { city }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    })
    setImmediate(() => logAction(req.user.id, 'ZONE_UPDATE', 'Zone', zone.id, req.body))
    res.json({ zone })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Zone introuvable' })
    res.status(500).json({ error: e.message })
  }
})

router.delete('/logistics/zones/:id', ...guard, async (req, res) => {
  try {
    // Zone.shops / Zone.hubs sont des relations optionnelles (ON DELETE SET NULL) :
    // supprimer une zone détache les boutiques/hubs qui y étaient rattachés,
    // elle ne les supprime jamais.
    await prisma.zone.delete({ where: { id: Number(req.params.id) } })
    setImmediate(() => logAction(req.user.id, 'ZONE_DELETE', 'Zone', Number(req.params.id), {}))
    res.status(204).end()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Zone introuvable' })
    res.status(500).json({ error: e.message })
  }
})

router.get('/logistics/hubs', ...guard, async (req, res) => {
  try {
    const hubs = await prisma.hub.findMany({ orderBy: { name: 'asc' }, include: { zone: true } })
    res.json({ hubs })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/logistics/hubs', ...guard, async (req, res) => {
  const { name, address, zoneId, latitude, longitude } = req.body
  if (!name || !address) return res.status(400).json({ error: 'name et address sont requis' })
  try {
    const hub = await prisma.hub.create({
      data: {
        name, address,
        zoneId: zoneId ? Number(zoneId) : null,
        latitude: latitude !== undefined ? Number(latitude) : null,
        longitude: longitude !== undefined ? Number(longitude) : null,
      },
    })
    setImmediate(() => logAction(req.user.id, 'HUB_CREATE', 'Hub', hub.id, { name, address, zoneId }))
    res.status(201).json({ hub })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/logistics/hubs/:id', ...guard, async (req, res) => {
  const { name, address, zoneId, latitude, longitude, active } = req.body
  try {
    const hub = await prisma.hub.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(zoneId !== undefined && { zoneId: zoneId ? Number(zoneId) : null }),
        ...(latitude !== undefined && { latitude: latitude === null ? null : Number(latitude) }),
        ...(longitude !== undefined && { longitude: longitude === null ? null : Number(longitude) }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    })
    setImmediate(() => logAction(req.user.id, 'HUB_UPDATE', 'Hub', hub.id, req.body))
    res.json({ hub })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Hub introuvable' })
    res.status(500).json({ error: e.message })
  }
})

router.delete('/logistics/hubs/:id', ...guard, async (req, res) => {
  try {
    await prisma.hub.delete({ where: { id: Number(req.params.id) } })
    setImmediate(() => logAction(req.user.id, 'HUB_DELETE', 'Hub', Number(req.params.id), {}))
    res.status(204).end()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Hub introuvable' })
    res.status(500).json({ error: e.message })
  }
})

// ─── Logistique — LOT 11 : réconciliation Comptabilité ↔ Logistique ────────
// (arbitrage Décision 2, Option B) — les deux sources restent distinctes
// (aucune donnée supprimée), mais deviennent enfin comparables au même
// endroit : DriverMetric.earnings (cumul temps réel côté logistique,
// jamais validé par personne) contre Remuneration.netAmount (calculé,
// validé puis payé par la comptabilité — la source officielle) pour la
// même période. Ne modifie ni l'un ni l'autre, purement un outil de lecture
// pour repérer les écarts et les périodes jamais encore traitées côté
// comptabilité (officialStatus === 'NON_CALCULE').
router.get('/logistics/earnings-reconciliation', ...guard, async (req, res) => {
  const now = new Date()
  const month = Number(req.query.month) || (now.getMonth() + 1)
  const year = Number(req.query.year) || now.getFullYear()
  if (month < 1 || month > 12) return res.status(400).json({ error: 'month doit être entre 1 et 12' })

  try {
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 1)

    const [metrics, remunerations] = await Promise.all([
      prisma.driverMetric.findMany({
        where: { month, year },
        include: { driver: { include: { user: { select: { id: true, name: true } } } } },
        orderBy: { earnings: 'desc' },
      }),
      // Chevauchement de période plutôt qu'égalité stricte : periodStart/
      // periodEnd d'une Remuneration sont choisis librement au calcul (§13
      // comptabilité), pas forcément calés sur un mois civil.
      prisma.remuneration.findMany({
        where: {
          beneficiaryType: 'DRIVER',
          periodStart: { lt: monthEnd },
          periodEnd: { gte: monthStart },
          status: { notIn: ['REJECTED', 'CANCELLED'] },
        },
      }),
    ])

    const byBeneficiary = {}
    for (const r of remunerations) {
      (byBeneficiary[r.beneficiaryUserId] ||= []).push(r)
    }

    const rows = metrics.map(m => {
      const records = byBeneficiary[m.driver.user.id] || []
      const officialAmount = records.reduce((s, r) => s + r.netAmount, 0)
      const officialPaid = records.filter(r => r.status === 'PAID').reduce((s, r) => s + r.netAmount, 0)
      return {
        driverId: m.driverId,
        driverName: m.driver.user.name,
        deliveries: m.deliveries,
        logisticsEstimate: m.earnings,
        officialAmount,
        officialPaid,
        officialStatus: records.length ? [...new Set(records.map(r => r.status))].join(', ') : 'NON_CALCULE',
        delta: Math.round((m.earnings - officialAmount) * 100) / 100,
      }
    })

    res.json({ month, year, rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
