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
const { geocodeAddress } = require('./deliveryService')
const { isFreshLocation, haversineKm } = require('../lib/gps')

const SHIPMENT_STATUSES = ['PENDING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED']

// LOT 9 : preuve de livraison — était totalement absente avant ce lot (aucune
// vérification à DELIVERED). Code à 4 chiffres, verrouillé après quelques
// essais incorrects pour limiter le brute-force (4 chiffres = 10 000
// combinaisons, mais un livreur malveillant n'a que quelques essais avant
// blocage — nécessite alors une intervention support, volontairement : mieux
// vaut une friction rare qu'un code qui se devine).
const MAX_OTP_ATTEMPTS = 5
const generateDeliveryCode = () => String(Math.floor(1000 + Math.random() * 9000))

function invalidOtpError(message) {
  const err = new Error(message)
  err.code = 'INVALID_OTP'
  return err
}

// LOT 8 : géocodage paresseux de l'adresse de dépose, déclenché par la
// première requête de suivi client (orders.js GET /:id/track) plutôt qu'à la
// création du Shipment — la création tourne dans une transaction DB
// (drivers.js/admin.js), où un appel réseau externe serait une mauvaise
// pratique (même défaut que le bug corrigé au LOT3 : payDriverForDelivery).
// `geocodingInFlight` évite les appels concurrents pendant qu'une requête est
// déjà en cours pour un même shipment (l'acheteur poll toutes les 10s). En
// environnement de test, on ne fait JAMAIS de vrai appel réseau vers
// Nominatim — l'ETA reste simplement absente, aucun test n'en dépend.
const geocodingInFlight = new Set()

async function ensureShipmentDropoffCoords(shipmentId, dropoffAddress) {
  if (process.env.NODE_ENV === 'test') return
  if (geocodingInFlight.has(shipmentId)) return
  geocodingInFlight.add(shipmentId)
  try {
    const coords = await geocodeAddress(dropoffAddress)
    if (coords) {
      await prisma.shipment.update({ where: { id: shipmentId }, data: { dropoffLat: coords.lat, dropoffLng: coords.lng } })
    }
  } catch {
    // best-effort : une ETA absente n'est jamais une erreur pour l'acheteur
  } finally {
    geocodingInFlight.delete(shipmentId)
  }
}

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

// Vérifie le code de livraison AVANT d'ouvrir la transaction d'état, avec le
// client de base (pas un `tx`) : un incrément de tentative sur code erroné
// doit être PERSISTÉ même si la transition échoue — s'il était fait à
// l'intérieur de la transaction qui échoue ensuite (throw), Prisma annule
// tout, y compris l'incrément, et le compteur anti-brute-force ne compterait
// jamais rien. D'où cette étape séparée, en écriture directe.
async function checkDeliveryOtp(client, { shipmentId, orderId, otp = null, bypassOtp = false }) {
  const shipment = shipmentId
    ? await client.shipment.findUnique({ where: { id: shipmentId } })
    : await client.shipment.findUnique({ where: { orderId } })
  if (!shipment) throw new Error('Livraison introuvable')

  // shipment.deliveryCode est null uniquement pour une livraison qui n'est
  // jamais passée par PICKED_UP via ce service (aucun cas connu aujourd'hui
  // — createShipmentForOrder démarre toujours à PENDING_PICKUP) : dans ce cas
  // on ne peut rien exiger, on ne bloque pas une livraison légitime sur une
  // preuve qui n'a jamais pu être générée.
  if (!shipment.deliveryCode || bypassOtp) return

  if (shipment.deliveryCodeAttempts >= MAX_OTP_ATTEMPTS) {
    throw invalidOtpError('Code de livraison verrouillé après plusieurs tentatives incorrectes — contactez le support')
  }
  if (!otp || String(otp).trim() !== shipment.deliveryCode) {
    await client.shipment.update({ where: { id: shipment.id }, data: { deliveryCodeAttempts: { increment: 1 } } })
    throw invalidOtpError('Code de livraison incorrect')
  }
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
    if (params.status === 'DELIVERED') await checkDeliveryOtp(client, params)
    return client.$transaction((tx) => advanceShipmentInTransaction(tx, params, settings))
  }
  // `client` est déjà un tx ouvert par l'appelant : la vérification fait
  // partie de son tout-ou-rien, cohérent avec le contrat de composition.
  if (params.status === 'DELIVERED') await checkDeliveryOtp(client, params)
  return advanceShipmentInTransaction(client, params, settings)
}

async function advanceShipmentInTransaction(tx, { shipmentId, orderId, status, actorId = null, note = null }, settings) {
  if (!SHIPMENT_STATUSES.includes(status)) throw new Error(`Statut de livraison invalide : ${status}`)

  const shipment = shipmentId
    ? await tx.shipment.findUnique({ where: { id: shipmentId }, include: { order: true } })
    : await tx.shipment.findUnique({ where: { orderId }, include: { order: true } })
  if (!shipment) throw new Error('Livraison introuvable')

  const data = { status }
  if (status === 'PICKED_UP') {
    data.pickedUpAt = new Date()
    // Généré à la prise en charge — c'est le moment où une preuve de
    // livraison devient nécessaire, pas avant (PENDING_PICKUP peut encore
    // être réassigné à un autre livreur, LOT3 upsert).
    data.deliveryCode = generateDeliveryCode()
    data.deliveryCodeAttempts = 0
  }
  if (status === 'DELIVERED') {
    // Le code a déjà été vérifié par checkDeliveryOtp() avant l'ouverture de
    // cette transaction — ici on ne fait plus qu'enregistrer la livraison.
    data.deliveredAt = new Date()

    // Signal de proximité GPS — purement informatif (utile en cas de litige),
    // jamais bloquant : la destination n'est pas toujours géocodée (LOT8) et
    // la position GPS n'est pas toujours fraîche.
    if (shipment.dropoffLat != null && shipment.dropoffLng != null && shipment.driverId) {
      const location = await tx.driverCurrentLocation.findUnique({ where: { driverId: shipment.driverId } })
      if (location && isFreshLocation(location.updatedAt)) {
        data.deliveryProofDistanceKm = Math.round(haversineKm(location.lat, location.lng, shipment.dropoffLat, shipment.dropoffLng) * 100) / 100
      }
    }
  }

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

module.exports = { SHIPMENT_STATUSES, createShipmentForOrder, advanceShipment, ensureShipmentDropoffCoords }
