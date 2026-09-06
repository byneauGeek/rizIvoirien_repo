// Comptabilité — LOT 6 : Rapports & Documents.
//
// Rapports : vue agrégée sur une période (§25) + export CSV brut des
// tables comptables (§26), pour un contrôle externe (audit, expert-
// comptable) sans donner accès à la base de données elle-même.
//
// Documents : pièces justificatives (§27) attachées à un objet comptable
// via le modèle polymorphe AccountingDocument du LOT 2 (targetType/
// targetId, déjà utilisé partout ailleurs dans ce module). Joindre une
// pièce à une dette/un ordre de paiement/une rémunération exige la même
// permission que celle qui permet d'agir sur cet objet — accounting.
// documents.view/.export (LOT 1) ne couvrent que la consultation et
// l'export en masse, pas la création, qui reste rattachée au domaine
// métier de la pièce (cohérent avec le choix du LOT 4 pour dettes/
// créances : pas de permission dédiée non prévue par le référentiel).
const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate } = require('../middleware/auth')
const { requirePermission, requireAccountingRole, hasPermission } = require('../middleware/accounting')
const { uploadDocument, fileUrl } = require('../middleware/upload')
const { logAction } = require('../services/adminLog')

const DOC_TYPES = ['INVOICE', 'RECEIPT', 'CONTRACT', 'PROOF_OF_PAYMENT', 'PAYSLIP', 'SETTLEMENT_STATEMENT', 'OTHER']

// Permission requise pour joindre une pièce à ce type d'objet — celle qui
// permet déjà d'agir dessus, pas une permission "documents" générique.
const TARGET_PERMISSION = {
  DEBT: 'accounting.transactions.create',
  RECEIVABLE: 'accounting.transactions.create',
  EXPENSE: 'accounting.transactions.create',
  PAYMENT_ORDER: 'accounting.payments.execute',
  PAYMENT: 'accounting.payments.execute',
  REMUNERATION: 'accounting.payroll.create',
}

async function targetExists(targetType, targetId) {
  const models = {
    DEBT: 'debt', RECEIVABLE: 'receivable', EXPENSE: 'expense',
    PAYMENT_ORDER: 'paymentOrder', PAYMENT: 'payment', REMUNERATION: 'remuneration',
  }
  const model = models[targetType]
  if (!model) return false
  const row = await prisma[model].findUnique({ where: { id: targetId } })
  return !!row
}

function toCsv(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return ''
    const s = v instanceof Date ? v.toISOString() : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map(c => esc(c.label)).join(',')
  const lines = rows.map(r => columns.map(c => esc(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','))
  return [header, ...lines].join('\r\n')
}

function dateRange(query) {
  const where = {}
  if (query.dateFrom || query.dateTo) {
    where.gte = query.dateFrom ? new Date(query.dateFrom) : undefined
    where.lte = query.dateTo ? new Date(query.dateTo) : undefined
  }
  return Object.keys(where).length ? where : undefined
}

// ─── Rapports (§25) ────────────────────────────────────────────────────────────

router.get('/reports/summary', authenticate, requirePermission('accounting.reports.view'), async (req, res) => {
  const range = dateRange(req.query)
  try {
    const [
      accounts, txByType, remByStatus, payByStatus,
      debtsOpened, debtsSettled, recvOpened, recvSettled,
    ] = await Promise.all([
      prisma.treasuryAccount.findMany({ where: { active: true } }),
      prisma.financialTransaction.groupBy({
        by: ['type', 'direction'], _sum: { amount: true }, _count: { _all: true },
        where: { status: 'CONFIRMED', ...(range ? { date: range } : {}) },
      }),
      prisma.remuneration.groupBy({
        by: ['status'], _sum: { netAmount: true }, _count: { _all: true },
        where: range ? { updatedAt: range } : {},
      }),
      prisma.payment.groupBy({
        by: ['status'], _sum: { amount: true }, _count: { _all: true },
        where: range ? { updatedAt: range } : {},
      }),
      prisma.debt.aggregate({ _sum: { initialAmount: true }, _count: { _all: true }, where: range ? { createdAt: range } : {} }),
      prisma.debt.aggregate({ _sum: { paidAmount: true }, _count: { _all: true }, where: { status: 'PAID', ...(range ? { updatedAt: range } : {}) } }),
      prisma.receivable.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: range ? { createdAt: range } : {} }),
      prisma.receivable.aggregate({ _sum: { receivedAmount: true }, _count: { _all: true }, where: { status: 'PAID', ...(range ? { updatedAt: range } : {}) } }),
    ])

    res.json({
      period: { from: req.query.dateFrom || null, to: req.query.dateTo || null },
      treasury: { totalBalance: accounts.reduce((s, a) => s + a.balance, 0), accounts },
      transactions: txByType.map(t => ({ type: t.type, direction: t.direction, total: t._sum.amount || 0, count: t._count._all })),
      remunerations: remByStatus.map(r => ({ status: r.status, total: r._sum.netAmount || 0, count: r._count._all })),
      payments: payByStatus.map(p => ({ status: p.status, total: p._sum.amount || 0, count: p._count._all })),
      debts: {
        opened: { count: debtsOpened._count._all, total: debtsOpened._sum.initialAmount || 0 },
        settled: { count: debtsSettled._count._all, total: debtsSettled._sum.paidAmount || 0 },
      },
      receivables: {
        opened: { count: recvOpened._count._all, total: recvOpened._sum.amount || 0 },
        settled: { count: recvSettled._count._all, total: recvSettled._sum.receivedAmount || 0 },
      },
    })
  } catch (e) { sendError(res, e) }
})

const EXPORTS = {
  transactions: {
    model: 'financialTransaction', dateField: 'date',
    columns: [
      { key: 'reference', label: 'Référence' }, { key: 'type', label: 'Type' }, { key: 'direction', label: 'Sens' },
      { key: 'amount', label: 'Montant' }, { key: 'status', label: 'Statut' }, { key: 'sourceType', label: 'Origine' },
      { key: 'sourceId', label: 'ID origine' }, { key: 'beneficiaryName', label: 'Bénéficiaire' }, { key: 'date', label: 'Date' },
    ],
  },
  payments: {
    model: 'payment', dateField: 'createdAt',
    columns: [
      { key: 'reference', label: 'Référence' }, { key: 'amount', label: 'Montant' }, { key: 'method', label: 'Mode' },
      { key: 'status', label: 'Statut' }, { key: 'beneficiaryName', label: 'Bénéficiaire' },
      { key: 'executedAt', label: 'Exécuté le' }, { key: 'failureReason', label: 'Motif d\'échec' },
    ],
  },
  remunerations: {
    model: 'remuneration', dateField: 'createdAt',
    columns: [
      { key: 'reference', label: 'Référence' }, { key: 'beneficiaryType', label: 'Type bénéficiaire' },
      { key: 'grossAmount', label: 'Montant brut' }, { key: 'netAmount', label: 'Montant net' },
      { key: 'status', label: 'Statut' }, { key: 'periodStart', label: 'Début période' }, { key: 'periodEnd', label: 'Fin période' },
    ],
  },
  debts: {
    model: 'debt', dateField: 'createdAt',
    columns: [
      { key: 'id', label: 'ID' }, { key: 'beneficiaryName', label: 'Bénéficiaire' }, { key: 'initialAmount', label: 'Montant initial' },
      { key: 'paidAmount', label: 'Montant réglé' }, { key: 'status', label: 'Statut' }, { key: 'sourceType', label: 'Origine' },
    ],
  },
  receivables: {
    model: 'receivable', dateField: 'createdAt',
    columns: [
      { key: 'id', label: 'ID' }, { key: 'debtorName', label: 'Débiteur' }, { key: 'amount', label: 'Montant' },
      { key: 'receivedAmount', label: 'Montant encaissé' }, { key: 'status', label: 'Statut' }, { key: 'sourceType', label: 'Origine' },
    ],
  },
}

router.get('/reports/export', authenticate, requirePermission('accounting.documents.export'), async (req, res) => {
  const { type } = req.query
  const spec = EXPORTS[type]
  if (!spec) return res.status(400).json({ error: `type ∈ ${Object.keys(EXPORTS).join('|')}` })
  try {
    const range = dateRange(req.query)
    const where = range ? { [spec.dateField]: range } : {}
    const rows = await prisma[spec.model].findMany({ where, orderBy: { [spec.dateField]: 'desc' }, take: 5000 })
    const csv = toCsv(rows, spec.columns)
    setImmediate(() => logAction(req.user.id, 'REPORT_EXPORT', type, null, { count: rows.length }))
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send('﻿' + csv) // BOM — Excel FR ouvre l'UTF-8 correctement
  } catch (e) { sendError(res, e) }
})

// ─── Documents (§27) ───────────────────────────────────────────────────────────

router.get('/documents', authenticate, requirePermission('accounting.documents.view'), async (req, res) => {
  const { targetType, targetId, docType, limit = '50', offset = '0' } = req.query
  try {
    const where = {}
    if (targetType) where.targetType = targetType
    if (targetId) where.targetId = Number(targetId)
    if (docType) where.docType = docType
    const [documents, total] = await Promise.all([
      prisma.accountingDocument.findMany({ where, orderBy: { uploadedAt: 'desc' }, take: Math.min(Number(limit) || 50, 200), skip: Number(offset) || 0 }),
      prisma.accountingDocument.count({ where }),
    ])
    res.json({ documents, total })
  } catch (e) { sendError(res, e) }
})

// requireAccountingRole avant multer : un rôle hors comptabilité ne doit
// même pas pouvoir déclencher un upload (bande passante/stockage) — le
// contrôle fin par targetType vient après, une fois le corps disponible.
router.post('/documents', authenticate, requireAccountingRole, uploadDocument.single('file'), async (req, res) => {
  const { targetType, targetId, docType } = req.body
  const requiredPerm = TARGET_PERMISSION[targetType]
  if (!requiredPerm) return res.status(400).json({ error: `targetType ∈ ${Object.keys(TARGET_PERMISSION).join('|')}` })
  if (!DOC_TYPES.includes(docType)) return res.status(400).json({ error: `docType ∈ ${DOC_TYPES.join('|')}` })
  if (!req.file) return res.status(400).json({ error: 'Fichier requis (JPEG/PNG/WebP/PDF, 10 Mo max)' })
  if (!(await hasPermission(req.user, requiredPerm))) {
    return res.status(403).json({ error: `Permission comptable manquante : ${requiredPerm}` })
  }
  const id = Number(targetId)
  if (!Number.isInteger(id) || !(await targetExists(targetType, id))) {
    return res.status(404).json({ error: 'Objet cible introuvable' })
  }
  try {
    const document = await prisma.accountingDocument.create({
      data: { targetType, targetId: id, docType, url: fileUrl(req.file), uploadedBy: req.user.id },
    })
    setImmediate(() => logAction(req.user.id, 'DOCUMENT_UPLOAD', targetType, id, { docType, documentId: document.id }))
    res.status(201).json(document)
  } catch (e) { sendError(res, e) }
})

module.exports = router
