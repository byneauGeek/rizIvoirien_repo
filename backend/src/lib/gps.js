// Seuil de fraîcheur GPS partagé entre le suivi de commande (orders.js) et le
// moteur d'affectation (assignmentEngine.js, LOT5) — une position plus vieille
// que ça est traitée comme absente, pas comme une position lointaine.
const GPS_STALE_MS = 10 * 60 * 1000

function isFreshLocation(updatedAt) {
  return !!updatedAt && (Date.now() - new Date(updatedAt).getTime()) < GPS_STALE_MS
}

// Distance à vol d'oiseau (km) — suffisant pour classer des candidats par
// proximité, pas pour un calcul d'itinéraire réel.
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

module.exports = { GPS_STALE_MS, isFreshLocation, haversineKm }
