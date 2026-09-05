const https = require('https')
const { haversineKm } = require('../lib/gps')

// Coefficient route / vol-d'oiseau pour villes africaines
const ROAD_FACTOR = 1.4

function parseWeightKg(unit) {
  const m = String(unit || '').match(/^(\d+(?:\.\d+)?)\s*kg$/i)
  return m ? parseFloat(m[1]) : 1
}

function geocodeAddress(address) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(`${address}, Côte d'Ivoire`)
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path: `/search?format=json&q=${q}&limit=1&countrycodes=ci`,
      headers: { 'User-Agent': 'RizIvoirien/1.0 (contact@rizivoirien.ci)' },
    }
    const req = https.get(options, (res) => {
      let raw = ''
      res.on('data', c => { raw += c })
      res.on('end', () => {
        try {
          const list = JSON.parse(raw)
          if (list.length) resolve({ lat: parseFloat(list[0].lat), lng: parseFloat(list[0].lon) })
          else resolve(null)
        } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(6000, () => { req.destroy(); resolve(null) })
  })
}

// LOT 6 (arbitrage Décision 5) : le plafond n'est plus un forfait unique.
// L'audit avait constaté qu'un plafond fixe (8000 FCFA par défaut) rendait le
// poids non significatif au-delà d'environ 300 kg — toute commande plus
// lourde payait le même prix qu'une commande de 300 kg, alors qu'elle
// nécessite un véhicule plus grand pour de vrai. On choisit désormais le
// plus PETIT VehicleType actif capable de porter le poids (LOT4) et on
// applique SON plafond — une camionnette a un plafond bien plus haut qu'une
// moto. Rétro-compatible : si aucun VehicleType actif n'a de maxDeliveryFee
// configuré (catégories non encore renseignées, ou table vide), on retombe
// sur PlatformSettings.deliveryMaxPrice, comportement identique à avant.
function resolveMaxFee(weightKg, settings, vehicleTypes) {
  const eligible = (vehicleTypes || [])
    .filter(vt => vt.active && vt.maxDeliveryFee != null)
    .sort((a, b) => a.capacityKg - b.capacityKg)

  if (!eligible.length) return settings?.deliveryMaxPrice ?? 8000

  const fitting = eligible.find(vt => vt.capacityKg >= weightKg)
  // Commande plus lourde que le plus gros véhicule connu : on applique quand
  // même un plafond (celui du plus gros véhicule) plutôt que de laisser le
  // prix grimper sans limite sur une simple erreur de saisie de poids.
  return (fitting || eligible[eligible.length - 1]).maxDeliveryFee
}

function calcDeliveryFee(weightKg, distanceKm, orderTotal, settings, additionalShops = 0, vehicleTypes = []) {
  const s = settings || {}
  const base       = s.deliveryBasePrice    ?? 500
  const perKg      = s.deliveryPricePerKg   ?? 25
  const perKm      = s.deliveryPricePerKm   ?? 100
  const freeAbove  = s.deliveryFreeAbove    ?? 0
  const pickupFee  = s.additionalPickupFee  ?? 500

  if (freeAbove > 0 && orderTotal >= freeAbove) return 0

  const weightCost   = Math.round(weightKg  * perKg)
  const distanceCost = Math.round(distanceKm * perKm)
  const pickupCost   = Math.round(additionalShops * pickupFee)
  let fee = base + weightCost + distanceCost + pickupCost

  const maxFee = resolveMaxFee(weightKg, s, vehicleTypes)
  if (maxFee > 0) fee = Math.min(fee, maxFee)
  return Math.round(fee)
}

async function estimateDelivery({ items, products, shopCoords, deliveryAddress, settings, additionalShops = 0, vehicleTypes = [] }) {
  const weightKg = items.reduce((sum, item) => {
    const p = products.find(pr => pr.id === item.productId)
    return sum + parseWeightKg(p?.unit) * item.quantity
  }, 0)

  const orderTotal = items.reduce((sum, item) => {
    const p = products.find(pr => pr.id === item.productId)
    return sum + (p?.price || 0) * item.quantity
  }, 0)

  let distanceKm = 0
  let geocoded = false

  if (shopCoords && deliveryAddress) {
    const destCoords = await geocodeAddress(deliveryAddress)
    if (destCoords) {
      const crow = haversineKm(shopCoords.lat, shopCoords.lng, destCoords.lat, destCoords.lng)
      distanceKm = Math.round(crow * ROAD_FACTOR * 10) / 10
      geocoded = true
    }
  }

  const s = settings || {}
  const base         = s.deliveryBasePrice   ?? 500
  const perKg        = s.deliveryPricePerKg  ?? 25
  const perKm        = s.deliveryPricePerKm  ?? 100
  const pickupFee    = s.additionalPickupFee ?? 500
  const weightCost   = Math.round(weightKg   * perKg)
  const distanceCost = Math.round(distanceKm * perKm)
  const pickupCost   = Math.round(additionalShops * pickupFee)

  return {
    deliveryFee: calcDeliveryFee(weightKg, distanceKm, orderTotal, settings, additionalShops, vehicleTypes),
    weightKg:    Math.round(weightKg * 10) / 10,
    distanceKm,
    geocoded,
    additionalShops,
    breakdown: { base, weightCost, distanceCost, pickupCost },
  }
}

module.exports = { parseWeightKg, haversineKm, geocodeAddress, calcDeliveryFee, estimateDelivery, ROAD_FACTOR }
