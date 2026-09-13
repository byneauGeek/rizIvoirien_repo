// Phase 2 (post-audit) : GET /accounting/controls/stale-payments existait
// déjà mais était purement diagnostique — un paiement resté PROCESSING
// (transfert initié, jamais confirmé) au-delà du délai normal ne déclenchait
// jamais rien, il fallait qu'un comptable pense à ouvrir l'onglet Contrôles.
// Même moteur que orderValidationExpiry.js (interval horaire, flag "déjà
// alerté" pour ne pas spammer à chaque tick) — mais volontairement PAS
// d'auto-échec/auto-expiration du paiement lui-même : sans passerelle de
// paiement réelle (Mobile Money/carte), le système ne peut pas savoir si le
// transfert a réellement échoué ou juste tardé à être confirmé. Décider
// PAID/FAILED à sa place risquerait un double paiement ou une créance
// effacée à tort — seule une confirmation humaine explicite (déjà en place,
// POST /payments/:id/confirm) peut trancher. Ce moteur se contente de
// relancer, jamais de décider.
const prisma = require('../lib/prisma')
const { notify } = require('./notifications')

const STALE_HOURS = 24

async function notifyPaymentExecutors(type, title, message, data) {
  const permitted = await prisma.accountingPermission.findMany({
    where: { permission: 'accounting.payments.execute' },
    select: { userId: true },
  })
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  const userIds = new Set([...permitted.map(p => p.userId), ...admins.map(a => a.id)])
  for (const userId of userIds) await notify(userId, type, title, message, data)
}

async function checkStalePayments() {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000)
  const stale = await prisma.payment.findMany({
    where: { status: 'PROCESSING', createdAt: { lt: cutoff }, staleAlertedAt: null },
    include: { paymentOrder: { select: { reference: true, reason: true } } },
  })

  for (const payment of stale) {
    await notifyPaymentExecutors(
      'STALE_PAYMENT',
      'Paiement bloqué en attente de confirmation',
      `Le paiement ${payment.reference} (${payment.paymentOrder?.reference || '—'}, ${payment.amount} FCFA) est "en cours" depuis plus de ${STALE_HOURS}h sans confirmation. Vérifiez son statut réel et confirmez-le (réussi ou échoué).`,
      { paymentId: payment.id }
    )
    await prisma.payment.update({ where: { id: payment.id }, data: { staleAlertedAt: new Date() } })
  }

  return { alerted: stale.length }
}

let engineInterval = null

function startStalePaymentAlertEngine() {
  if (engineInterval) return
  engineInterval = setInterval(() => { checkStalePayments().catch(() => {}) }, 60 * 60 * 1000)
  console.log('⚙️  Moteur d\'alerte paiements bloqués démarré (interval: 1h)')
}

function stopStalePaymentAlertEngine() {
  if (engineInterval) clearInterval(engineInterval)
  engineInterval = null
}

module.exports = { checkStalePayments, startStalePaymentAlertEngine, stopStalePaymentAlertEngine, STALE_HOURS }
