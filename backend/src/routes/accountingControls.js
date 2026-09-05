// Comptabilité — LOT 7 : Rapprochement & Contrôles. Dernier lot du module.
//
// Rapprochement bancaire (§28) : pointer les écritures de FinancialTransaction
// d'un compte contre un relevé externe (saisi manuellement, pas d'intégration
// bancaire réelle — hors périmètre). Une écriture "reconciled" est un fait
// déclaratif du comptable, jamais recalculé automatiquement.
//
// Contrôles (§29) : vérifications de cohérence en lecture (le solde en cache
// de TreasuryAccount correspond-il à la somme réelle de ses écritures ?) et
// une action corrective bornée (faire passer OVERDUE les dettes/créances
// dont l'échéance est dépassée — le schéma prévoyait déjà ce statut depuis
// le LOT 2, mais rien ne l'appliquait jusqu'ici).
const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authenticate } = require('../middleware/auth')
const { requirePermission } = require('../middleware/accounting')
const { logAction } = require('../services/adminLog')

// ─── Rapprochement bancaire (§28) ──────────────────────────────────────────────

// Choisir un compte à rapprocher ne doit pas exiger accounting.treasury.view
// (permission distincte, LOT 4) — même logique que beneficiaries/search
// (LOT 4) et payable-accounts (LOT 5).
router.get('/reconcilable-accounts', authenticate, requirePermission('accounting.reconciliation.view'), async (req, res) => {
  try {
    const accounts = await prisma.treasuryAccount.findMany({
      where: { active: true }, select: { id: true, name: true, type: true, balance: true }, orderBy: { name: 'asc' },
    })
    res.json({ accounts })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/treasury/accounts/:id/reconciliation', authenticate, requirePermission('accounting.reconciliation.view'), async (req, res) => {
  const accountId = Number(req.params.id)
  const { dateFrom, dateTo } = req.query
  try {
    const account = await prisma.treasuryAccount.findUnique({ where: { id: accountId } })
    if (!account) return res.status(404).json({ error: 'Compte introuvable' })

    const dateFilter = {}
    if (dateFrom) dateFilter.gte = new Date(dateFrom)
    if (dateTo) dateFilter.lte = new Date(dateTo)

    const where = { accountId, status: 'CONFIRMED', ...(dateFrom || dateTo ? { date: dateFilter } : {}) }
    const [reconciled, unreconciled] = await Promise.all([
      prisma.financialTransaction.findMany({ where: { ...where, reconciled: true }, orderBy: { date: 'desc' } }),
      prisma.financialTransaction.findMany({ where: { ...where, reconciled: false }, orderBy: { date: 'desc' } }),
    ])

    const sum = (rows) => rows.reduce((s, t) => s + (t.direction === 'IN' ? t.amount : -t.amount), 0)

    res.json({
      account: { id: account.id, name: account.name, balance: account.balance },
      reconciled, unreconciled,
      reconciledTotal: sum(reconciled),
      unreconciledTotal: sum(unreconciled),
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/treasury/accounts/:id/reconcile', authenticate, requirePermission('accounting.reconciliation.manage'), async (req, res) => {
  const accountId = Number(req.params.id)
  const { transactionIds, reconciled } = req.body
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    return res.status(400).json({ error: 'transactionIds (tableau non vide) requis' })
  }
  if (typeof reconciled !== 'boolean') return res.status(400).json({ error: 'reconciled (booléen) requis' })
  try {
    const ids = transactionIds.map(Number)
    const rows = await prisma.financialTransaction.findMany({ where: { id: { in: ids }, accountId } })
    if (rows.length !== ids.length) return res.status(400).json({ error: 'Certaines transactions n\'existent pas ou n\'appartiennent pas à ce compte' })

    const result = await prisma.financialTransaction.updateMany({
      where: { id: { in: ids } },
      data: reconciled
        ? { reconciled: true, reconciledAt: new Date(), reconciledBy: req.user.id }
        : { reconciled: false, reconciledAt: null, reconciledBy: null },
    })
    setImmediate(() => logAction(req.user.id, reconciled ? 'RECONCILE_TRANSACTIONS' : 'UNRECONCILE_TRANSACTIONS', 'TreasuryAccount', accountId, { count: ids.length }))
    res.json({ updated: result.count })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Contrôles (§29) ────────────────────────────────────────────────────────────

// Le solde en cache de TreasuryAccount ne doit jamais être modifié hors
// transaction DB (cf. schema.prisma) — ce contrôle vérifie qu'il correspond
// bien à la somme de ses écritures confirmées, seul moyen de détecter une
// dérive (bug applicatif, écriture manuelle en base).
router.get('/controls/treasury-consistency', authenticate, requirePermission('accounting.audit.view'), async (req, res) => {
  try {
    const accounts = await prisma.treasuryAccount.findMany()
    const results = await Promise.all(accounts.map(async (account) => {
      const sums = await prisma.financialTransaction.groupBy({
        by: ['direction'], _sum: { amount: true },
        where: { accountId: account.id, status: 'CONFIRMED' },
      })
      const inTotal = sums.find(s => s.direction === 'IN')?._sum.amount || 0
      const outTotal = sums.find(s => s.direction === 'OUT')?._sum.amount || 0
      const expected = inTotal - outTotal
      return {
        accountId: account.id, name: account.name, cachedBalance: account.balance,
        expectedBalance: expected, difference: Math.round((account.balance - expected) * 100) / 100,
        consistent: Math.abs(account.balance - expected) < 0.01,
      }
    }))
    res.json({ accounts: results, anomalies: results.filter(r => !r.consistent).length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/controls/overdue', authenticate, requirePermission('accounting.reconciliation.view'), async (req, res) => {
  try {
    const now = new Date()
    const [debts, receivables] = await Promise.all([
      prisma.debt.findMany({ where: { status: { in: ['OPEN', 'PARTIALLY_PAID', 'OVERDUE'] }, dueDate: { lt: now } }, orderBy: { dueDate: 'asc' } }),
      prisma.receivable.findMany({ where: { status: { in: ['OPEN', 'PARTIALLY_PAID', 'OVERDUE'] }, dueDate: { lt: now } }, orderBy: { dueDate: 'asc' } }),
    ])
    res.json({ debts, receivables })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/controls/overdue/refresh', authenticate, requirePermission('accounting.reconciliation.manage'), async (req, res) => {
  try {
    const now = new Date()
    const [debts, receivables] = await Promise.all([
      prisma.debt.updateMany({ where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lt: now } }, data: { status: 'OVERDUE' } }),
      prisma.receivable.updateMany({ where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lt: now } }, data: { status: 'OVERDUE' } }),
    ])
    setImmediate(() => logAction(req.user.id, 'OVERDUE_REFRESH', null, null, { debts: debts.count, receivables: receivables.count }))
    res.json({ debtsFlagged: debts.count, receivablesFlagged: receivables.count })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Un Payment en PROCESSING n'a jamais été confirmé (succès ou échec) — signe
// qu'une exécution a été initiée puis oubliée. Purement informatif : LOT 5
// ne permet la confirmation que par une action humaine explicite.
router.get('/controls/stale-payments', authenticate, requirePermission('accounting.reconciliation.view'), async (req, res) => {
  const hoursThreshold = Number(req.query.hours) || 24
  try {
    const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000)
    const payments = await prisma.payment.findMany({
      where: { status: 'PROCESSING', createdAt: { lt: cutoff } },
      include: { paymentOrder: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ payments, thresholdHours: hoursThreshold })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
