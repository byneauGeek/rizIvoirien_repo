// Comptabilité — LOT 5 : exécution des paiements (§18-20).
//
// Pipeline complet d'un ordre de paiement : création (§17, déjà en place
// pour les rémunérations depuis le LOT 3) → contrôle (approuver/rejeter/
// mettre en attente) → exécution (le compte de trésorerie est débité et un
// Payment "en cours" est créé) → confirmation (succès ou échec réel de
// l'opération) → répercussion sur la source (rémunération/dette) et
// traçabilité (FinancialTransaction + AdminLog).
//
// Séparation des tâches : créer l'ordre (accounting.payments.create) est une
// permission différente de contrôler/exécuter (accounting.payments.execute),
// elle-même différente d'annuler (accounting.payments.cancel) — un comptable
// qui ne détient que la première ne peut ni approuver ni payer ce qu'il a
// demandé.
//
// Le débit du compte de trésorerie n'a lieu qu'à la CONFIRMATION du succès,
// jamais à l'exécution (initiation) : un virement/mobile money peut échouer
// après avoir été lancé, et la caisse ne doit refléter que l'argent
// réellement sorti.
const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authenticate } = require('../middleware/auth')
const { requirePermission } = require('../middleware/accounting')
const { nextReference } = require('../services/accountingSequence')
const { logAction } = require('../services/adminLog')

const CONTROLLABLE_STATUSES = ['PENDING_CONTROL', 'ON_HOLD']
const CANCELLABLE_STATUSES = ['PENDING_CONTROL', 'ON_HOLD', 'PENDING_PAYMENT', 'FAILED']
const EXECUTABLE_STATUSES = ['PENDING_PAYMENT', 'FAILED']

// Répercute l'issue d'un ordre sur son objet source (rémunération/dette).
// sourceType DEBT n'est répercuté qu'au succès (mise à jour du solde) ; un
// échec de paiement ne change rien à la dette, qui reste exigible.
async function cascadeToSource(tx, order, outcome) {
  if (order.sourceType === 'REMUNERATION' && order.remunerationId) {
    const status = outcome === 'PAID' ? 'PAID' : outcome === 'FAILED' ? 'PAYMENT_FAILED' : 'VALIDATED'
    await tx.remuneration.update({ where: { id: order.remunerationId }, data: { status } })
  }
  if (order.sourceType === 'DEBT' && order.sourceId && outcome === 'PAID') {
    const debt = await tx.debt.findUnique({ where: { id: order.sourceId } })
    if (debt && !['PAID', 'CANCELLED'].includes(debt.status)) {
      const newPaidAmount = Math.min(debt.paidAmount + order.amount, debt.initialAmount)
      const newStatus = newPaidAmount >= debt.initialAmount ? 'PAID' : 'PARTIALLY_PAID'
      await tx.debt.update({ where: { id: debt.id }, data: { paidAmount: newPaidAmount, status: newStatus } })
    }
  }
}

// ─── Comptes de trésorerie disponibles pour l'exécution ──────────────────────
// Exécuter un paiement suppose de choisir un compte à débiter, mais
// accounting.treasury.view est une permission distincte (LOT 4) qu'un
// comptable dédié aux paiements ne détient pas forcément. Même logique que
// GET /beneficiaries/search au LOT 4 : un accès minimal et scopé plutôt que
// d'exiger une permission supplémentaire non prévue par le LOT 1.
router.get('/payable-accounts', authenticate, requirePermission('accounting.payments.execute'), async (req, res) => {
  try {
    const accounts = await prisma.treasuryAccount.findMany({
      where: { active: true },
      select: { id: true, name: true, type: true, balance: true, currency: true },
      orderBy: { name: 'asc' },
    })
    res.json({ accounts })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Création manuelle d'un ordre (dette/dépense/divers) ─────────────────────
// Les ordres liés à une rémunération se créent via
// POST /accounting/remunerations/:id/create-payment-order (LOT 3). Celui-ci
// couvre les autres origines (§17 : DEBT|EXPENSE|MANUAL).

router.post('/payment-orders', authenticate, requirePermission('accounting.payments.create'), async (req, res) => {
  const { beneficiaryUserId, beneficiaryName, amount, reason, sourceType, sourceId } = req.body
  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Montant invalide' })
  if (!beneficiaryUserId && !beneficiaryName) return res.status(400).json({ error: 'beneficiaryUserId ou beneficiaryName requis' })
  if (!reason || !reason.trim()) return res.status(400).json({ error: 'Motif requis' })
  if (!['DEBT', 'EXPENSE', 'MANUAL'].includes(sourceType)) return res.status(400).json({ error: 'sourceType ∈ DEBT|EXPENSE|MANUAL' })

  try {
    if (sourceType === 'DEBT') {
      if (!sourceId) return res.status(400).json({ error: 'sourceId requis pour sourceType=DEBT' })
      const debt = await prisma.debt.findUnique({ where: { id: Number(sourceId) } })
      if (!debt) return res.status(404).json({ error: 'Dette introuvable' })
      if (['PAID', 'CANCELLED'].includes(debt.status)) return res.status(400).json({ error: 'Cette dette est déjà soldée ou annulée' })
      const remaining = debt.initialAmount - debt.paidAmount
      if (amt > remaining) return res.status(400).json({ error: `Le montant dépasse le solde restant de la dette (${remaining})` })
    }

    const reference = await nextReference('ORD')
    const order = await prisma.paymentOrder.create({
      data: {
        reference,
        beneficiaryUserId: beneficiaryUserId ? Number(beneficiaryUserId) : null,
        beneficiaryName: beneficiaryName || null,
        amount: amt,
        reason: reason.trim(),
        sourceType,
        sourceId: sourceId ? Number(sourceId) : null,
        createdBy: req.user.id,
      },
    })
    setImmediate(() => logAction(req.user.id, 'PAYMENT_ORDER_CREATE', 'PaymentOrder', order.id, { sourceType, amount: amt }))
    res.status(201).json(order)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Contrôle (§19) ───────────────────────────────────────────────────────────

router.post('/payment-orders/:id/control', authenticate, requirePermission('accounting.payments.execute'), async (req, res) => {
  const { decision, reason } = req.body
  if (!['APPROVE', 'REJECT', 'HOLD', 'RELEASE'].includes(decision)) {
    return res.status(400).json({ error: 'decision ∈ APPROVE|REJECT|HOLD|RELEASE' })
  }
  if (['REJECT', 'HOLD'].includes(decision) && (!reason || !reason.trim())) {
    return res.status(400).json({ error: 'Un motif est requis pour rejeter ou mettre en attente' })
  }

  try {
    const order = await prisma.paymentOrder.findUnique({ where: { id: Number(req.params.id) } })
    if (!order) return res.status(404).json({ error: 'Ordre de paiement introuvable' })

    if (decision === 'RELEASE') {
      if (order.status !== 'ON_HOLD') return res.status(400).json({ error: 'Seul un ordre en attente peut être libéré' })
      const updated = await prisma.paymentOrder.update({ where: { id: order.id }, data: { status: 'PENDING_CONTROL', holdReason: null } })
      setImmediate(() => logAction(req.user.id, 'PAYMENT_ORDER_RELEASE', 'PaymentOrder', order.id, {}))
      return res.json(updated)
    }

    if (!CONTROLLABLE_STATUSES.includes(order.status)) {
      return res.status(400).json({ error: `Ordre non contrôlable dans son état actuel (${order.status})` })
    }

    if (decision === 'APPROVE') {
      const updated = await prisma.paymentOrder.update({ where: { id: order.id }, data: { status: 'PENDING_PAYMENT', holdReason: null } })
      setImmediate(() => logAction(req.user.id, 'PAYMENT_ORDER_APPROVE', 'PaymentOrder', order.id, {}))
      return res.json(updated)
    }

    if (decision === 'HOLD') {
      const updated = await prisma.paymentOrder.update({ where: { id: order.id }, data: { status: 'ON_HOLD', holdReason: reason.trim() } })
      setImmediate(() => logAction(req.user.id, 'PAYMENT_ORDER_HOLD', 'PaymentOrder', order.id, { reason: reason.trim() }))
      return res.json(updated)
    }

    // REJECT
    const updated = await prisma.$transaction(async (tx) => {
      const rejected = await tx.paymentOrder.update({ where: { id: order.id }, data: { status: 'REJECTED', rejectedReason: reason.trim() } })
      await cascadeToSource(tx, order, 'REJECTED')
      return rejected
    })
    setImmediate(() => logAction(req.user.id, 'PAYMENT_ORDER_REJECT', 'PaymentOrder', order.id, { reason: reason.trim() }))
    res.json(updated)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Annulation ───────────────────────────────────────────────────────────────

router.post('/payment-orders/:id/cancel', authenticate, requirePermission('accounting.payments.cancel'), async (req, res) => {
  const { reason } = req.body
  try {
    const order = await prisma.paymentOrder.findUnique({ where: { id: Number(req.params.id) } })
    if (!order) return res.status(404).json({ error: 'Ordre de paiement introuvable' })
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return res.status(400).json({ error: `Ordre non annulable dans son état actuel (${order.status})` })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.paymentOrder.update({ where: { id: order.id }, data: { status: 'CANCELLED', rejectedReason: reason?.trim() || null } })
      await cascadeToSource(tx, order, 'CANCELLED')
      return cancelled
    })
    setImmediate(() => logAction(req.user.id, 'PAYMENT_ORDER_CANCEL', 'PaymentOrder', order.id, { reason: reason?.trim() || null }))
    res.json(updated)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Exécution (§20) — initie le paiement, ne débite pas encore la caisse ────

router.post('/payment-orders/:id/execute', authenticate, requirePermission('accounting.payments.execute'), async (req, res) => {
  const { accountId, method } = req.body
  if (!accountId) return res.status(400).json({ error: 'accountId requis' })
  if (!['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'OTHER'].includes(method)) {
    return res.status(400).json({ error: 'method ∈ CASH|BANK_TRANSFER|MOBILE_MONEY|OTHER' })
  }

  try {
    const order = await prisma.paymentOrder.findUnique({ where: { id: Number(req.params.id) } })
    if (!order) return res.status(404).json({ error: 'Ordre de paiement introuvable' })
    if (!EXECUTABLE_STATUSES.includes(order.status)) {
      return res.status(400).json({ error: `Ordre non exécutable dans son état actuel (${order.status}) — un paiement est peut-être déjà en cours` })
    }

    const account = await prisma.treasuryAccount.findUnique({ where: { id: Number(accountId) } })
    if (!account || !account.active) return res.status(400).json({ error: 'Compte de trésorerie introuvable ou inactif' })
    if (account.balance < order.amount) return res.status(400).json({ error: `Solde insuffisant sur ${account.name} (${account.balance} < ${order.amount})` })

    const reference = await nextReference('PAY')
    const [payment, updatedOrder] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          reference, paymentOrderId: order.id, amount: order.amount, beneficiaryUserId: order.beneficiaryUserId,
          beneficiaryName: order.beneficiaryName, accountId: Number(accountId), method, status: 'PROCESSING', executedBy: req.user.id,
        },
      }),
      prisma.paymentOrder.update({ where: { id: order.id }, data: { status: 'PROCESSING', accountId: Number(accountId), paymentMethod: method } }),
    ])
    setImmediate(() => logAction(req.user.id, 'PAYMENT_EXECUTE', 'Payment', payment.id, { paymentOrderId: order.id, amount: order.amount }))
    res.status(201).json({ order: updatedOrder, payment })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Confirmation (§20) — succès (débite la caisse) ou échec réel ────────────

router.post('/payments/:id/confirm', authenticate, requirePermission('accounting.payments.execute'), async (req, res) => {
  const { outcome, failureReason } = req.body
  if (!['PAID', 'FAILED'].includes(outcome)) return res.status(400).json({ error: 'outcome ∈ PAID|FAILED' })
  if (outcome === 'FAILED' && (!failureReason || !failureReason.trim())) {
    return res.status(400).json({ error: 'failureReason requis en cas d\'échec' })
  }

  try {
    const payment = await prisma.payment.findUnique({ where: { id: Number(req.params.id) }, include: { paymentOrder: true } })
    if (!payment) return res.status(404).json({ error: 'Paiement introuvable' })
    if (payment.status !== 'PROCESSING') return res.status(400).json({ error: `Ce paiement a déjà été confirmé (${payment.status})` })

    const order = payment.paymentOrder

    if (outcome === 'FAILED') {
      const [updatedPayment, updatedOrder] = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: failureReason.trim() } })
        const o = await tx.paymentOrder.update({ where: { id: order.id }, data: { status: 'FAILED' } })
        await cascadeToSource(tx, order, 'FAILED')
        return [p, o]
      })
      setImmediate(() => logAction(req.user.id, 'PAYMENT_FAILED', 'Payment', payment.id, { reason: failureReason.trim() }))
      return res.json({ order: updatedOrder, payment: updatedPayment })
    }

    // PAID : seul point du pipeline où la trésorerie est réellement débitée.
    const account = await prisma.treasuryAccount.findUnique({ where: { id: payment.accountId } })
    if (!account) return res.status(400).json({ error: 'Compte de trésorerie introuvable' })
    if (account.balance < payment.amount) return res.status(400).json({ error: 'Solde insuffisant au moment de la confirmation' })

    const txReference = await nextReference('TXN')
    const [updatedPayment, updatedOrder] = await prisma.$transaction(async (tx) => {
      await tx.treasuryAccount.update({ where: { id: account.id }, data: { balance: { decrement: payment.amount } } })
      await tx.financialTransaction.create({
        data: {
          reference: txReference, type: 'PAYMENT_EXECUTED', direction: 'OUT', amount: payment.amount, status: 'CONFIRMED',
          sourceType: 'PAYMENT_ORDER', sourceId: order.id, accountId: account.id,
          beneficiaryUserId: payment.beneficiaryUserId, beneficiaryName: payment.beneficiaryName,
          description: order.reason, createdBy: req.user.id, validatedBy: req.user.id, validatedAt: new Date(),
        },
      })
      const p = await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID', executedAt: new Date() } })
      const o = await tx.paymentOrder.update({ where: { id: order.id }, data: { status: 'PAID' } })
      await cascadeToSource(tx, order, 'PAID')
      return [p, o]
    })
    setImmediate(() => logAction(req.user.id, 'PAYMENT_CONFIRM', 'Payment', payment.id, { amount: payment.amount }))
    res.json({ order: updatedOrder, payment: updatedPayment })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
