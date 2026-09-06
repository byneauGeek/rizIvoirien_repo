// LOT AUDIT-G11 (audit XXX RIZ) : PENDING_VALIDATION (checkout avec
// autoValidateOrders=false, cf. orders.js) décrémente le stock dès la
// création — si personne ne valide/annule la commande, ce stock reste
// bloqué indéfiniment. Décision produit (validée) : avertir le staff
// commercial à 24h, annuler + restocker automatiquement à 48h. Même moteur
// que b2bExpiry.js (interval horaire, pas de polling agressif : l'expiration
// se joue à l'échelle du jour).
const prisma = require('../lib/prisma')
const { notify } = require('./notifications')
const stockEngine = require('./stockEngine')

const EXPIRY_HOURS = 48
const WARNING_HOURS = 24

async function notifyCommercialTeam(type, title, message, data) {
  const staff = await prisma.user.findMany({ where: { role: { in: ['COMMERCIAL', 'ADMIN'] } }, select: { id: true } })
  for (const u of staff) await notify(u.id, type, title, message, data)
}

async function checkPendingValidationOrders() {
  const now = Date.now()
  const expiryCutoff = new Date(now - EXPIRY_HOURS * 60 * 60 * 1000)
  const warningCutoff = new Date(now - WARNING_HOURS * 60 * 60 * 1000)

  // 1) Annulation + restockage des commandes ayant dépassé le délai
  const expired = await prisma.order.findMany({
    where: { status: 'PENDING_VALIDATION', createdAt: { lt: expiryCutoff } },
    include: { items: true },
  })
  for (const order of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id, status: 'CANCELLED',
          note: `Annulée automatiquement après ${EXPIRY_HOURS}h sans validation commerciale`,
        },
      })
      for (const item of order.items) {
        await stockEngine.restockFromCancellation(tx, {
          productId: item.productId, quantity: item.quantity, orderId: order.id,
          reason: `Expiration automatique PENDING_VALIDATION (${EXPIRY_HOURS}h)`,
        })
      }
    })
    await notify(order.buyerId, 'ORDER_CANCELLED', 'Commande annulée',
      `Votre commande #${order.id} n'a pas pu être validée à temps et a été annulée automatiquement. Contactez le support si besoin.`,
      { orderId: order.id })
  }

  // 2) Avertissement au staff commercial pour les commandes qui approchent
  //    l'expiration — une seule fois par commande (expiryWarnedAt), sinon le
  //    moteur (horaire) renverrait la même alerte à chaque tick.
  const approaching = await prisma.order.findMany({
    where: {
      status: 'PENDING_VALIDATION',
      createdAt: { lt: warningCutoff, gte: expiryCutoff },
      expiryWarnedAt: null,
    },
  })
  for (const order of approaching) {
    await notifyCommercialTeam(
      'ORDER_VALIDATION_EXPIRING', 'Validation urgente requise',
      `Commande #${order.id} en attente depuis plus de ${WARNING_HOURS}h — annulation automatique dans ${EXPIRY_HOURS - WARNING_HOURS}h si non traitée.`,
      { orderId: order.id }
    )
    await prisma.order.update({ where: { id: order.id }, data: { expiryWarnedAt: new Date() } })
  }

  return { expired: expired.length, warned: approaching.length }
}

let engineInterval = null

function startOrderValidationExpiryEngine() {
  if (engineInterval) return
  engineInterval = setInterval(() => { checkPendingValidationOrders().catch(() => {}) }, 60 * 60 * 1000)
  console.log('⚙️  Moteur d\'expiration des commandes en attente démarré (interval: 1h)')
}

function stopOrderValidationExpiryEngine() {
  if (engineInterval) clearInterval(engineInterval)
  engineInterval = null
}

module.exports = {
  checkPendingValidationOrders,
  startOrderValidationExpiryEngine,
  stopOrderValidationExpiryEngine,
  EXPIRY_HOURS,
  WARNING_HOURS,
}
