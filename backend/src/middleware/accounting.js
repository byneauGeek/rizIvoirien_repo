// RBAC fin du module Comptabilité (LOT 1). Le rôle ACCOUNTANT seul ne donne
// accès à rien — chaque route sensible exige une permission explicite,
// attribuée individuellement par l'Admin (jamais accordée automatiquement).
// L'ADMIN reste le propriétaire opérationnel : accès complet implicite, sans
// avoir besoin de se voir attribuer les permissions une à une.
const prisma = require('../lib/prisma')

const ACCOUNTING_PERMISSIONS = [
  'accounting.view',
  'accounting.transactions.view',
  'accounting.transactions.create',
  'accounting.transactions.edit',
  'accounting.transactions.validate',
  'accounting.payments.view',
  'accounting.payments.create',
  'accounting.payments.execute',
  'accounting.payments.cancel',
  'accounting.payroll.view',
  'accounting.payroll.create',
  'accounting.payroll.validate',
  'accounting.treasury.view',
  'accounting.treasury.manage',
  'accounting.reconciliation.view',
  'accounting.reconciliation.manage',
  'accounting.reports.view',
  'accounting.documents.view',
  'accounting.documents.export',
  'accounting.settings.manage',
  'accounting.audit.view',
]

// Accès à l'espace comptable au sens large (navigation, page d'accueil) —
// pas une permission d'action. Utilisé seul uniquement pour des lectures
// non sensibles ; toute action réelle doit passer par requirePermission().
function requireAccountingRole(req, res, next) {
  if (!['ADMIN', 'ACCOUNTANT'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Accès réservé à la comptabilité' })
  }
  next()
}

// Vérification brute, réutilisable hors middleware (ex : LOT 6, permission
// requise qui dépend d'un champ du corps de la requête, connue seulement une
// fois celle-ci lue — un requirePermission(...) statique ne peut pas ça).
// L'ADMIN passe toujours ; un ACCOUNTANT doit avoir CHACUNE des permissions
// listées, explicitement attribuée en base (jamais déduite du rôle seul).
async function hasPermission(user, ...perms) {
  if (user?.role === 'ADMIN') return true
  if (user?.role !== 'ACCOUNTANT') return false
  const granted = await prisma.accountingPermission.findMany({
    where: { userId: user.id, permission: { in: perms } },
    select: { permission: true },
  })
  const grantedSet = new Set(granted.map(g => g.permission))
  return perms.every(p => grantedSet.has(p))
}

function requirePermission(...perms) {
  return async (req, res, next) => {
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'ACCOUNTANT') {
      return res.status(403).json({ error: 'Accès réservé à la comptabilité' })
    }
    try {
      const ok = await hasPermission(req.user, ...perms)
      if (!ok) return res.status(403).json({ error: `Permission comptable manquante : ${perms.join(', ')}` })
      next()
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  }
}

module.exports = { ACCOUNTING_PERMISSIONS, requireAccountingRole, requirePermission, hasPermission }
