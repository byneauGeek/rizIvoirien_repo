// Espace Comptabilité — routes consommées par le Responsable Comptable /
// l'Admin lui-même. LOT 1 : uniquement la lecture de son propre accès
// (permissions accordées) pour piloter la navigation conditionnelle du
// frontend. Le reste (transactions, paiements, trésorerie...) arrive aux
// lots suivants.
const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate } = require('../middleware/auth')
const { ACCOUNTING_PERMISSIONS, requireAccountingRole } = require('../middleware/accounting')

// GET /api/accounting/me — mon rôle + mes permissions comptables.
// Un ADMIN reçoit la liste complète (accès implicite total), un ACCOUNTANT
// reçoit exactement ce qui lui a été attribué, jamais plus.
router.get('/me', authenticate, requireAccountingRole, async (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      return res.json({ role: 'ADMIN', permissions: ACCOUNTING_PERMISSIONS })
    }
    const granted = await prisma.accountingPermission.findMany({
      where: { userId: req.user.id },
      select: { permission: true },
    })
    res.json({ role: 'ACCOUNTANT', permissions: granted.map(g => g.permission) })
  } catch (e) { sendError(res, e) }
})

module.exports = router
