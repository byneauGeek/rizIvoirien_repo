// Gestion du rôle Comptabilité par l'Admin (LOT 1 du module Comptabilité).
// Le rôle ACCOUNTANT n'est jamais auto-créé — uniquement attribué ici, un
// utilisateur à la fois, par un Admin. L'activation/désactivation de l'accès
// réutilise le mécanisme `User.banned` déjà existant (PUT /admin/users/:id/ban) :
// pas de nouveau champ pour une notion qui existe déjà pour tous les rôles.
const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate, requireRole } = require('../middleware/auth')
const { ACCOUNTING_PERMISSIONS } = require('../middleware/accounting')
const { logAction } = require('../services/adminLog')
const bcrypt = require('bcryptjs')

const guard = [authenticate, requireRole('ADMIN')]

router.get('/permissions', ...guard, (req, res) => {
  res.json({ permissions: ACCOUNTING_PERMISSIONS })
})

// GET /api/admin/accounting/accountants — tous les comptes ACCOUNTANT + leurs permissions
router.get('/accountants', ...guard, async (req, res) => {
  try {
    const accountants = await prisma.user.findMany({
      where: { role: 'ACCOUNTANT' },
      select: {
        id: true, name: true, email: true, phone: true, banned: true, createdAt: true,
        accountingPermissions: { select: { permission: true, grantedAt: true, grantedBy: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ accountants })
  } catch (e) { sendError(res, e) }
})

// POST /api/admin/accounting/accountants/create — nouveau compte dédié,
// même schéma que POST /admin/users/create-commercial (précédent direct
// dans ce codebase pour un rôle interne créé par l'admin sans invite code).
router.post('/accountants/create', ...guard, async (req, res) => {
  const { name, email, password, phone } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email et password sont requis' })
  try {
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ error: 'Email déjà utilisé' })
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hash, name, phone: phone || null, role: 'ACCOUNTANT' },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    })
    setImmediate(() => logAction(req.user.id, 'ACCOUNTANT_CREATE', 'USER', user.id, { name, email }))
    res.status(201).json(user)
  } catch (e) { sendError(res, e) }
})

// POST /api/admin/accounting/accountants/:userId/promote — attribue le rôle
// à un utilisateur EXISTANT (parcours "Utilisateur → Attribution du rôle").
router.post('/accountants/:userId/promote', ...guard, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: Number(req.params.userId) } })
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' })
    if (target.role === 'ADMIN') return res.status(400).json({ error: 'Impossible de reclasser un compte admin' })
    if (target.role === 'ACCOUNTANT') return res.status(400).json({ error: 'Déjà responsable comptable' })

    const previousRole = target.role
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: 'ACCOUNTANT' },
      select: { id: true, name: true, email: true, role: true },
    })
    setImmediate(() => logAction(req.user.id, 'ACCOUNTANT_PROMOTE', 'USER', updated.id, { previousRole, newRole: 'ACCOUNTANT' }))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

// POST /api/admin/accounting/accountants/:userId/demote — retire le rôle.
// Aucune trace de "rôle précédent" n'existe dans le modèle User : on retombe
// sur BUYER (rôle neutre par défaut de la plateforme), comme pour tout
// utilisateur sans rôle métier particulier. Les permissions accordées sont
// supprimées (elles n'ont plus de sens hors du rôle ACCOUNTANT).
router.post('/accountants/:userId/demote', ...guard, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: Number(req.params.userId) } })
    if (!target || target.role !== 'ACCOUNTANT') return res.status(404).json({ error: 'Responsable comptable introuvable' })

    await prisma.$transaction([
      prisma.accountingPermission.deleteMany({ where: { userId: target.id } }),
      prisma.user.update({ where: { id: target.id }, data: { role: 'BUYER' } }),
    ])
    setImmediate(() => logAction(req.user.id, 'ACCOUNTANT_DEMOTE', 'USER', target.id, { previousRole: 'ACCOUNTANT', newRole: 'BUYER' }))
    res.json({ ok: true })
  } catch (e) { sendError(res, e) }
})

// PUT /api/admin/accounting/accountants/:userId/permissions — remplace
// l'ensemble des permissions accordées (plus simple et plus auditable qu'un
// octroi/retrait incrémental) — jamais accordées automatiquement toutes à la fois.
router.put('/accountants/:userId/permissions', ...guard, async (req, res) => {
  const { permissions } = req.body
  if (!Array.isArray(permissions)) return res.status(400).json({ error: 'permissions doit être un tableau' })
  const invalid = permissions.filter(p => !ACCOUNTING_PERMISSIONS.includes(p))
  if (invalid.length) return res.status(400).json({ error: `Permissions invalides : ${invalid.join(', ')}` })

  try {
    const target = await prisma.user.findUnique({ where: { id: Number(req.params.userId) } })
    if (!target || target.role !== 'ACCOUNTANT') return res.status(404).json({ error: 'Responsable comptable introuvable' })

    const before = await prisma.accountingPermission.findMany({
      where: { userId: target.id }, select: { permission: true },
    })

    await prisma.$transaction([
      prisma.accountingPermission.deleteMany({ where: { userId: target.id } }),
      prisma.accountingPermission.createMany({
        data: permissions.map(permission => ({ userId: target.id, permission, grantedBy: req.user.id })),
      }),
    ])

    setImmediate(() => logAction(req.user.id, 'ACCOUNTANT_PERMISSIONS_UPDATE', 'USER', target.id, {
      before: before.map(b => b.permission),
      after: permissions,
    }))
    res.json({ permissions })
  } catch (e) { sendError(res, e) }
})

module.exports = router
