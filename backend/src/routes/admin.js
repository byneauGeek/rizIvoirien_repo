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
const { ensureDefaultVehicleTypes } = require('../lib/vehicleTypes')

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

// LOT 8 (Arbitrage XXX RIZ, "cohérence logistique ↔ finance ↔ rémunération") :
// avant ce lot, ce tableau de bord n'agrégeait que les Order (B2C) — une
// transaction B2B livrée (needsLogistics=true, deliveryFee réellement facturé
// et réellement payé au livreur via payDriverForDelivery, voir
// deliveryLifecycle.js) était totalement absente d'ici, alors même que
// Driver.monthlyEarnings/DriverMetric.earnings l'incluaient déjà. driverPayouts
// et netRevenue sous-estimaient donc systématiquement la réalité dès qu'un
// livreur faisait des livraisons B2B. La commission plateforme (rate),
// elle, reste calculée sur le GMV B2C uniquement — le B2B n'a pas de
// commission sur la valeur d'échange (modèle différent, confirmé à l'audit :
// seule la logistique B2B génère un revenu plateforme).
router.get('/finance', ...guard, async (req, res) => {
  try {
    const settings = await getSettings()
    const rate = settings.commissionRate
    const deliveryShare = settings.driverCommission

    const [totalRevAgg, monthRevAgg, deliveredCount, totalDeliveryAgg, b2bDeliveryAgg] = await Promise.all([
      prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { total: true, deliveryFee: true } }),
      prisma.order.aggregate({
        where: { status: 'DELIVERED', createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        _sum: { total: true, deliveryFee: true },
      }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { deliveryFee: true } }),
      prisma.b2BTransaction.aggregate({ where: { status: 'DELIVERED', needsLogistics: true }, _sum: { deliveryFee: true } }),
    ])

    const totalGMV = totalRevAgg._sum.total || 0
    const monthGMV = monthRevAgg._sum.total || 0
    const b2cDeliveryFees = totalDeliveryAgg._sum.deliveryFee || 0
    const b2bDeliveryFees = b2bDeliveryAgg._sum.deliveryFee || 0
    const totalDeliveryFees = b2cDeliveryFees + b2bDeliveryFees
    const platformCommission = Math.round(totalGMV * rate)
    const driverPayouts = Math.round(totalDeliveryFees * deliveryShare)
    const netRevenue = platformCommission + Math.round(totalDeliveryFees * (1 - deliveryShare))

    // Monthly breakdown (last 6 months)
    const now = new Date()
    const monthly = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const [agg, b2bAgg] = await Promise.all([
        prisma.order.aggregate({
          where: { status: 'DELIVERED', createdAt: { gte: d, lt: end } },
          _sum: { total: true, deliveryFee: true },
        }),
        prisma.b2BTransaction.aggregate({
          where: { status: 'DELIVERED', needsLogistics: true, createdAt: { gte: d, lt: end } },
          _sum: { deliveryFee: true },
        }),
      ])
      monthly.push({
        month: d.toLocaleString('fr-FR', { month: 'short' }),
        gmv: agg._sum.total || 0,
        commission: Math.round((agg._sum.total || 0) * rate),
        deliveryFees: (agg._sum.deliveryFee || 0) + (b2bAgg._sum.deliveryFee || 0),
      })
    }

    res.json({
      totalGMV, monthGMV, platformCommission, driverPayouts, netRevenue, deliveredCount, monthly, rate, deliveryShare: deliveryShare,
      b2cDeliveryFees, b2bDeliveryFees, totalDeliveryFees,
    })
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

    // LOT 8 (Arbitrage XXX RIZ) : avant ce lot, la fiche de paie ne listait
    // que des Order (B2C) — un livreur ayant fait des livraisons B2B pendant
    // la période voyait une fiche INCOHÉRENTE avec ce qu'il a réellement
    // touché (Driver.monthlyEarnings/DriverMetric.earnings, déjà crédités par
    // payDriverForDelivery pour le B2B aussi). Le driverId vit sur Shipment,
    // pas sur B2BTransaction — d'où la requête via Shipment plutôt qu'un
    // findMany direct sur b2BTransaction.
    const b2bShipments = await prisma.shipment.findMany({
      where: {
        driverId, status: 'DELIVERED', b2bTransactionId: { not: null },
        updatedAt: { gte: startDate, lte: now },
      },
      include: { b2bTransaction: { include: { buyer: { select: { name: true } }, seller: { select: { name: true } } } } },
      orderBy: { updatedAt: 'desc' },
    })

    const grossDeliveryFeesB2C = orders.reduce((s, o) => s + (o.deliveryFee || 0), 0)
    const grossDeliveryFeesB2B = b2bShipments.reduce((s, sh) => s + (sh.b2bTransaction?.deliveryFee || 0), 0)
    const grossDeliveryFees    = grossDeliveryFeesB2C + grossDeliveryFeesB2B
    const totalDeliveries      = orders.length + b2bShipments.length
    const driverEarnings       = Math.round(grossDeliveryFees * driverShare)
    const platformEarnings     = Math.round(grossDeliveryFees * platformShare)

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
      b2bDeliveries: b2bShipments.map(sh => ({
        id:            sh.b2bTransactionId,
        deliveredAt:   sh.updatedAt,
        buyer:         sh.b2bTransaction?.buyer?.name  || '—',
        seller:        sh.b2bTransaction?.seller?.name || '—',
        deliveryFee:   sh.b2bTransaction?.deliveryFee  || 0,
        driverEarning: Math.round((sh.b2bTransaction?.deliveryFee || 0) * driverShare),
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

// ─── Logistique — LOT 6 (Arbitrage XXX RIZ) : grille tarifaire ─────────────
// Administration de PricingRule (segment × serviceLevel × corridor de zones).
// C'est ce qui rend la tarification RÉELLEMENT branchée plutôt que mockée :
// tant qu'aucune règle n'existe, deliveryService/pricingEngine retombent sur
// l'ancien forfait (VehicleType/PlatformSettings) — cette grille est donc
// strictement additive, jamais un pré-requis pour que la plateforme continue
// de fonctionner.
const VALID_PRICING_SEGMENTS = ['SMALL_MEDIUM', 'B2B_CARGO']
const VALID_PRICING_SERVICE_LEVELS = ['ECONOMIC', 'STANDARD', 'EXPRESS']

router.get('/logistics/pricing-rules', ...guard, async (req, res) => {
  try {
    const pricingRules = await prisma.pricingRule.findMany({
      orderBy: [{ segment: 'asc' }, { serviceLevel: 'asc' }],
      include: { originZone: { select: { id: true, name: true } }, destinationZone: { select: { id: true, name: true } } },
    })
    res.json({ pricingRules })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/logistics/pricing-rules', ...guard, async (req, res) => {
  const {
    segment, serviceLevel, originZoneId, destinationZoneId,
    basePrice, pricePerKg, pricePerKm, pricePerPackage, pricePerExtraOrigin, pricePerExtraStop,
    marginPct, maxDeliveryFee,
  } = req.body
  if (!VALID_PRICING_SEGMENTS.includes(segment)) return res.status(400).json({ error: 'segment invalide' })
  if (!VALID_PRICING_SERVICE_LEVELS.includes(serviceLevel)) return res.status(400).json({ error: 'serviceLevel invalide' })
  if (!(basePrice >= 0)) return res.status(400).json({ error: 'basePrice (>= 0) requis' })

  const normOriginZoneId = originZoneId ? Number(originZoneId) : null
  const normDestinationZoneId = destinationZoneId ? Number(destinationZoneId) : null

  try {
    // Un joker complet (origine ET destination null) n'est pas couvert par la
    // contrainte UNIQUE de la table (NULL != NULL en SQL) — contrôlé ici.
    if (normOriginZoneId == null && normDestinationZoneId == null) {
      const existingWildcard = await prisma.pricingRule.findFirst({
        where: { segment, serviceLevel, originZoneId: null, destinationZoneId: null },
      })
      if (existingWildcard) return res.status(409).json({ error: 'Une règle par défaut (sans corridor précis) existe déjà pour ce segment/niveau de service' })
    }

    const pricingRule = await prisma.pricingRule.create({
      data: {
        segment, serviceLevel,
        originZoneId: normOriginZoneId, destinationZoneId: normDestinationZoneId,
        basePrice: Number(basePrice),
        pricePerKg: pricePerKg != null ? Number(pricePerKg) : 0,
        pricePerKm: pricePerKm != null ? Number(pricePerKm) : 0,
        pricePerPackage: pricePerPackage != null ? Number(pricePerPackage) : 0,
        pricePerExtraOrigin: pricePerExtraOrigin != null ? Number(pricePerExtraOrigin) : 0,
        pricePerExtraStop: pricePerExtraStop != null ? Number(pricePerExtraStop) : 0,
        marginPct: marginPct != null ? Number(marginPct) : 0.20,
        maxDeliveryFee: maxDeliveryFee != null && maxDeliveryFee !== '' ? Number(maxDeliveryFee) : null,
      },
    })
    setImmediate(() => logAction(req.user.id, 'PRICING_RULE_CREATE', 'PricingRule', pricingRule.id, req.body))
    res.status(201).json({ pricingRule })
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Une règle existe déjà pour ce segment/niveau de service/corridor' })
    res.status(500).json({ error: e.message })
  }
})

router.put('/logistics/pricing-rules/:id', ...guard, async (req, res) => {
  const {
    basePrice, pricePerKg, pricePerKm, pricePerPackage, pricePerExtraOrigin, pricePerExtraStop,
    marginPct, maxDeliveryFee, active,
  } = req.body
  try {
    const pricingRule = await prisma.pricingRule.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(basePrice !== undefined && { basePrice: Number(basePrice) }),
        ...(pricePerKg !== undefined && { pricePerKg: Number(pricePerKg) }),
        ...(pricePerKm !== undefined && { pricePerKm: Number(pricePerKm) }),
        ...(pricePerPackage !== undefined && { pricePerPackage: Number(pricePerPackage) }),
        ...(pricePerExtraOrigin !== undefined && { pricePerExtraOrigin: Number(pricePerExtraOrigin) }),
        ...(pricePerExtraStop !== undefined && { pricePerExtraStop: Number(pricePerExtraStop) }),
        ...(marginPct !== undefined && { marginPct: Number(marginPct) }),
        ...(maxDeliveryFee !== undefined && { maxDeliveryFee: maxDeliveryFee === null || maxDeliveryFee === '' ? null : Number(maxDeliveryFee) }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    })
    setImmediate(() => logAction(req.user.id, 'PRICING_RULE_UPDATE', 'PricingRule', pricingRule.id, req.body))
    res.json({ pricingRule })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Règle tarifaire introuvable' })
    res.status(500).json({ error: e.message })
  }
})

router.delete('/logistics/pricing-rules/:id', ...guard, async (req, res) => {
  try {
    await prisma.pricingRule.delete({ where: { id: Number(req.params.id) } })
    setImmediate(() => logAction(req.user.id, 'PRICING_RULE_DELETE', 'PricingRule', Number(req.params.id), {}))
    res.status(204).end()
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Règle tarifaire introuvable' })
    res.status(500).json({ error: e.message })
  }
})

// ─── Logistique — LOT 7 (Arbitrage XXX RIZ) : tournées multi-arrêts (MVP) ──
// Une Route ne fait QUE grouper des Shipment déjà existants (créés
// normalement, driver déjà assigné) et suivre leur ordre de passage — PAS de
// VRP/optimisation, l'admin choisit et ordonne manuellement. La livraison
// réelle (OTP/QR, paiement) continue de passer par les routes existantes
// PUT /drivers/delivery/(b2b/):id/status, inchangées.
router.get('/logistics/routes', ...guard, async (req, res) => {
  const { driverId, status } = req.query
  try {
    const routes = await prisma.route.findMany({
      where: {
        ...(driverId && { driverId: Number(driverId) }),
        ...(status && { status }),
      },
      include: {
        driver: { select: { id: true, user: { select: { name: true } } } },
        stops: { orderBy: { order: 'asc' }, include: { shipment: { select: { id: true, status: true, dropoffAddress: true, orderId: true, b2bTransactionId: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ routes })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/logistics/routes/:id', ...guard, async (req, res) => {
  try {
    const route = await prisma.route.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        driver: { select: { id: true, user: { select: { name: true, phone: true } } } },
        stops: { orderBy: { order: 'asc' }, include: { shipment: true } },
      },
    })
    if (!route) return res.status(404).json({ error: 'Tournée introuvable' })
    res.json({ route })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/logistics/routes', ...guard, async (req, res) => {
  const { driverId } = req.body
  if (!driverId) return res.status(400).json({ error: 'driverId requis' })
  try {
    const driver = await prisma.driver.findUnique({ where: { id: Number(driverId) } })
    if (!driver) return res.status(404).json({ error: 'Livreur introuvable' })
    const route = await prisma.route.create({ data: { driverId: Number(driverId) } })
    setImmediate(() => logAction(req.user.id, 'ROUTE_CREATE', 'Route', route.id, { driverId }))
    res.status(201).json({ route })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Un Shipment ajouté à une tournée doit déjà être assigné au MÊME livreur —
// une Route ne réassigne jamais un Shipment, elle groupe des Shipment déjà
// affectés (voir POST /logistics/b2b/:id/assign, offres acceptées côté B2C).
router.post('/logistics/routes/:id/stops', ...guard, async (req, res) => {
  const { shipmentId, order } = req.body
  if (!shipmentId || !(order > 0)) return res.status(400).json({ error: 'shipmentId et order (> 0) requis' })
  try {
    const route = await prisma.route.findUnique({ where: { id: Number(req.params.id) } })
    if (!route) return res.status(404).json({ error: 'Tournée introuvable' })
    if (['COMPLETED', 'CANCELLED'].includes(route.status)) return res.status(400).json({ error: 'Cette tournée est déjà terminée' })

    const shipment = await prisma.shipment.findUnique({ where: { id: Number(shipmentId) } })
    if (!shipment) return res.status(404).json({ error: 'Livraison introuvable' })
    if (shipment.driverId !== route.driverId) return res.status(400).json({ error: 'Cette livraison n\'est pas assignée au livreur de la tournée' })
    if (['DELIVERED', 'FAILED', 'CANCELLED'].includes(shipment.status)) return res.status(400).json({ error: 'Cette livraison est déjà terminée' })

    const stop = await prisma.routeStop.create({ data: { routeId: route.id, shipmentId: Number(shipmentId), order: Number(order) } })
    setImmediate(() => logAction(req.user.id, 'ROUTE_STOP_ADD', 'RouteStop', stop.id, { routeId: route.id, shipmentId, order }))
    res.status(201).json({ stop })
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Cette livraison est déjà dans une tournée, ou cet ordre est déjà pris sur cette tournée' })
    res.status(500).json({ error: e.message })
  }
})

router.put('/logistics/routes/:id/stops/:stopId', ...guard, async (req, res) => {
  const { order } = req.body
  if (!(order > 0)) return res.status(400).json({ error: 'order (> 0) requis' })
  try {
    const stop = await prisma.routeStop.update({
      where: { id: Number(req.params.stopId) },
      data: { order: Number(order) },
    })
    setImmediate(() => logAction(req.user.id, 'ROUTE_STOP_REORDER', 'RouteStop', stop.id, { order }))
    res.json({ stop })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Arrêt introuvable' })
    if (e.code === 'P2002') return res.status(409).json({ error: 'Cet ordre est déjà pris sur cette tournée' })
    res.status(500).json({ error: e.message })
  }
})

router.delete('/logistics/routes/:id/stops/:stopId', ...guard, async (req, res) => {
  try {
    const stop = await prisma.routeStop.findUnique({ where: { id: Number(req.params.stopId) } })
    if (!stop) return res.status(404).json({ error: 'Arrêt introuvable' })
    if (stop.status !== 'PENDING') return res.status(400).json({ error: 'Impossible de retirer un arrêt déjà en cours ou terminé' })
    await prisma.routeStop.delete({ where: { id: stop.id } })
    setImmediate(() => logAction(req.user.id, 'ROUTE_STOP_REMOVE', 'RouteStop', stop.id, {}))
    res.status(204).end()
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/logistics/routes/:id/cancel', ...guard, async (req, res) => {
  try {
    const route = await prisma.route.findUnique({ where: { id: Number(req.params.id) } })
    if (!route) return res.status(404).json({ error: 'Tournée introuvable' })
    if (route.status === 'COMPLETED') return res.status(400).json({ error: 'Une tournée déjà terminée ne peut pas être annulée' })
    const updated = await prisma.route.update({ where: { id: route.id }, data: { status: 'CANCELLED' } })
    setImmediate(() => logAction(req.user.id, 'ROUTE_CANCEL', 'Route', route.id, {}))
    res.json({ route: updated })
  } catch (e) {
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

// ─── Logistique — LOT 14 : centre admin logistique ─────────────────────────
// Les LOT3/8/9/10 ont enrichi Shipment (motif d'échec, code de livraison,
// preuve de proximité GPS, horodatages de prise en charge/livraison) sans
// qu'aucune vue admin n'y donne accès — GET /orders liste les Order, jamais
// leur Shipment. Un ops ne pouvait investiguer un échec ou suivre les
// livraisons en cours qu'en interrogeant la base directement.

router.get('/logistics/shipments', ...guard, async (req, res) => {
  const { status, driverId, orderId, limit = '50', offset = '0' } = req.query
  try {
    const where = {}
    if (status) where.status = status
    if (driverId) where.driverId = Number(driverId)
    if (orderId) where.orderId = Number(orderId)

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          order: { select: { id: true, total: true, deliveryFee: true, buyer: { select: { name: true, phone: true } } } },
          driver: { select: { id: true, user: { select: { name: true, phone: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.min(Number(limit) || 50, 200),
        skip: Number(offset) || 0,
      }),
      prisma.shipment.count({ where }),
    ])
    res.json({ shipments, total })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Compteurs du jour — le tableau de bord d'un centre d'opérations logistique :
// combien de livraisons en cours, combien ont échoué aujourd'hui, combien de
// commandes escaladées attendent une réassignation, temps moyen de livraison
// (prise en charge → remise) aujourd'hui.
router.get('/logistics/dashboard', ...guard, async (req, res) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    const [byStatus, failedToday, deliveredToday, escalatedCount] = await Promise.all([
      prisma.shipment.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.shipment.count({ where: { status: 'FAILED', updatedAt: { gte: todayStart } } }),
      prisma.shipment.findMany({
        where: { status: 'DELIVERED', deliveredAt: { gte: todayStart } },
        select: { pickedUpAt: true, deliveredAt: true },
      }),
      prisma.order.count({ where: { status: 'ESCALATED' } }),
    ])

    const durations = deliveredToday
      .filter(s => s.pickedUpAt && s.deliveredAt)
      .map(s => (new Date(s.deliveredAt) - new Date(s.pickedUpAt)) / 60000)
    const avgDeliveryMinutes = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null

    res.json({
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count.status])),
      failedToday,
      deliveredToday: deliveredToday.length,
      avgDeliveryMinutes,
      escalatedAwaitingReassignment: escalatedCount,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Logistique — LOT 2 (Arbitrage XXX RIZ) : pont B2B → Shipment ──────────
// Assignation manuelle uniquement (pas de moteur d'auto-affectation pour le
// B2B dans ce MVP — les volumes/négociations B2B sont par nature plus
// ponctuels que les commandes B2C ; réutiliser assignmentEngine.js, conçu
// autour de DriverOffer/Order, serait une refonte hors périmètre de ce lot).
// Même structure que POST /orders/:id/assign, sans DriverOffer (table
// propre à Order, non réutilisable ici).
router.post('/logistics/b2b/:transactionId/assign', ...guard, async (req, res) => {
  const { driverId } = req.body
  if (!driverId) return res.status(400).json({ error: 'driverId requis' })
  const transactionId = Number(req.params.transactionId)

  try {
    const [b2bTx, driver] = await Promise.all([
      prisma.b2BTransaction.findUnique({ where: { id: transactionId } }),
      prisma.driver.findUnique({ where: { id: Number(driverId) }, include: { user: { select: { id: true, name: true } } } }),
    ])

    if (!b2bTx) return res.status(404).json({ error: 'Transaction B2B introuvable' })
    if (!driver) return res.status(404).json({ error: 'Livreur introuvable' })
    if (!b2bTx.needsLogistics) return res.status(400).json({ error: 'Cette transaction n\'a pas demandé de livraison' })
    if (!['DECLARED', 'ESCALATED'].includes(b2bTx.status)) {
      return res.status(400).json({ error: `Assignation impossible depuis le statut ${b2bTx.status}` })
    }
    if (!b2bTx.deliveryAddress) return res.status(400).json({ error: 'Adresse de livraison manquante' })

    const updated = await prisma.b2BTransaction.update({
      where: { id: transactionId },
      data: { status: b2bTx.status === 'ESCALATED' ? 'DECLARED' : b2bTx.status },
    })
    await deliveryLifecycle.createShipmentForB2BTransaction(prisma, {
      b2bTransactionId: transactionId, driverId: Number(driverId), dropoffAddress: b2bTx.deliveryAddress,
    })

    setImmediate(() => {
      if (driver.user?.id) {
        notify(driver.user.id, 'MANUAL_ASSIGNMENT', 'Livraison B2B assignée',
          `La transaction B2B #${transactionId} vous a été assignée manuellement.`, { transactionId }).catch(() => {})
      }
    })
    setImmediate(() => logAction(req.user.id, 'MANUAL_ASSIGN_B2B', 'B2BTransaction', transactionId,
      { driverId: Number(driverId), previousStatus: b2bTx.status }))

    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Logistique — LOT 15 : intelligence logistique ─────────────────────────
// L'historique GPS (DriverLocationHistory, LOT9) n'avait encore JAMAIS eu de
// consommateur — collecté avec une politique de rétention définie, mais
// jamais interrogé nulle part. Premier usage réel : reconstituer le trajet
// réel d'une livraison, pour instruire un litige ou un échec signalé
// (le livreur est-il vraiment passé par l'adresse indiquée ? combien de
// temps a-t-il stationné avant d'échouer ?).
router.get('/logistics/shipments/:id/gps-trail', ...guard, async (req, res) => {
  try {
    const shipment = await prisma.shipment.findUnique({ where: { id: Number(req.params.id) } })
    if (!shipment) return res.status(404).json({ error: 'Livraison introuvable' })
    if (!shipment.driverId) return res.json({ trail: [] })

    const from = shipment.pickedUpAt || shipment.createdAt
    const to = shipment.deliveredAt || new Date()

    const trail = await prisma.driverLocationHistory.findMany({
      where: { driverId: shipment.driverId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'asc' },
      select: { lat: true, lng: true, accuracy: true, createdAt: true },
    })
    res.json({ trail, from, to })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Signal d'anomalie simple : livreurs dont le taux d'échec récent (30
// derniers jours) dépasse un seuil — pas un modèle prédictif, juste un
// dénombrement qui donne à un ops de quoi prioriser son attention plutôt
// que de parcourir chaque commande escaladée une à une.
router.get('/logistics/risk-signals', ...guard, async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const shipments = await prisma.shipment.findMany({
      where: { driverId: { not: null }, updatedAt: { gte: since }, status: { in: ['DELIVERED', 'FAILED'] } },
      select: { driverId: true, status: true },
    })

    const byDriver = {}
    for (const s of shipments) {
      const entry = (byDriver[s.driverId] ||= { total: 0, failed: 0 })
      entry.total += 1
      if (s.status === 'FAILED') entry.failed += 1
    }

    const MIN_SAMPLE = 3 // en dessous, un seul échec fausserait le taux
    const FAILURE_RATE_THRESHOLD = 0.3
    const flaggedDriverIds = Object.entries(byDriver)
      .filter(([, v]) => v.total >= MIN_SAMPLE && v.failed / v.total >= FAILURE_RATE_THRESHOLD)
      .map(([driverId]) => Number(driverId))

    if (!flaggedDriverIds.length) return res.json({ flaggedDrivers: [] })

    const drivers = await prisma.driver.findMany({
      where: { id: { in: flaggedDriverIds } },
      select: { id: true, user: { select: { name: true } } },
    })

    const flaggedDrivers = drivers.map(d => ({
      driverId: d.id,
      driverName: d.user.name,
      totalDeliveries30d: byDriver[d.id].total,
      failedDeliveries30d: byDriver[d.id].failed,
      failureRate: Math.round((byDriver[d.id].failed / byDriver[d.id].total) * 100) / 100,
    })).sort((a, b) => b.failureRate - a.failureRate)

    res.json({ flaggedDrivers })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
