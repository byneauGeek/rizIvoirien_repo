/**
 * SSE (Server-Sent Events) manager + GPS position store
 *
 * - clients    : Map<userId, res>   — connexions SSE actives
 * - positions  : Map<driverId, {lat,lng,orderId,ts}>  — dernière position GPS
 * - orderDriverMap : Map<orderId, driverId>  — pour retrouver rapidement le livreur d'une commande
 */

const clients    = new Map()  // userId (Number) → SSE res
const positions  = new Map()  // driverId (Number) → { lat, lng, orderId, ts }
const orderDriver = new Map() // orderId → userId du livreur (pour le tracking acheteur)

// ── Connexions SSE ─────────────────────────────────────────────────────────────

function addClient(userId, res) {
  clients.set(Number(userId), res)
}

function removeClient(userId) {
  clients.delete(Number(userId))
}

/**
 * Pousse un événement SSE à un utilisateur précis.
 * @returns {boolean} true si l'utilisateur était connecté
 */
function pushToUser(userId, event, data) {
  const res = clients.get(Number(userId))
  if (!res) return false
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    return true
  } catch {
    clients.delete(Number(userId))
    return false
  }
}

/**
 * Pousse à tous les clients actuellement connectés (broadcast).
 */
function broadcast(event, data) {
  clients.forEach((res, uid) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    } catch {
      clients.delete(uid)
    }
  })
}

function connectedCount() {
  return clients.size
}

// ── GPS positions ─────────────────────────────────────────────────────────────

/**
 * Enregistre la position GPS d'un livreur.
 * @param {number} driverId
 * @param {number} driverUserId  — userId (pour le mapping orderId→userId)
 * @param {{ lat, lng, orderId }} pos
 */
function setDriverLocation(driverId, driverUserId, pos) {
  const entry = { lat: pos.lat, lng: pos.lng, orderId: pos.orderId || null, ts: Date.now() }
  positions.set(Number(driverId), entry)
  if (pos.orderId) orderDriver.set(Number(pos.orderId), Number(driverUserId))
}

/**
 * Retourne la dernière position connue d'un livreur par son driverId.
 */
function getDriverLocation(driverId) {
  return positions.get(Number(driverId)) || null
}

/**
 * Retourne la position du livreur assigné à une commande.
 */
function getLocationForOrder(orderId) {
  const driverUserId = orderDriver.get(Number(orderId))
  if (!driverUserId) return null
  // Cherche dans positions par orderId
  for (const [dId, pos] of positions.entries()) {
    if (pos.orderId === Number(orderId)) return pos
  }
  return null
}

// Nettoyage des positions âgées de plus de 10 minutes (livreur arrêté)
setInterval(() => {
  const limit = Date.now() - 10 * 60 * 1000
  for (const [dId, pos] of positions.entries()) {
    if (pos.ts < limit) positions.delete(dId)
  }
}, 5 * 60 * 1000)

module.exports = {
  addClient, removeClient, pushToUser, broadcast, connectedCount,
  setDriverLocation, getDriverLocation, getLocationForOrder,
}
