// Phase 1 (post-audit) : deux contrôles comptables existaient déjà
// (GET/POST /controls/overdue, GET /controls/treasury-consistency) mais
// étaient purement manuels — personne n'était jamais alerté qu'une dette
// venait de passer en retard ou qu'un compte de trésorerie ne correspondait
// plus à ses écritures ; il fallait qu'un comptable pense à ouvrir l'onglet
// Contrôles. Même moteur que stalePaymentAlert.js/orderValidationExpiry.js.
//
// Pas de flag "déjà alerté" nécessaire pour les retards : le filtre
// `status IN (OPEN, PARTIALLY_PAID)` exclut naturellement tout ce qui est
// déjà OVERDUE — une dette ne peut donc jamais être notifiée deux fois pour
// le même passage en retard. Pour la trésorerie, une anomalie est censée
// être rarissime : ré-alerter à chaque passage (toutes les 6h) tant qu'elle
// n'est pas corrigée est le comportement voulu, pas du spam.
const prisma = require('../lib/prisma')
const { notify } = require('./notifications')

async function notifyAccountingTeam(type, title, message, data) {
  const permitted = await prisma.accountingPermission.findMany({
    where: { permission: 'accounting.reconciliation.manage' },
    select: { userId: true },
  })
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  const userIds = new Set([...permitted.map(p => p.userId), ...admins.map(a => a.id)])
  for (const userId of userIds) await notify(userId, type, title, message, data)
}

async function refreshOverdueDebtsReceivables() {
  const now = new Date()
  const [newlyOverdueDebts, newlyOverdueReceivables] = await Promise.all([
    prisma.debt.findMany({ where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lt: now } }, select: { id: true } }),
    prisma.receivable.findMany({ where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lt: now } }, select: { id: true } }),
  ])

  if (newlyOverdueDebts.length > 0) {
    await prisma.debt.updateMany({ where: { id: { in: newlyOverdueDebts.map(d => d.id) } }, data: { status: 'OVERDUE' } })
  }
  if (newlyOverdueReceivables.length > 0) {
    await prisma.receivable.updateMany({ where: { id: { in: newlyOverdueReceivables.map(r => r.id) } }, data: { status: 'OVERDUE' } })
  }
  if (newlyOverdueDebts.length > 0 || newlyOverdueReceivables.length > 0) {
    await notifyAccountingTeam(
      'ACCOUNTING_OVERDUE',
      'Dettes/créances passées en retard',
      `${newlyOverdueDebts.length} dette(s) et ${newlyOverdueReceivables.length} créance(s) viennent de dépasser leur échéance.`,
      {}
    )
  }
  return { debtsFlagged: newlyOverdueDebts.length, receivablesFlagged: newlyOverdueReceivables.length }
}

async function checkTreasuryAnomalies() {
  const accounts = await prisma.treasuryAccount.findMany()
  const results = await Promise.all(accounts.map(async (account) => {
    const sums = await prisma.financialTransaction.groupBy({
      by: ['direction'], _sum: { amount: true },
      where: { accountId: account.id, status: 'CONFIRMED' },
    })
    const inTotal = sums.find(s => s.direction === 'IN')?._sum.amount || 0
    const outTotal = sums.find(s => s.direction === 'OUT')?._sum.amount || 0
    const expected = inTotal - outTotal
    return { name: account.name, consistent: Math.abs(account.balance - expected) < 0.01 }
  }))
  const anomalies = results.filter(r => !r.consistent)
  if (anomalies.length > 0) {
    await notifyAccountingTeam(
      'ACCOUNTING_TREASURY_ANOMALY',
      'Anomalie de trésorerie détectée',
      `${anomalies.length} compte(s) de trésorerie ne correspondent plus à leurs écritures confirmées : ${anomalies.map(a => a.name).join(', ')}.`,
      {}
    )
  }
  return { anomalies: anomalies.length }
}

let overdueInterval = null
let treasuryInterval = null

function startAccountingControlsEngine() {
  if (overdueInterval) return
  overdueInterval = setInterval(() => { refreshOverdueDebtsReceivables().catch(() => {}) }, 60 * 60 * 1000)
  treasuryInterval = setInterval(() => { checkTreasuryAnomalies().catch(() => {}) }, 6 * 60 * 60 * 1000)
  console.log('⚙️  Moteur de contrôles comptables démarré (retards: 1h, trésorerie: 6h)')
}

function stopAccountingControlsEngine() {
  if (overdueInterval) clearInterval(overdueInterval)
  if (treasuryInterval) clearInterval(treasuryInterval)
  overdueInterval = null
  treasuryInterval = null
}

module.exports = {
  refreshOverdueDebtsReceivables,
  checkTreasuryAnomalies,
  startAccountingControlsEngine,
  stopAccountingControlsEngine,
}
