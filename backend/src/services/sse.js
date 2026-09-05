/**
 * SSE (Server-Sent Events) manager
 *
 * - clients : Map<userId, res> — connexions SSE actives
 *
 * La position GPS des livreurs n'est plus stockée ici depuis le LOT 1
 * (Logistique, arbitrage Décision 4) : ce Map en mémoire ne survivait pas à
 * un redémarrage serveur. Elle est désormais persistée dans
 * DriverCurrentLocation (voir routes/drivers.js POST /location et
 * routes/orders.js GET /:id/track).
 */

const clients = new Map()  // userId (Number) → SSE res

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

module.exports = {
  addClient, removeClient, pushToUser, broadcast, connectedCount,
}
