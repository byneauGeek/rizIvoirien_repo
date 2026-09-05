// Logistique — LOT 3 : Fulfillment + Shipments (arbitrage Décision 3, Option C).
//
// Point d'entrée UNIQUE pour toute transition de l'exécution logistique
// d'une commande. Avant ce lot, DEUX implémentations divergentes existaient
// (orders.js chemin générique, sans reset mensuel des gains ; drivers.js
// chemin dédié, correct, seul réellement utilisé par l'app) — consolidées
// ici. orders.js et drivers.js appellent désormais tous deux ce service.
//
// Order.status est mis à jour EN MIROIR à chaque transition (ORDER_STATUS_MIRROR)
// pour que les consommateurs existants qui lisent Order.status directement
// (disputes.js, reviews.js, shopReviews.js, remuneration.js, shops.js,
// admin.js, commercial.js) continuent de fonctionner sans modification —
// Shipment ne les remplace pas, il devient l'unique écrivain.
const prisma = require('../lib/prisma')
const { getSettings, driverRate } = require('../lib/settings')

const SHIPMENT_STATUSES = ['PENDING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED']

const ORDER_STATUS_MIRROR = {
  PICKED_UP: 'IN_TRANSIT', // le vocabulaire Order n'a pas d'étape "récupéré" distincte
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
}

// Crée le Shipment au moment où une livraison est assignée à un livreur
// (acceptation d'offre OU assignation manuelle admin) — c'est le moment où
// une livraison commence à exister comme opération logistique, pas à la
// simple création de la commande (qui peut ne jamais être livrée par un
// livreur de la plateforme, ex. retrait en boutique futur).
// Idempotent (upsert) : plusieurs points d'entrée peuvent y mener
// (drivers.js à l'acceptation, admin.js à l'assignation manuelle/groupée,
// y compris la ré-assignation d'une commande ESCALATED).
function createShipmentForOrder(client, { orderId, driverId, dropoffAddress, pickupAddress = null }) {
  return client.shipment.upsert({
    where: { orderId },
    update: { driverId, status: 'PENDING_PICKUP' },
    create: { orderId, driverId, dropoffAddress, pickupAddress, status: 'PENDING_PICKUP' },
  })
}

// `client` : `prisma` (ouvre sa propre transaction) ou un `tx` déjà ouvert
// (composition dans la transaction d'un appelant) — même contrat que
// stockEngine.applyMovement.
async function advanceShipment(client, params) {
  // `getSettings()` ouvre son propre PrismaClient (voir lib/settings.js) : l'appeler
  // depuis l'intérieur d'une transaction interactive `tx` provoque un verrou mort
  // sous SQLite (deux connexions, une écriture en attente de l'autre) jusqu'au
  // timeout de 5s de Prisma. On récupère donc les settings AVANT d'ouvrir la
  // transaction et on les propage, plutôt que de les lire depuis `tx`.
  const settings = await getSettings()
  if (typeof client.$transaction === 'function') {
    return client.$transaction((tx) => advanceShipmentInTransaction(tx, params, settings))
  }
  return advanceShipmentInTransaction(client, params, settings)
}

async function advanceShipmentInTransaction(tx, { shipmentId, orderId, status, actorId = null, note = null }, settings) {
  if (!SHIPMENT_STATUSES.includes(status)) throw new Error(`Statut de livraison invalide : ${status}`)

  const shipment = shipmentId
    ? await tx.shipment.findUnique({ where: { id: shipmentId }, include: { order: true } })
    : await tx.shipment.findUnique({ where: { orderId }, include: { order: true } })
  if (!shipment) throw new Error('Livraison introuvable')

  const data = { status }
  if (status === 'PICKED_UP') data.pickedUpAt = new Date()
  if (status === 'DELIVERED') data.deliveredAt = new Date()

  const updated = await tx.shipment.update({ where: { id: shipment.id }, data })
  await tx.shipmentEvent.create({ data: { shipmentId: shipment.id, status, note, actorId } })

  const orderStatus = ORDER_STATUS_MIRROR[status]
  if (orderStatus) {
    await tx.order.update({ where: { id: shipment.orderId }, data: { status: orderStatus } })
    await tx.orderStatusHistory.create({ data: { orderId: shipment.orderId, status: orderStatus, note, actorId } })
  }

  if (status === 'DELIVERED' && shipment.driverId) {
    await payDriverForDelivery(tx, { driverId: shipment.driverId, order: shipment.order, settings })
  }

  return { shipment: updated, order: shipment.order }
}

// Logique de rémunération UNIQUE — reprend la version correcte (reset propre
// au changement de mois), celle qui manquait dans l'ancien chemin
// orders.js supprimé par ce lot.
async function payDriverForDelivery(tx, { driverId, order, settings }) {
  const driver = await tx.driver.findUnique({ where: { id: driverId }, select: { plan: true, earningsMonth: true, earningsYear: true } })
  if (!driver) return

  const gain = Math.round(order.deliveryFee * driverRate(settings, driver.plan))
  const now = new Date()
  const curMonth = now.getMonth() + 1
  const curYear = now.getFullYear()
  const monthChanged = driver.earningsMonth !== curMonth || driver.earningsYear !== curYear

  await tx.driver.update({
    where: { id: driverId },
    data: {
      totalDeliveries: { increment: 1 },
      monthlyEarnings: monthChanged ? gain : { increment: gain },
      earningsMonth: curMonth,
      earningsYear: curYear,
      available: true,
    },
  })

  await tx.driverMetric.upsert({
    where: { driverId_month_year: { driverId, month: curMonth, year: curYear } },
    update: { deliveries: { increment: 1 }, earnings: { increment: gain } },
    create: { driverId, month: curMonth, year: curYear, deliveries: 1, earnings: gain },
  })
}

module.exports = { SHIPMENT_STATUSES, createShipmentForOrder, advanceShipment }
