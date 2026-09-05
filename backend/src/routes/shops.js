const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authenticate, requireRole } = require('../middleware/auth')
const { notify } = require('../services/notifications')
const { getSettings } = require('../lib/settings')

// ─── Public ───────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const { certified, limit = '20', offset = '0', search } = req.query
  try {
    const where = { status: 'ACTIVE', active: true, paused: false, contractSigned: true }
    if (certified === 'true') where.certified = true
    if (search) where.name = { contains: search }

    const [shops, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        include: {
          _count: { select: { products: true, orders: true } },
          user: { select: { name: true } },
        },
        orderBy: [{ certified: 'desc' }, { rating: 'desc' }],
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.shop.count({ where }),
    ])
    res.json({ shops, total })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Vendeur ──────────────────────────────────────────────────────────────────
// ⚠ Toutes les routes /my/* doivent être AVANT /:id

// GET /api/shops/my — données boutique seules (paramètres, sans KPIs)
router.get('/my', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({
      where: { userId: req.user.id },
      include: { subscription: true },
    })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })
    res.json(shop)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Public /:id ──────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        products: { where: { active: true }, orderBy: { createdAt: 'desc' } },
        _count: { select: { orders: true } },
        user: { select: { name: true } },
      },
    })
    // Une boutique PENDING/SUSPENDED/REJECTED ne doit pas être visible publiquement
    // (même filtre que la liste GET /) — seule une boutique ACTIVE et sous contrat l'est.
    if (!shop || shop.status !== 'ACTIVE' || !shop.active || !shop.contractSigned) {
      return res.status(404).json({ error: 'Boutique introuvable' })
    }
    res.json(shop)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/my/dashboard', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({
      where: { userId: req.user.id },
      include: { subscription: true },
    })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [
      totalOrders, monthOrders, lastMonthOrders,
      pendingOrders, products,
      revenueAll, revenueMonth,
      settings,
    ] = await Promise.all([
      prisma.order.count({ where: { shopId: shop.id } }),
      prisma.order.count({ where: { shopId: shop.id, createdAt: { gte: startOfMonth } } }),
      prisma.order.count({ where: { shopId: shop.id, createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
      prisma.order.count({ where: { shopId: shop.id, status: { in: ['CONFIRMED', 'EN_PREPARATION', 'PRET'] } } }),
      prisma.product.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: 'desc' } }),
      prisma.order.aggregate({ where: { shopId: shop.id, status: 'DELIVERED' }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { shopId: shop.id, status: 'DELIVERED', createdAt: { gte: startOfMonth } }, _sum: { total: true } }),
      getSettings(),
    ])

    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { shopId: shop.id } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    })
    const topProductsWithNames = await Promise.all(
      topProducts.map(async tp => {
        const product = await prisma.product.findUnique({ where: { id: tp.productId }, select: { name: true, price: true } })
        return { ...tp, product }
      })
    )

    const monthlyRevenue = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const agg = await prisma.order.aggregate({
        where: { shopId: shop.id, status: 'DELIVERED', createdAt: { gte: d, lt: end } },
        _sum: { total: true },
      })
      monthlyRevenue.push({ month: d.toLocaleString('fr-FR', { month: 'short' }), revenue: agg._sum.total || 0 })
    }

    const recentOrders = await prisma.order.findMany({
      where: { shopId: shop.id },
      include: { buyer: { select: { name: true } }, items: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    res.json({
      shop,
      basicMaxProducts:   settings.basicMaxProducts,
      basicCanAnalytics:  settings.basicCanAnalytics,
      kpis: {
        totalOrders, monthOrders, lastMonthOrders,
        growth: lastMonthOrders ? ((monthOrders - lastMonthOrders) / lastMonthOrders * 100).toFixed(1) : 0,
        pendingOrders,
        totalRevenue: revenueAll._sum.total || 0,
        monthRevenue: revenueMonth._sum.total || 0,
        totalProducts: products.length,
        activeProducts: products.filter(p => p.active).length,
        lowStockProducts: products.filter(p => p.stock < 10).length,
      },
      topProducts: topProductsWithNames,
      monthlyRevenue,
      recentOrders,
      products,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/shops/my/analytics — statistiques détaillées vendeur
router.get('/my/analytics', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const [shop, settings] = await Promise.all([
      prisma.shop.findUnique({ where: { userId: req.user.id } }),
      getSettings(),
    ])
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })
    if (shop.plan === 'BASIC' && !settings.basicCanAnalytics) {
      return res.status(403).json({ error: 'Analytiques réservées au plan Certifié.', code: 'PLAN_RESTRICTION' })
    }

    const now           = new Date()
    const start30       = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
    const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1)

    // ── Revenus par produit (top 8) ──────────────────────────────────────────
    const revenueByProduct = await prisma.orderItem.groupBy({
      by: ['productId', 'name'],
      where: { order: { shopId: shop.id, status: 'DELIVERED' } },
      _sum: { quantity: true, price: true },
      orderBy: { _sum: { price: 'desc' } },
      take: 8,
    })

    // ── Distribution des statuts ─────────────────────────────────────────────
    const statusDist = await prisma.order.groupBy({
      by: ['status'],
      where: { shopId: shop.id },
      _count: { id: true },
    })

    // ── Commandes par jour (30 derniers jours) ───────────────────────────────
    const ordersLast30 = await prisma.order.findMany({
      where: { shopId: shop.id, createdAt: { gte: start30 } },
      select: { createdAt: true, total: true, status: true },
    })

    // Agréger par jour
    const byDay = {}
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - i))
      const key = d.toISOString().split('T')[0]
      byDay[key] = { date: key, orders: 0, revenue: 0 }
    }
    for (const o of ordersLast30) {
      const key = o.createdAt.toISOString().split('T')[0]
      if (byDay[key]) {
        byDay[key].orders++
        if (o.status === 'DELIVERED') byDay[key].revenue += Number(o.total)
      }
    }
    const dailyStats = Object.values(byDay)

    // ── Valeur moyenne commande ──────────────────────────────────────────────
    const avgOrder = await prisma.order.aggregate({
      where: { shopId: shop.id, status: 'DELIVERED' },
      _avg: { total: true },
      _count: { id: true },
    })

    // ── Taux d'annulation ────────────────────────────────────────────────────
    const [totalOrders, cancelledOrders] = await Promise.all([
      prisma.order.count({ where: { shopId: shop.id } }),
      prisma.order.count({ where: { shopId: shop.id, status: 'CANCELLED' } }),
    ])

    // ── CA ce mois vs mois dernier ───────────────────────────────────────────
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const [caMonth, caLastMonth] = await Promise.all([
      prisma.order.aggregate({ where: { shopId: shop.id, status: 'DELIVERED', createdAt: { gte: startOfMonth } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { shopId: shop.id, status: 'DELIVERED', createdAt: { gte: startLastMonth, lt: startOfMonth } }, _sum: { total: true } }),
    ])

    // ── Analyse par jour de semaine (depuis ordersLast30 déjà chargés) ────────
    const DOW_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    const dowMap = {}
    for (const o of ordersLast30) {
      const day = new Date(o.createdAt).getDay()
      if (!dowMap[day]) dowMap[day] = { orders: 0, revenue: 0 }
      dowMap[day].orders++
      if (o.status === 'DELIVERED') dowMap[day].revenue += Number(o.total)
    }
    const ordersByDow = [1, 2, 3, 4, 5, 6, 0].map(day => ({
      label: DOW_LABELS[day],
      orders: dowMap[day]?.orders || 0,
      revenue: dowMap[day]?.revenue || 0,
    }))

    // ── Vélocité de stock ─────────────────────────────────────────────────────
    const [itemsByProduct, activeProducts] = await Promise.all([
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { shopId: shop.id, createdAt: { gte: start30 }, status: { notIn: ['CANCELLED'] } } },
        _sum: { quantity: true },
      }),
      prisma.product.findMany({
        where: { shopId: shop.id, active: true },
        select: { id: true, name: true, stock: true },
      }),
    ])

    const stockVelocity = activeProducts.map(p => {
      const sold = Number(itemsByProduct.find(i => i.productId === p.id)?._sum?.quantity || 0)
      const velocity = sold / 30
      const daysLeft = velocity > 0 ? Math.round(p.stock / velocity) : null
      return { id: p.id, name: p.name, stock: p.stock, soldLast30: sold, velocity, daysLeft }
    })

    res.json({
      revenueByProduct: revenueByProduct.map(r => ({
        name: r.name,
        revenue: Number(r._sum.price) * Number(r._sum.quantity),
        quantity: Number(r._sum.quantity),
      })),
      statusDist: statusDist.map(s => ({ status: s.status, count: s._count.id })),
      dailyStats,
      avgOrderValue: Math.round(avgOrder._avg.total || 0),
      totalDelivered: avgOrder._count.id,
      cancellationRate: totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0,
      caMonth: caMonth._sum.total || 0,
      caLastMonth: caLastMonth._sum.total || 0,
      ordersByDow,
      stockVelocity,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/shops/my/subscription-info — tarifs + abonnement actuel
router.get('/my/subscription-info', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const [shop, settings] = await Promise.all([
      prisma.shop.findUnique({
        where: { userId: req.user.id },
        include: { subscription: true },
      }),
      prisma.platformSettings.findUnique({ where: { id: 1 } }),
    ])
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })
    const certifiedAnnual  = settings?.certifiedPlanPrice    ?? 15000
    const certifiedMonthly = settings?.certifiedMonthlyPrice ?? Math.round(certifiedAnnual / 12)
    res.json({
      subscription: shop.subscription || null,
      certified: shop.certified,
      plan: shop.plan || 'BASIC',
      plans: {
        basicMonthly:          settings?.basicPlanPrice ?? 0,
        basicAnnual:           Math.round((settings?.basicPlanPrice ?? 0) * 12 * 0.85),
        certifiedAnnual,
        certifiedMonthly,
        certified:             certifiedAnnual, // compat
        certifiedPrice:        certifiedAnnual, // compat
        shopBasicFeatures:     settings?.shopBasicFeatures     ?? null,
        shopCertifiedFeatures: settings?.shopCertifiedFeatures ?? null,
      },
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/shops/my/subscription — souscrire à un plan
router.post('/my/subscription', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const { plan, billing } = req.body // plan: BASIC|CERTIFIED, billing: monthly|annual
    if (!['BASIC', 'CERTIFIED'].includes(plan)) return res.status(400).json({ error: 'Plan invalide' })

    const [shop, settings] = await Promise.all([
      prisma.shop.findUnique({ where: { userId: req.user.id }, include: { subscription: true } }),
      prisma.platformSettings.findUnique({ where: { id: 1 } }),
    ])
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })

    const basicMonthly = settings?.basicPlanPrice ?? 0
    const certifiedPrice = settings?.certifiedPlanPrice ?? 15000

    let amount, endDate
    if (plan === 'CERTIFIED') {
      amount  = certifiedPrice
      endDate = new Date(Date.now() + 365 * 24 * 3600 * 1000)
    } else if (billing === 'annual') {
      amount  = Math.round(basicMonthly * 12 * 0.85)
      endDate = new Date(Date.now() + 365 * 24 * 3600 * 1000)
    } else {
      amount  = basicMonthly
      endDate = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    }

    const sub = await prisma.subscription.upsert({
      where:  { shopId: shop.id },
      update: { plan, status: 'ACTIVE', startDate: new Date(), endDate, amount },
      create: { shopId: shop.id, plan, status: 'ACTIVE', endDate, amount },
    })

    // Mettre à jour le plan sur la boutique (la certification reste côté admin)
    await prisma.shop.update({ where: { id: shop.id }, data: { plan } })

    res.json({ subscription: sub, plan })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/my/certify', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id } })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })
    if (shop.certified) return res.status(400).json({ error: 'Boutique déjà certifiée' })

    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    const price = settings?.certifiedPlanPrice ?? 150000
    const end = new Date(Date.now() + 365 * 24 * 3600 * 1000)

    const [updatedShop] = await Promise.all([
      prisma.shop.update({ where: { id: shop.id }, data: { certified: true, plan: 'CERTIFIED' } }),
      prisma.subscription.upsert({
        where: { shopId: shop.id },
        update: { plan: 'CERTIFIED', status: 'ACTIVE', amount: price, startDate: new Date(), endDate: end },
        create: { shopId: shop.id, plan: 'CERTIFIED', status: 'ACTIVE', amount: price, endDate: end },
      }),
    ])
    res.json(updatedShop)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/shops/my/plan-upgrade-request — dernière demande de montée en plan
router.get('/my/plan-upgrade-request', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id } })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })
    const request = await prisma.planUpgradeRequest.findFirst({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ request })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/shops/my/remunerations — LOT 7 logistique (arbitrage Décision 2) :
// même lecture seule que pour les livreurs (drivers.js GET /me/remunerations) —
// la boutique voit ses Remuneration/PaymentOrder côté comptabilité, distincts
// de ses propres analytics de vente. Réconciliation complète au LOT 11.
router.get('/my/remunerations', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const remunerations = await prisma.remuneration.findMany({
      where: { beneficiaryUserId: req.user.id, beneficiaryType: 'SELLER' },
      orderBy: { periodStart: 'desc' },
      include: { paymentOrder: { select: { reference: true, status: true, amount: true } } },
    })
    res.json({
      remunerations: remunerations.map(r => ({
        id: r.reference, periodStart: r.periodStart, periodEnd: r.periodEnd,
        grossAmount: r.grossAmount, netAmount: r.netAmount, status: r.status,
        bonusAmount: r.bonusAmount, penaltyAmount: r.penaltyAmount, advanceAmount: r.advanceAmount,
        paymentOrder: r.paymentOrder,
      })),
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/shops/my/plan-upgrade-request — demander la montée en plan CERTIFIED
router.post('/my/plan-upgrade-request', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const { note, billingPeriod = 'monthly' } = req.body
    const [shop, settings] = await Promise.all([
      prisma.shop.findUnique({
        where: { userId: req.user.id },
        include: { planUpgradeRequests: { where: { status: 'PENDING' } } },
      }),
      prisma.platformSettings.findUnique({ where: { id: 1 } }),
    ])
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })
    if (shop.plan === 'CERTIFIED' && shop.certified)
      return res.status(400).json({ error: 'Vous êtes déjà sur le plan Certifié.' })
    if (shop.planUpgradeRequests.length > 0)
      return res.status(409).json({ error: 'Une demande est déjà en cours d\'examen.' })

    const certifiedAnnual  = settings?.certifiedPlanPrice    ?? 15000
    const certifiedMonthly = settings?.certifiedMonthlyPrice ?? Math.round(certifiedAnnual / 12)
    const period = billingPeriod === 'annual' ? 'annual' : 'monthly'
    const amount = period === 'annual' ? certifiedAnnual : certifiedMonthly

    const request = await prisma.planUpgradeRequest.create({
      data: {
        type: 'SHOP', shopId: shop.id,
        fromPlan: shop.plan || 'BASIC', toPlan: 'CERTIFIED',
        billingPeriod: period,
        note: note || null,
        amount,
        status: 'PENDING',
      },
    })
    setImmediate(() => {
      notify(1, 'PLAN_UPGRADE_REQUEST', 'Nouvelle demande de certification',
        `La boutique "${shop.name}" demande à passer en plan Certifié.`, { requestId: request.id }).catch(() => {})
    })
    res.status(201).json(request)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/my', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id } })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })

    const {
      name, businessName, rccm, description, speciality, since,
      phone, email, location, latitude, longitude, deliveryZones,
      coverImage, avatar,
      minOrder, preparationTime, openingHours, paused, pauseNote,
      notifyEmail, notifyLowStock,
      whatsapp, facebook, instagram,
      paymentMethods, tags,
      announcement, announcementActive,
    } = req.body

    const updated = await prisma.shop.update({
      where: { id: shop.id },
      data: {
        ...(name !== undefined && { name }),
        ...(businessName !== undefined && { businessName }),
        ...(rccm !== undefined && { rccm }),
        ...(description !== undefined && { description }),
        ...(speciality !== undefined && { speciality }),
        ...(since !== undefined && { since }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(location !== undefined && { location }),
        ...(latitude  !== undefined && { latitude:  latitude  ? parseFloat(latitude)  : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(deliveryZones !== undefined && { deliveryZones }),
        ...(coverImage !== undefined && { coverImage }),
        ...(avatar !== undefined && { avatar }),
        ...(minOrder !== undefined && { minOrder: Number(minOrder) }),
        ...(preparationTime !== undefined && { preparationTime: Number(preparationTime) }),
        ...(openingHours !== undefined && { openingHours }),
        ...(paused !== undefined && { paused: Boolean(paused) }),
        ...(pauseNote !== undefined && { pauseNote }),
        ...(notifyEmail !== undefined && { notifyEmail: Boolean(notifyEmail) }),
        ...(notifyLowStock !== undefined && { notifyLowStock: Boolean(notifyLowStock) }),
        ...(whatsapp !== undefined && { whatsapp }),
        ...(facebook !== undefined && { facebook }),
        ...(instagram !== undefined && { instagram }),
        ...(paymentMethods !== undefined && { paymentMethods: JSON.stringify(paymentMethods) }),
        ...(tags !== undefined && { tags }),
        ...(announcement !== undefined && { announcement }),
        ...(announcementActive !== undefined && { announcementActive: Boolean(announcementActive) }),
      },
      include: { subscription: true },
    })
    res.json(updated)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/shops/my/contract
router.get('/my/contract', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id }, include: { contract: true } })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })
    res.json({ contract: shop.contract, contractSigned: shop.contractSigned })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/shops/my/contract/sign
router.put('/my/contract/sign', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id }, include: { contract: true } })
    if (!shop?.contract) return res.status(404).json({ error: 'Contrat introuvable' })
    if (shop.contractSigned) return res.json({ message: 'Déjà signé' })
    await prisma.$transaction([
      prisma.contract.update({ where: { id: shop.contract.id }, data: { status: 'SIGNED', signedAt: new Date() } }),
      prisma.shop.update({ where: { id: shop.id }, data: { contractSigned: true } }),
    ])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
