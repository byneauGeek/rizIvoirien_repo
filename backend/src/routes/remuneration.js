// Comptabilité — LOT 3 : rémunérations. Workflow imposé par le cadrage (§10) :
// calcul → brouillon → validation → ordre de paiement. L'exécution réelle du
// paiement (LOT 5) n'est PAS traitée ici — ce fichier s'arrête à la création
// du PaymentOrder (statut PENDING_CONTROL), qui est le vrai point de passage
// de témoin vers la comptabilité (§17).
//
// Séparation des responsabilités (§3) appliquée via des permissions
// DIFFÉRENTES à chaque étape plutôt qu'un contrôle applicatif "pas la même
// personne" — un Admin peut cumuler les trois permissions, mais un
// ACCOUNTANT ne les a que si on les lui a accordées une à une (LOT 1), et
// createdBy/validatedBy tracent toujours qui a fait quoi :
//   calculer         → accounting.payroll.create
//   valider/rejeter   → accounting.payroll.validate
//   créer l'ordre     → accounting.payments.create
const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate } = require('../middleware/auth')
const { requirePermission } = require('../middleware/accounting')
const { getSettings, driverRate, sellerRate } = require('../lib/settings')
const { nextReference } = require('../services/accountingSequence')
const { logAction } = require('../services/adminLog')

const BENEFICIARY_TYPES = ['DRIVER', 'SELLER', 'COOPERATIVE', 'EMPLOYEE']
const AUTO_CALC_TYPES = ['DRIVER', 'SELLER'] // les seuls où la plateforme a réellement encaissé l'argent

// ─── Calcul (§13/§14) ─────────────────────────────────────────────────────────
// Réutilise exactement la logique déjà en place dans admin.js
// (GET /drivers/:id/payslip, GET /shops/:id/payslip) plutôt que de la
// dupliquer sous une forme légèrement différente.

async function calculateDriverRemuneration(beneficiaryUserId, periodStart, periodEnd) {
  const driver = await prisma.driver.findUnique({ where: { userId: beneficiaryUserId } })
  if (!driver) return { error: 'Ce compte n\'a pas de profil livreur' }

  const settings = await getSettings()
  const share = driverRate(settings, driver.plan)

  const orders = await prisma.order.findMany({
    where: { driverId: driver.id, status: 'DELIVERED', updatedAt: { gte: periodStart, lte: periodEnd } },
    select: { id: true, deliveryFee: true },
  })
  if (orders.length === 0) return { error: 'Aucune livraison DELIVERED sur cette période pour ce livreur' }

  const grossAmount = orders.reduce((s, o) => s + (o.deliveryFee || 0), 0)
  const lines = orders.map(o => ({ orderId: o.id, deliveryFee: o.deliveryFee || 0, earning: Math.round((o.deliveryFee || 0) * share) }))
  return { grossAmount, appliedRate: share, lines, sourceType: 'DELIVERIES' }
}

async function calculateSellerRemuneration(beneficiaryUserId, periodStart, periodEnd) {
  const shop = await prisma.shop.findUnique({ where: { userId: beneficiaryUserId } })
  if (!shop) return { error: 'Ce compte n\'a pas de profil boutique' }

  const settings = await getSettings()
  const rate = sellerRate(settings, shop.plan)

  const orders = await prisma.order.findMany({
    where: { shopId: shop.id, status: 'DELIVERED', updatedAt: { gte: periodStart, lte: periodEnd } },
    select: { id: true, total: true },
  })
  if (orders.length === 0) return { error: 'Aucune commande DELIVERED sur cette période pour cette boutique' }

  const grossAmount = orders.reduce((s, o) => s + (o.total || 0), 0)
  const lines = orders.map(o => ({ orderId: o.id, orderTotal: o.total || 0, earning: Math.round((o.total || 0) * (1 - rate)) }))
  return { grossAmount, appliedRate: rate, lines, sourceType: 'SALES', netIsGrossMinusRate: true }
}

// POST /api/accounting/remunerations/calculate
router.post('/calculate', authenticate, requirePermission('accounting.payroll.create'), async (req, res) => {
  const { beneficiaryUserId, beneficiaryType, periodStart, periodEnd, bonusAmount, penaltyAmount, advanceAmount, grossAmount: manualGross } = req.body

  if (!beneficiaryUserId || !BENEFICIARY_TYPES.includes(beneficiaryType)) {
    return res.status(400).json({ error: 'beneficiaryUserId et beneficiaryType (DRIVER|SELLER|COOPERATIVE|EMPLOYEE) requis' })
  }
  const start = new Date(periodStart)
  const end = new Date(periodEnd)
  if (isNaN(start) || isNaN(end) || start >= end) {
    return res.status(400).json({ error: 'Période invalide (periodStart doit précéder periodEnd)' })
  }
  const bonus = Number(bonusAmount) || 0
  const penalty = Number(penaltyAmount) || 0
  const advance = Number(advanceAmount) || 0
  if (bonus < 0 || penalty < 0 || advance < 0) return res.status(400).json({ error: 'Bonus/pénalité/avance ne peuvent pas être négatifs' })

  try {
    const beneficiary = await prisma.user.findUnique({ where: { id: Number(beneficiaryUserId) } })
    if (!beneficiary) return res.status(404).json({ error: 'Bénéficiaire introuvable' })

    // Empêche un double calcul accidentel sur exactement la même période
    const duplicate = await prisma.remuneration.findFirst({
      where: {
        beneficiaryUserId: beneficiary.id, periodStart: start, periodEnd: end,
        status: { notIn: ['REJECTED', 'CANCELLED'] },
      },
    })
    if (duplicate) return res.status(409).json({ error: `Une rémunération existe déjà pour cette période (${duplicate.reference})` })

    let grossAmount, appliedRate, lines, sourceType

    if (AUTO_CALC_TYPES.includes(beneficiaryType)) {
      const calc = beneficiaryType === 'DRIVER'
        ? await calculateDriverRemuneration(beneficiary.id, start, end)
        : await calculateSellerRemuneration(beneficiary.id, start, end)
      if (calc.error) return res.status(400).json({ error: calc.error })
      ;({ grossAmount, appliedRate, lines, sourceType } = calc)
    } else {
      // COOPERATIVE / EMPLOYEE : la plateforme n'encaisse jamais l'argent des
      // transactions B2B (§ module B2B — "transaction déclarée ≠ paiement"),
      // il n'y a donc rien à recalculer automatiquement depuis les données —
      // saisie manuelle du montant brut, en toute transparence (§30 : ne
      // jamais présenter un montant comme calculé s'il ne l'est pas réellement).
      const gross = Number(manualGross)
      if (!Number.isFinite(gross) || gross <= 0) {
        return res.status(400).json({ error: 'grossAmount requis (montant brut saisi manuellement) pour ce type de bénéficiaire' })
      }
      grossAmount = gross
      appliedRate = null
      sourceType = 'MANUAL'
      lines = [{ note: 'Saisie manuelle — aucune donnée de vente plateforme disponible pour ce type de bénéficiaire', grossAmount: gross }]
    }

    const baseNet = sourceType === 'SALES' ? Math.round(grossAmount * (1 - appliedRate)) : (
      sourceType === 'DELIVERIES' ? Math.round(grossAmount * appliedRate) : grossAmount
    )
    const netAmount = baseNet + bonus - penalty - advance
    if (netAmount < 0) return res.status(400).json({ error: 'Le montant net calculé est négatif (pénalités/avance supérieures au brut)' })

    const reference = await nextReference('REM')
    const remuneration = await prisma.remuneration.create({
      data: {
        reference,
        beneficiaryUserId: beneficiary.id,
        beneficiaryType,
        periodStart: start,
        periodEnd: end,
        sourceType,
        grossAmount,
        bonusAmount: bonus,
        penaltyAmount: penalty,
        advanceAmount: advance,
        netAmount,
        appliedCommissionRate: appliedRate,
        calculationDetail: JSON.stringify(lines),
        status: 'CALCULATED',
        calculatedAt: new Date(),
        createdBy: req.user.id,
      },
    })
    setImmediate(() => logAction(req.user.id, 'REMUNERATION_CALCULATE', 'Remuneration', remuneration.id, { beneficiaryUserId, beneficiaryType, netAmount }))
    res.status(201).json(remuneration)
  } catch (e) { sendError(res, e) }
})

// ─── Consultation ─────────────────────────────────────────────────────────────

router.get('/', authenticate, requirePermission('accounting.payroll.view'), async (req, res) => {
  const { status, beneficiaryType, beneficiaryUserId, limit = '50', offset = '0' } = req.query
  try {
    const where = {}
    if (status) where.status = status
    if (beneficiaryType) where.beneficiaryType = beneficiaryType
    if (beneficiaryUserId) where.beneficiaryUserId = Number(beneficiaryUserId)

    const [remunerations, total] = await Promise.all([
      prisma.remuneration.findMany({
        where, orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit) || 50, 200), skip: Number(offset) || 0,
      }),
      prisma.remuneration.count({ where }),
    ])
    res.json({ remunerations, total })
  } catch (e) { sendError(res, e) }
})

router.get('/:id', authenticate, requirePermission('accounting.payroll.view'), async (req, res) => {
  try {
    const remuneration = await prisma.remuneration.findUnique({ where: { id: Number(req.params.id) } })
    if (!remuneration) return res.status(404).json({ error: 'Rémunération introuvable' })
    const beneficiary = await prisma.user.findUnique({ where: { id: remuneration.beneficiaryUserId }, select: { id: true, name: true, email: true, phone: true } })
    res.json({ ...remuneration, calculationDetail: JSON.parse(remuneration.calculationDetail || '[]'), beneficiary })
  } catch (e) { sendError(res, e) }
})

// ─── Workflow ─────────────────────────────────────────────────────────────────

router.post('/:id/submit', authenticate, requirePermission('accounting.payroll.create'), async (req, res) => {
  try {
    const remuneration = await prisma.remuneration.findFirst({ where: { id: Number(req.params.id), status: 'CALCULATED' } })
    if (!remuneration) return res.status(404).json({ error: 'Rémunération introuvable ou déjà soumise' })

    const updated = await prisma.remuneration.update({ where: { id: remuneration.id }, data: { status: 'PENDING_VALIDATION' } })
    setImmediate(() => logAction(req.user.id, 'REMUNERATION_SUBMIT', 'Remuneration', remuneration.id, {}))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

router.post('/:id/validate', authenticate, requirePermission('accounting.payroll.validate'), async (req, res) => {
  try {
    const remuneration = await prisma.remuneration.findFirst({ where: { id: Number(req.params.id), status: 'PENDING_VALIDATION' } })
    if (!remuneration) return res.status(404).json({ error: 'Rémunération introuvable ou non soumise à validation' })

    const updated = await prisma.remuneration.update({
      where: { id: remuneration.id },
      data: { status: 'VALIDATED', validatedBy: req.user.id, validatedAt: new Date() },
    })
    setImmediate(() => logAction(req.user.id, 'REMUNERATION_VALIDATE', 'Remuneration', remuneration.id, { netAmount: remuneration.netAmount }))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

router.post('/:id/reject', authenticate, requirePermission('accounting.payroll.validate'), async (req, res) => {
  const { reason } = req.body
  if (!reason || !reason.trim()) return res.status(400).json({ error: 'Un motif de rejet est requis' })
  try {
    const remuneration = await prisma.remuneration.findFirst({ where: { id: Number(req.params.id), status: 'PENDING_VALIDATION' } })
    if (!remuneration) return res.status(404).json({ error: 'Rémunération introuvable ou non soumise à validation' })

    const updated = await prisma.remuneration.update({
      where: { id: remuneration.id },
      data: { status: 'REJECTED', validatedBy: req.user.id, validatedAt: new Date(), rejectedReason: reason.trim() },
    })
    setImmediate(() => logAction(req.user.id, 'REMUNERATION_REJECT', 'Remuneration', remuneration.id, { reason: reason.trim() }))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

router.post('/:id/cancel', authenticate, requirePermission('accounting.payroll.create'), async (req, res) => {
  try {
    const remuneration = await prisma.remuneration.findFirst({
      where: { id: Number(req.params.id), status: { in: ['CALCULATED', 'PENDING_VALIDATION'] } },
    })
    if (!remuneration) return res.status(404).json({ error: 'Rémunération introuvable ou déjà avancée dans le workflow' })

    const updated = await prisma.remuneration.update({ where: { id: remuneration.id }, data: { status: 'CANCELLED' } })
    setImmediate(() => logAction(req.user.id, 'REMUNERATION_CANCEL', 'Remuneration', remuneration.id, {}))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

// POST /:id/create-payment-order — dernière étape du LOT 3 : la validation
// devient un ordre de paiement. Exécuter réellement ce paiement est le LOT 5.
router.post('/:id/create-payment-order', authenticate, requirePermission('accounting.payments.create'), async (req, res) => {
  try {
    const remuneration = await prisma.remuneration.findFirst({ where: { id: Number(req.params.id), status: 'VALIDATED' } })
    if (!remuneration) return res.status(404).json({ error: 'Rémunération introuvable ou non validée' })

    const existingOrder = await prisma.paymentOrder.findUnique({ where: { remunerationId: remuneration.id } })
    if (existingOrder && !['REJECTED', 'CANCELLED'].includes(existingOrder.status)) {
      return res.status(409).json({ error: `Un ordre de paiement existe déjà (${existingOrder.reference})` })
    }

    const beneficiary = await prisma.user.findUnique({ where: { id: remuneration.beneficiaryUserId }, select: { name: true } })
    const reason = `Rémunération ${remuneration.reference} (${remuneration.beneficiaryType})`

    let order
    if (existingOrder) {
      // remunerationId est unique (une seule ligne PaymentOrder par
      // rémunération) : un ordre rejeté/annulé est réinitialisé plutôt que
      // dupliqué. L'historique de la décision précédente reste consultable
      // via les AdminLog (PAYMENT_ORDER_REJECT/CANCEL) horodatés.
      order = await prisma.$transaction(async (tx) => {
        const reset = await tx.paymentOrder.update({
          where: { id: existingOrder.id },
          data: {
            status: 'PENDING_CONTROL', rejectedReason: null, holdReason: null,
            accountId: null, paymentMethod: null, amount: remuneration.netAmount, reason,
          },
        })
        await tx.remuneration.update({ where: { id: remuneration.id }, data: { status: 'PAYMENT_PENDING' } })
        return reset
      })
    } else {
      const reference = await nextReference('ORD')
      ;[order] = await prisma.$transaction([
        prisma.paymentOrder.create({
          data: {
            reference,
            beneficiaryUserId: remuneration.beneficiaryUserId,
            beneficiaryName: beneficiary?.name || null,
            amount: remuneration.netAmount,
            reason,
            sourceType: 'REMUNERATION',
            sourceId: remuneration.id,
            remunerationId: remuneration.id,
            createdBy: req.user.id,
          },
        }),
        prisma.remuneration.update({ where: { id: remuneration.id }, data: { status: 'PAYMENT_PENDING' } }),
      ])
    }

    setImmediate(() => logAction(req.user.id, 'PAYMENT_ORDER_CREATE', 'PaymentOrder', order.id, { remunerationId: remuneration.id, amount: order.amount }))
    res.status(201).json(order)
  } catch (e) { sendError(res, e) }
})

module.exports = router
