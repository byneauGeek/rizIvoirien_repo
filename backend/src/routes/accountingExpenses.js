// Comptabilité — Dépenses (§26 bis).
//
// Le modèle Expense existait déjà dans le schéma (workflow complet
// DRAFT→PENDING_VALIDATION→VALIDATED→PAID|REJECTED, référencé par
// TARGET_PERMISSION/targetExists dans accountingReports.js pour joindre des
// justificatifs, et par sourceType='EXPENSE' dans paymentExecution.js pour
// créer un ordre de paiement) mais aucune route ne le créait/listait/
// validait jamais — un modèle mort avec des consommateurs à moitié
// construits en aval. Ce fichier ferme ce trou : même séparation des tâches
// que Dette/Créance (LOT 4) — créer (accounting.transactions.create) est une
// permission différente de valider/rejeter (accounting.transactions.validate).
const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate } = require('../middleware/auth')
const { requirePermission } = require('../middleware/accounting')
const { nextReference } = require('../services/accountingSequence')
const { logAction } = require('../services/adminLog')

router.get('/expenses', authenticate, requirePermission('accounting.transactions.view'), async (req, res) => {
  const { status, category, limit = '50', offset = '0' } = req.query
  try {
    const where = {}
    if (status) where.status = status
    if (category) where.category = category
    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: { date: 'desc' }, take: Math.min(Number(limit) || 50, 200), skip: Number(offset) || 0 }),
      prisma.expense.count({ where }),
    ])
    res.json({ expenses, total })
  } catch (e) { sendError(res, e) }
})

router.get('/expenses/:id', authenticate, requirePermission('accounting.transactions.view'), async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: Number(req.params.id) } })
    if (!expense) return res.status(404).json({ error: 'Dépense introuvable' })
    res.json(expense)
  } catch (e) { sendError(res, e) }
})

router.post('/expenses', authenticate, requirePermission('accounting.transactions.create'), async (req, res) => {
  const { category, amount, date, supplier, accountId, description, documentUrl } = req.body
  const amt = Number(amount)
  if (!category || !category.trim()) return res.status(400).json({ error: 'Catégorie requise' })
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Montant invalide' })
  try {
    const reference = await nextReference('EXP')
    const expense = await prisma.expense.create({
      data: {
        reference,
        category: category.trim(),
        amount: amt,
        date: date ? new Date(date) : new Date(),
        supplier: supplier || null,
        accountId: accountId ? Number(accountId) : null,
        description: description || null,
        documentUrl: documentUrl || null,
        createdBy: req.user.id,
      },
    })
    setImmediate(() => logAction(req.user.id, 'EXPENSE_CREATE', 'Expense', expense.id, { category: expense.category, amount: amt }))
    res.status(201).json(expense)
  } catch (e) { sendError(res, e) }
})

// Édition libre uniquement en DRAFT — au-delà, la dépense est engagée dans un
// circuit de validation, la modifier changerait la nature de ce qui a été
// soumis (même principe que les dettes/rémunérations : pas d'édition rétroactive
// d'un objet déjà validé).
router.put('/expenses/:id', authenticate, requirePermission('accounting.transactions.create'), async (req, res) => {
  const { category, amount, date, supplier, accountId, description, documentUrl } = req.body
  try {
    const expense = await prisma.expense.findUnique({ where: { id: Number(req.params.id) } })
    if (!expense) return res.status(404).json({ error: 'Dépense introuvable' })
    if (expense.status !== 'DRAFT') return res.status(400).json({ error: 'Seule une dépense en brouillon peut être modifiée' })

    const data = {}
    if (category !== undefined) {
      if (!category.trim()) return res.status(400).json({ error: 'Catégorie requise' })
      data.category = category.trim()
    }
    if (amount !== undefined) {
      const amt = Number(amount)
      if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Montant invalide' })
      data.amount = amt
    }
    if (date !== undefined) data.date = new Date(date)
    if (supplier !== undefined) data.supplier = supplier || null
    if (accountId !== undefined) data.accountId = accountId ? Number(accountId) : null
    if (description !== undefined) data.description = description || null
    if (documentUrl !== undefined) data.documentUrl = documentUrl || null

    const updated = await prisma.expense.update({ where: { id: expense.id }, data })
    setImmediate(() => logAction(req.user.id, 'EXPENSE_UPDATE', 'Expense', expense.id, data))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

router.delete('/expenses/:id', authenticate, requirePermission('accounting.transactions.create'), async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: Number(req.params.id) } })
    if (!expense) return res.status(404).json({ error: 'Dépense introuvable' })
    if (expense.status !== 'DRAFT') return res.status(400).json({ error: 'Seule une dépense en brouillon peut être supprimée' })
    await prisma.expense.delete({ where: { id: expense.id } })
    setImmediate(() => logAction(req.user.id, 'EXPENSE_DELETE', 'Expense', expense.id, { category: expense.category, amount: expense.amount }))
    res.status(204).end()
  } catch (e) { sendError(res, e) }
})

router.post('/expenses/:id/submit', authenticate, requirePermission('accounting.transactions.create'), async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: Number(req.params.id) } })
    if (!expense) return res.status(404).json({ error: 'Dépense introuvable' })
    if (expense.status !== 'DRAFT') return res.status(400).json({ error: 'Seule une dépense en brouillon peut être soumise' })
    const updated = await prisma.expense.update({ where: { id: expense.id }, data: { status: 'PENDING_VALIDATION' } })
    setImmediate(() => logAction(req.user.id, 'EXPENSE_SUBMIT', 'Expense', expense.id, {}))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

router.post('/expenses/:id/validate', authenticate, requirePermission('accounting.transactions.validate'), async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: Number(req.params.id) } })
    if (!expense) return res.status(404).json({ error: 'Dépense introuvable' })
    if (expense.status !== 'PENDING_VALIDATION') return res.status(400).json({ error: 'Seule une dépense en attente de validation peut être validée' })
    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: { status: 'VALIDATED', validatedBy: req.user.id, validatedAt: new Date() },
    })
    setImmediate(() => logAction(req.user.id, 'EXPENSE_VALIDATE', 'Expense', expense.id, {}))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

router.post('/expenses/:id/reject', authenticate, requirePermission('accounting.transactions.validate'), async (req, res) => {
  const { reason } = req.body
  try {
    const expense = await prisma.expense.findUnique({ where: { id: Number(req.params.id) } })
    if (!expense) return res.status(404).json({ error: 'Dépense introuvable' })
    if (expense.status !== 'PENDING_VALIDATION') return res.status(400).json({ error: 'Seule une dépense en attente de validation peut être rejetée' })
    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: { status: 'REJECTED', validatedBy: req.user.id, validatedAt: new Date() },
    })
    setImmediate(() => logAction(req.user.id, 'EXPENSE_REJECT', 'Expense', expense.id, { reason: reason || null }))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

module.exports = router
