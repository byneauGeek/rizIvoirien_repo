// Comptabilité — LOT 4 : les écrans de l'espace comptable (dashboard,
// transactions, paiements, dettes, créances, trésorerie). Les actions qui
// exécutent réellement un paiement (§18-20) restent au LOT 5 — ici, lecture
// des données déjà produites par les lots précédents, plus une capacité
// minimale d'enregistrement manuel pour les dettes/créances (sans laquelle
// ces écrans resteraient vides tant que le LOT 5 n'existe pas).
//
// Le cahier de cadrage (§4) ne définit pas de permission dédiée
// "dettes"/"créances" — elles sont rattachées à accounting.transactions.*
// (ce sont, par nature, des écritures financières) plutôt que d'inventer de
// nouvelles clés de permission non prévues par le LOT 1.
const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate } = require('../middleware/auth')
const { requirePermission } = require('../middleware/accounting')
const { nextReference } = require('../services/accountingSequence')
const { logAction } = require('../services/adminLog')

// ─── Recherche de bénéficiaire ────────────────────────────────────────────────
// Un ACCOUNTANT n'a pas accès à GET /admin/users (ADMIN only) — sans ceci,
// l'écran "Calculer une rémunération" n'aurait aucun moyen de retrouver
// l'id d'un livreur/vendeur par nom, seulement une saisie d'id à l'aveugle.
// Volontairement restreint aux rôles rémunérables (pas une recherche
// utilisateur générale) et aux champs strictement nécessaires à l'affichage.
router.get('/beneficiaries/search', authenticate, requirePermission('accounting.payroll.view'), async (req, res) => {
  const { role, q } = req.query
  const ALLOWED_ROLES = ['DRIVER', 'SELLER', 'COOPERATIVE', 'BUYER', 'PRODUCER', 'TRADER', 'PROCESSOR', 'EXPORTER', 'ACCOUNTANT']
  if (!ALLOWED_ROLES.includes(role)) return res.status(400).json({ error: 'Rôle invalide' })
  try {
    const where = { role }
    if (q) where.OR = [{ name: { contains: q } }, { email: { contains: q } }]
    const users = await prisma.user.findMany({ where, select: { id: true, name: true, email: true }, take: 10 })
    res.json({ users })
  } catch (e) { sendError(res, e) }
})

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get('/dashboard', authenticate, requirePermission('accounting.view'), async (req, res) => {
  try {
    const [
      accounts,
      debtsOpen, receivablesOpen,
      paymentsByStatus, paymentOrdersByStatus, remunerationsByStatus,
      todayIn, todayOut,
    ] = await Promise.all([
      prisma.treasuryAccount.findMany({ where: { active: true } }),
      prisma.debt.aggregate({ where: { status: { in: ['OPEN', 'PARTIALLY_PAID', 'OVERDUE'] } }, _sum: { initialAmount: true, paidAmount: true } }),
      prisma.receivable.aggregate({ where: { status: { in: ['OPEN', 'PARTIALLY_PAID', 'OVERDUE'] } }, _sum: { amount: true, receivedAmount: true } }),
      prisma.payment.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.paymentOrder.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.remuneration.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.financialTransaction.aggregate({
        where: { direction: 'IN', status: 'CONFIRMED', date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        _sum: { amount: true },
      }),
      prisma.financialTransaction.aggregate({
        where: { direction: 'OUT', status: 'CONFIRMED', date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        _sum: { amount: true },
      }),
    ])

    const toCountMap = (rows) => Object.fromEntries(rows.map(r => [r.status, r._count.status]))

    res.json({
      treasury: {
        totalBalance: accounts.reduce((s, a) => s + a.balance, 0),
        accounts,
      },
      debts: {
        totalDue: (debtsOpen._sum.initialAmount || 0) - (debtsOpen._sum.paidAmount || 0),
      },
      receivables: {
        totalDue: (receivablesOpen._sum.amount || 0) - (receivablesOpen._sum.receivedAmount || 0),
      },
      paymentsByStatus: toCountMap(paymentsByStatus),
      paymentOrdersByStatus: toCountMap(paymentOrdersByStatus),
      remunerationsByStatus: toCountMap(remunerationsByStatus),
      today: {
        encaissements: todayIn._sum.amount || 0,
        decaissements: todayOut._sum.amount || 0,
      },
    })
  } catch (e) { sendError(res, e) }
})

// ─── Transactions (grand livre, §9) ───────────────────────────────────────────

router.get('/financial-transactions', authenticate, requirePermission('accounting.transactions.view'), async (req, res) => {
  const { type, status, sourceType, accountId, beneficiaryUserId, dateFrom, dateTo, limit = '50', offset = '0' } = req.query
  try {
    const where = {}
    if (type) where.type = type
    if (status) where.status = status
    if (sourceType) where.sourceType = sourceType
    if (accountId) where.accountId = Number(accountId)
    if (beneficiaryUserId) where.beneficiaryUserId = Number(beneficiaryUserId)
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo)
    }
    const [transactions, total] = await Promise.all([
      prisma.financialTransaction.findMany({
        where, orderBy: { date: 'desc' },
        take: Math.min(Number(limit) || 50, 200), skip: Number(offset) || 0,
      }),
      prisma.financialTransaction.count({ where }),
    ])
    res.json({ transactions, total })
  } catch (e) { sendError(res, e) }
})

router.get('/financial-transactions/:id', authenticate, requirePermission('accounting.transactions.view'), async (req, res) => {
  try {
    const tx = await prisma.financialTransaction.findUnique({ where: { id: Number(req.params.id) } })
    if (!tx) return res.status(404).json({ error: 'Transaction introuvable' })
    res.json(tx)
  } catch (e) { sendError(res, e) }
})

// ─── Ordres de paiement (boîte de réception, §17) ────────────────────────────
// Lecture seule ici — les actions (approuver/payer/mettre en attente/rejeter,
// §19) sont le LOT 5.

router.get('/payment-orders', authenticate, requirePermission('accounting.payments.view'), async (req, res) => {
  const { status, beneficiaryUserId, limit = '50', offset = '0' } = req.query
  try {
    const where = {}
    if (status) where.status = status
    if (beneficiaryUserId) where.beneficiaryUserId = Number(beneficiaryUserId)
    const [orders, total] = await Promise.all([
      prisma.paymentOrder.findMany({
        where, orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit) || 50, 200), skip: Number(offset) || 0,
      }),
      prisma.paymentOrder.count({ where }),
    ])
    res.json({ orders, total })
  } catch (e) { sendError(res, e) }
})

router.get('/payment-orders/:id', authenticate, requirePermission('accounting.payments.view'), async (req, res) => {
  try {
    const order = await prisma.paymentOrder.findUnique({
      where: { id: Number(req.params.id) },
      include: { payments: true, remuneration: true },
    })
    if (!order) return res.status(404).json({ error: 'Ordre de paiement introuvable' })
    res.json(order)
  } catch (e) { sendError(res, e) }
})

// ─── Dettes (§22) ─────────────────────────────────────────────────────────────

router.get('/debts', authenticate, requirePermission('accounting.transactions.view'), async (req, res) => {
  const { status, beneficiaryUserId, limit = '50', offset = '0' } = req.query
  try {
    const where = {}
    if (status) where.status = status
    if (beneficiaryUserId) where.beneficiaryUserId = Number(beneficiaryUserId)
    const [debts, total] = await Promise.all([
      prisma.debt.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(Number(limit) || 50, 200), skip: Number(offset) || 0 }),
      prisma.debt.count({ where }),
    ])
    res.json({ debts, total })
  } catch (e) { sendError(res, e) }
})

router.post('/debts', authenticate, requirePermission('accounting.transactions.create'), async (req, res) => {
  const { beneficiaryUserId, beneficiaryName, sourceType, sourceId, initialAmount, dueDate, description } = req.body
  const amount = Number(initialAmount)
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Montant invalide' })
  if (!beneficiaryUserId && !beneficiaryName) return res.status(400).json({ error: 'beneficiaryUserId ou beneficiaryName requis' })
  try {
    const debt = await prisma.debt.create({
      data: {
        beneficiaryUserId: beneficiaryUserId ? Number(beneficiaryUserId) : null,
        beneficiaryName: beneficiaryName || null,
        sourceType: sourceType || 'MANUAL',
        sourceId: sourceId ? Number(sourceId) : null,
        initialAmount: amount,
        dueDate: dueDate ? new Date(dueDate) : null,
        description: description || null,
      },
    })
    setImmediate(() => logAction(req.user.id, 'DEBT_CREATE', 'Debt', debt.id, { initialAmount: amount }))
    res.status(201).json(debt)
  } catch (e) { sendError(res, e) }
})

// Enregistrement manuel d'un règlement contre une dette — crée aussi la
// ligne de grand livre correspondante (§8 : toute opération reliée à son
// origine). La liaison automatique Paiement→Dette soldée est le LOT 5 ;
// ceci reste un enregistrement manuel pour un comptable qui règle une dette
// par un autre canal (ex. hors plateforme) et veut que le registre reflète
// la réalité.
router.post('/debts/:id/record-payment', authenticate, requirePermission('accounting.transactions.create'), async (req, res) => {
  const { amount, accountId, description } = req.body
  const paid = Number(amount)
  if (!Number.isFinite(paid) || paid <= 0) return res.status(400).json({ error: 'Montant invalide' })

  try {
    const debt = await prisma.debt.findUnique({ where: { id: Number(req.params.id) } })
    if (!debt) return res.status(404).json({ error: 'Dette introuvable' })
    if (['PAID', 'CANCELLED'].includes(debt.status)) return res.status(400).json({ error: 'Cette dette est déjà soldée ou annulée' })

    const remaining = debt.initialAmount - debt.paidAmount
    if (paid > remaining) return res.status(400).json({ error: `Le montant dépasse le solde restant (${remaining})` })

    const newPaidAmount = debt.paidAmount + paid
    const newStatus = newPaidAmount >= debt.initialAmount ? 'PAID' : 'PARTIALLY_PAID'
    const reference = await nextReference('TXN')

    const [updatedDebt] = await prisma.$transaction([
      prisma.debt.update({ where: { id: debt.id }, data: { paidAmount: newPaidAmount, status: newStatus } }),
      prisma.financialTransaction.create({
        data: {
          reference, type: 'DECAISSEMENT', direction: 'OUT', amount: paid, status: 'CONFIRMED',
          sourceType: 'DEBT', sourceId: debt.id, accountId: accountId ? Number(accountId) : null,
          beneficiaryUserId: debt.beneficiaryUserId, beneficiaryName: debt.beneficiaryName,
          description: description || `Règlement dette #${debt.id}`,
          createdBy: req.user.id, validatedBy: req.user.id, validatedAt: new Date(),
        },
      }),
      ...(accountId ? [prisma.treasuryAccount.update({ where: { id: Number(accountId) }, data: { balance: { decrement: paid } } })] : []),
    ])

    setImmediate(() => logAction(req.user.id, 'DEBT_RECORD_PAYMENT', 'Debt', debt.id, { amount: paid, newStatus }))
    res.json(updatedDebt)
  } catch (e) { sendError(res, e) }
})

// ─── Créances (§23) — miroir des dettes ──────────────────────────────────────

router.get('/receivables', authenticate, requirePermission('accounting.transactions.view'), async (req, res) => {
  const { status, debtorUserId, limit = '50', offset = '0' } = req.query
  try {
    const where = {}
    if (status) where.status = status
    if (debtorUserId) where.debtorUserId = Number(debtorUserId)
    const [receivables, total] = await Promise.all([
      prisma.receivable.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(Number(limit) || 50, 200), skip: Number(offset) || 0 }),
      prisma.receivable.count({ where }),
    ])
    res.json({ receivables, total })
  } catch (e) { sendError(res, e) }
})

router.post('/receivables', authenticate, requirePermission('accounting.transactions.create'), async (req, res) => {
  const { debtorUserId, debtorName, sourceType, sourceId, amount, dueDate, description } = req.body
  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Montant invalide' })
  if (!debtorUserId && !debtorName) return res.status(400).json({ error: 'debtorUserId ou debtorName requis' })
  try {
    const receivable = await prisma.receivable.create({
      data: {
        debtorUserId: debtorUserId ? Number(debtorUserId) : null,
        debtorName: debtorName || null,
        sourceType: sourceType || 'MANUAL',
        sourceId: sourceId ? Number(sourceId) : null,
        amount: amt,
        dueDate: dueDate ? new Date(dueDate) : null,
        description: description || null,
      },
    })
    setImmediate(() => logAction(req.user.id, 'RECEIVABLE_CREATE', 'Receivable', receivable.id, { amount: amt }))
    res.status(201).json(receivable)
  } catch (e) { sendError(res, e) }
})

router.post('/receivables/:id/record-payment', authenticate, requirePermission('accounting.transactions.create'), async (req, res) => {
  const { amount, accountId, description } = req.body
  const received = Number(amount)
  if (!Number.isFinite(received) || received <= 0) return res.status(400).json({ error: 'Montant invalide' })

  try {
    const receivable = await prisma.receivable.findUnique({ where: { id: Number(req.params.id) } })
    if (!receivable) return res.status(404).json({ error: 'Créance introuvable' })
    if (['PAID', 'CANCELLED'].includes(receivable.status)) return res.status(400).json({ error: 'Cette créance est déjà soldée ou annulée' })

    const remaining = receivable.amount - receivable.receivedAmount
    if (received > remaining) return res.status(400).json({ error: `Le montant dépasse le solde restant (${remaining})` })

    const newReceivedAmount = receivable.receivedAmount + received
    const newStatus = newReceivedAmount >= receivable.amount ? 'PAID' : 'PARTIALLY_PAID'
    const reference = await nextReference('TXN')

    const [updated] = await prisma.$transaction([
      prisma.receivable.update({ where: { id: receivable.id }, data: { receivedAmount: newReceivedAmount, status: newStatus } }),
      prisma.financialTransaction.create({
        data: {
          reference, type: 'ENCAISSEMENT', direction: 'IN', amount: received, status: 'CONFIRMED',
          sourceType: 'RECEIVABLE', sourceId: receivable.id, accountId: accountId ? Number(accountId) : null,
          actorUserId: receivable.debtorUserId,
          description: description || `Encaissement créance #${receivable.id}`,
          createdBy: req.user.id, validatedBy: req.user.id, validatedAt: new Date(),
        },
      }),
      ...(accountId ? [prisma.treasuryAccount.update({ where: { id: Number(accountId) }, data: { balance: { increment: received } } })] : []),
    ])

    setImmediate(() => logAction(req.user.id, 'RECEIVABLE_RECORD_PAYMENT', 'Receivable', receivable.id, { amount: received, newStatus }))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

// ─── Trésorerie (§21) ─────────────────────────────────────────────────────────

router.get('/treasury/accounts', authenticate, requirePermission('accounting.treasury.view'), async (req, res) => {
  try {
    const accounts = await prisma.treasuryAccount.findMany({ orderBy: { createdAt: 'asc' } })
    res.json({ accounts })
  } catch (e) { sendError(res, e) }
})

router.post('/treasury/accounts', authenticate, requirePermission('accounting.treasury.manage'), async (req, res) => {
  const { name, type, currency } = req.body
  if (!name || !['CAISSE', 'BANQUE', 'MOBILE_MONEY', 'AUTRE'].includes(type)) {
    return res.status(400).json({ error: 'name requis, type ∈ CAISSE|BANQUE|MOBILE_MONEY|AUTRE' })
  }
  try {
    const account = await prisma.treasuryAccount.create({ data: { name, type, currency: currency || 'XOF' } })
    setImmediate(() => logAction(req.user.id, 'TREASURY_ACCOUNT_CREATE', 'TreasuryAccount', account.id, { name, type }))
    res.status(201).json(account)
  } catch (e) { sendError(res, e) }
})

router.get('/treasury/accounts/:id', authenticate, requirePermission('accounting.treasury.view'), async (req, res) => {
  try {
    const account = await prisma.treasuryAccount.findUnique({ where: { id: Number(req.params.id) } })
    if (!account) return res.status(404).json({ error: 'Compte introuvable' })
    const transactions = await prisma.financialTransaction.findMany({
      where: { accountId: account.id }, orderBy: { date: 'desc' }, take: 50,
    })
    res.json({ ...account, transactions })
  } catch (e) { sendError(res, e) }
})

router.put('/treasury/accounts/:id', authenticate, requirePermission('accounting.treasury.manage'), async (req, res) => {
  const { active } = req.body
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'active (booléen) requis' })
  try {
    const account = await prisma.treasuryAccount.update({ where: { id: Number(req.params.id) }, data: { active } })
    setImmediate(() => logAction(req.user.id, 'TREASURY_ACCOUNT_UPDATE', 'TreasuryAccount', account.id, { active }))
    res.json(account)
  } catch (e) { sendError(res, e) }
})

module.exports = router
