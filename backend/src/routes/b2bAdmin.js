// Administration du module B2B (filière riz) — cahier de cadrage §11/§16 :
// validation des profils, modération des annonces, signalements, statistiques.
// Fichier séparé de admin.js (déjà volumineux) plutôt que d'y ajouter un
// nouveau domaine complet — même garde ADMIN-only, même conventions.
const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authenticate, requireRole } = require('../middleware/auth')
const { logAction } = require('../services/adminLog')
const { notify } = require('../services/notifications')

const guard = [authenticate, requireRole('ADMIN')]

const PROFILE_MODEL = {
  PRODUCER: 'producer',
  COOPERATIVE: 'cooperative',
  TRADER: 'trader',
  PROCESSOR: 'processor',
  EXPORTER: 'exporter',
}
const VALID_VERIFICATION = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'SUSPENDED']

// ─── Vérification des profils ────────────────────────────────────────────────

// GET /api/admin/b2b/verifications?status=PENDING — file d'attente de vérification
router.get('/verifications', ...guard, async (req, res) => {
  const { status } = req.query
  const where = status ? { verification: status } : {}
  try {
    const [producers, cooperatives, traders, processors, exporters] = await Promise.all([
      prisma.producer.findMany({ where, include: { user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } } } }),
      prisma.cooperative.findMany({ where, include: { user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } } } }),
      prisma.trader.findMany({ where, include: { user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } } } }),
      prisma.processor.findMany({ where, include: { user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } } } }),
      prisma.exporter.findMany({ where, include: { user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } } } }),
    ])
    const profiles = [
      ...producers.map(p => ({ profileType: 'PRODUCER', label: p.user.name, ...p })),
      ...cooperatives.map(p => ({ profileType: 'COOPERATIVE', label: p.name, ...p })),
      ...traders.map(p => ({ profileType: 'TRADER', label: p.companyName, ...p })),
      ...processors.map(p => ({ profileType: 'PROCESSOR', label: p.companyName, ...p })),
      ...exporters.map(p => ({ profileType: 'EXPORTER', label: p.companyName, ...p })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    res.json({ profiles })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/admin/b2b/verifications/:profileType/:id — VERIFIED | REJECTED (→ retour UNVERIFIED) | SUSPENDED | PENDING
router.put('/verifications/:profileType/:id', ...guard, async (req, res) => {
  const { profileType, id } = req.params
  const { verification } = req.body
  const modelName = PROFILE_MODEL[profileType]
  if (!modelName) return res.status(400).json({ error: 'Type de profil invalide' })
  // REJECTED n'est pas un statut stocké (le cahier de cadrage n'en définit que 4) —
  // un refus renvoie simplement le compte à UNVERIFIED, avec notification du motif.
  const nextStatus = verification === 'REJECTED' ? 'UNVERIFIED' : verification
  if (!VALID_VERIFICATION.includes(nextStatus)) return res.status(400).json({ error: 'Statut invalide' })

  try {
    const profile = await prisma[modelName].update({
      where: { id: Number(id) },
      data: { verification: nextStatus },
      include: { user: { select: { id: true, name: true } } },
    })
    setImmediate(() => logAction(req.user.id, 'B2B_VERIFICATION', profileType, profile.id, { verification: nextStatus }))

    const messages = {
      VERIFIED: 'Votre profil a été vérifié ✅',
      SUSPENDED: 'Votre profil a été suspendu par un administrateur.',
      UNVERIFIED: verification === 'REJECTED' ? 'Votre demande de vérification a été refusée.' : 'Votre profil est repassé au statut non vérifié.',
      PENDING: 'Votre demande de vérification est en cours de traitement.',
    }
    setImmediate(() => notify(profile.user.id, 'B2B_VERIFICATION', 'Statut de vérification', messages[nextStatus] || '', { profileType }))

    res.json(profile)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Modération des annonces ──────────────────────────────────────────────────

router.get('/listings', ...guard, async (req, res) => {
  const { type, status } = req.query
  try {
    const offerWhere = status ? { status } : {}
    const requestWhere = status ? { status } : {}
    const [offers, requests] = await Promise.all([
      type === 'REQUEST' ? [] : prisma.riceOffer.findMany({
        where: offerWhere,
        include: {
          producer: { select: { id: true, user: { select: { name: true } } } },
          cooperative: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      type === 'OFFER' ? [] : prisma.purchaseRequest.findMany({
        where: requestWhere,
        include: {
          trader: { select: { id: true, companyName: true } },
          processor: { select: { id: true, companyName: true } },
          exporter: { select: { id: true, companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ])
    res.json({
      offers: offers.map(o => ({ ...o, listingType: 'OFFER' })),
      requests: requests.map(r => ({ ...r, listingType: 'REQUEST' })),
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/listings/offers/:id/moderate', ...guard, async (req, res) => {
  const { status } = req.body
  if (!['AVAILABLE', 'DISABLED'].includes(status)) return res.status(400).json({ error: 'Statut invalide' })
  try {
    const offer = await prisma.riceOffer.update({ where: { id: Number(req.params.id) }, data: { status } })
    setImmediate(() => logAction(req.user.id, 'B2B_OFFER_MODERATE', 'RiceOffer', offer.id, { status }))
    res.json(offer)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/listings/requests/:id/moderate', ...guard, async (req, res) => {
  const { status } = req.body
  if (!['ACTIVE', 'CANCELLED'].includes(status)) return res.status(400).json({ error: 'Statut invalide' })
  try {
    const request = await prisma.purchaseRequest.update({ where: { id: Number(req.params.id) }, data: { status } })
    setImmediate(() => logAction(req.user.id, 'B2B_REQUEST_MODERATE', 'PurchaseRequest', request.id, { status }))
    res.json(request)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Signalements ─────────────────────────────────────────────────────────────

router.get('/reports', ...guard, async (req, res) => {
  const { status } = req.query
  try {
    const reports = await prisma.b2BReport.findMany({
      where: status ? { status } : {},
      include: { reporter: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ reports })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/reports/:id', ...guard, async (req, res) => {
  const { status } = req.body
  if (!['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Statut invalide' })
  try {
    const report = await prisma.b2BReport.update({ where: { id: Number(req.params.id) }, data: { status } })
    setImmediate(() => logAction(req.user.id, 'B2B_REPORT_UPDATE', 'B2BReport', report.id, { status }))
    res.json(report)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Statistiques (cahier de cadrage §11) ────────────────────────────────────

router.get('/stats', ...guard, async (req, res) => {
  try {
    const [
      producers, cooperatives, traders, processors, exporters,
      offersActive, requestsActive,
      offersExpired, requestsExpired,
      contactsTotal, contactsAccepted,
      transactionsDeclared,
      pendingVerifications,
      reportsPending,
    ] = await Promise.all([
      prisma.producer.count(),
      prisma.cooperative.count(),
      prisma.trader.count(),
      prisma.processor.count(),
      prisma.exporter.count(),
      prisma.riceOffer.count({ where: { status: 'AVAILABLE' } }),
      prisma.purchaseRequest.count({ where: { status: 'ACTIVE' } }),
      prisma.riceOffer.count({ where: { status: 'EXPIRED' } }),
      prisma.purchaseRequest.count({ where: { status: 'EXPIRED' } }),
      prisma.contactRequest.count(),
      prisma.contactRequest.count({ where: { status: 'ACCEPTED' } }),
      prisma.b2BTransaction.count({ where: { status: 'DECLARED' } }),
      Promise.all([
        prisma.producer.count({ where: { verification: 'PENDING' } }),
        prisma.cooperative.count({ where: { verification: 'PENDING' } }),
        prisma.trader.count({ where: { verification: 'PENDING' } }),
        prisma.processor.count({ where: { verification: 'PENDING' } }),
        prisma.exporter.count({ where: { verification: 'PENDING' } }),
      ]).then(counts => counts.reduce((a, b) => a + b, 0)),
      prisma.b2BReport.count({ where: { status: 'PENDING' } }),
    ])

    const volumeAgg = await prisma.riceOffer.aggregate({ where: { status: 'AVAILABLE' }, _sum: { quantity: true } })

    res.json({
      usersByCategory: { producers, cooperatives, traders, processors, exporters },
      offersActive, requestsActive, offersExpired, requestsExpired,
      contactsTotal, contactsAccepted,
      transactionsDeclared,
      pendingVerifications,
      reportsPending,
      volumeOfferedTotal: volumeAgg._sum.quantity || 0,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
