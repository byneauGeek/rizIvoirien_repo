const https = require('https')
const { haversineKm } = require('../lib/gps')
const pricingEngine = require('./pricingEngine')

// Coefficient route / vol-d'oiseau pour villes africaines
const ROAD_FACTOR = 1.4

function parseWeightKg(unit) {
  const m = String(unit || '').match(/^(\d+(?:\.\d+)?)\s*kg$/i)
  return m ? parseFloat(m[1]) : 1
}

// LOT 6 (Arbitrage XXX RIZ) : contrairement au catalogue B2C (Product.unit
// est toujours un poids explicite, ex. "50kg"), une transaction B2B décrit sa
// quantité en unité commerciale libre (kg | tonne | sac — cahier de cadrage
// filière riz) qui n'est pas un poids en soi. Conversion approximative
// documentée plutôt que silencieuse : 1 sac ≈ 50 kg (standard riz en Côte
// d'Ivoire), 1 tonne = 1000 kg. Une unité inconnue retombe sur l'hypothèse
// "sac" (la plus fréquente dans ce marché) plutôt que de bloquer le calcul.
const B2B_UNIT_TO_KG = { kg: 1, sac: 50, tonne: 1000, tonnes: 1000 }
function estimateB2BWeightKg(quantity, unit) {
  const factor = B2B_UNIT_TO_KG[String(unit || '').trim().toLowerCase()] ?? B2B_UNIT_TO_KG.sac
  return Number(quantity || 0) * factor
}

// LOT 18 (préparation production) : la politique d'usage de Nominatim (API
// publique gratuite, sans clé) impose un maximum d'1 requête/seconde — au-delà,
// l'IP du serveur peut être bloquée, cassant le géocodage pour TOUTE
// l'application (estimation de commande ET dropoff paresseux des Shipment,
// LOT8, qui partagent cette même fonction). Rien ne l'empêchait jusqu'ici :
// plusieurs commandes/livraisons ayant besoin d'un géocodage au même moment
// pouvaient partir en parallèle. File d'attente globale, en mémoire de
// process — suffisant pour une seule instance ; à revoir (Redis) si le
// backend passe un jour en plusieurs instances.
const MIN_GEOCODE_INTERVAL_MS = 1100
let geocodeQueueTail = Promise.resolve()

function throttledGeocode(address) {
  const run = geocodeQueueTail.then(() => rawGeocodeAddress(address))
  // La prochaine requête de la file attend au moins MIN_GEOCODE_INTERVAL_MS
  // après le DÉBUT de celle-ci, qu'elle réussisse ou échoue.
  geocodeQueueTail = run.catch(() => {}).then(() => new Promise(r => setTimeout(r, MIN_GEOCODE_INTERVAL_MS)))
  return run
}

function rawGeocodeAddress(address) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(`${address}, Côte d'Ivoire`)
    // LOT 6 (Arbitrage XXX RIZ) : addressdetails=1 ajouté pour extraire la
    // ville/commune de la destination, SANS requête supplémentaire (même
    // appel Nominatim déjà fait pour la distance) — sert à résoudre la Zone
    // de destination pour la tarification par zone (voir resolveZoneIdForCity
    // ci-dessous). N'affecte pas lat/lng, donc rétro-compatible avec tous les
    // appelants existants (ETA, haversine) qui ignorent le champ city.
    const path = `/search?format=json&addressdetails=1&q=${q}&limit=1&countrycodes=ci`
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path,
      headers: { 'User-Agent': 'RizIvoirien/1.0 (contact@rizivoirien.ci)' },
    }
    const req = https.get(options, (res) => {
      let raw = ''
      res.on('data', c => { raw += c })
      res.on('end', () => {
        try {
          const list = JSON.parse(raw)
          if (!list.length) return resolve(null)
          const a = list[0].address || {}
          const city = a.city || a.town || a.municipality || a.county || a.suburb || null
          resolve({ lat: parseFloat(list[0].lat), lng: parseFloat(list[0].lon), city })
        } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(6000, () => { req.destroy(); resolve(null) })
  })
}

// LOT 6 : résout une Zone à partir du nom de ville renvoyé par le géocodage —
// correspondance insensible à la casse sur Zone.city, puis Zone.name en repli
// (une zone peut porter le nom de sa ville, ex. "Abidjan"). Retourne null si
// aucune zone ne correspond (corridor "joker" utilisé par le moteur de
// tarification) — jamais une erreur, la ville peut simplement ne pas encore
// être configurée comme Zone.
async function resolveZoneIdForCity(prisma, cityName) {
  if (!cityName) return null
  const zones = await prisma.zone.findMany({ where: { active: true } })
  const norm = cityName.trim().toLowerCase()
  const byCity = zones.find(z => z.city && z.city.trim().toLowerCase() === norm)
  if (byCity) return byCity.id
  const byName = zones.find(z => z.name && z.name.trim().toLowerCase() === norm)
  return byName ? byName.id : null
}

function geocodeAddress(address) {
  return throttledGeocode(address)
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

// LOT 6 : prisma/segment/serviceLevel/originZoneId sont optionnels et
// rétro-compatibles — si prisma n'est pas fourni (ou qu'aucune PricingRule
// active ne couvre ce segment/serviceLevel), le calcul retombe entièrement
// sur l'ancien forfait calcDeliveryFee(), comportement identique à avant ce
// lot pour tout appelant qui ne passe pas ces nouveaux paramètres.
async function estimateDelivery({
  items, products, shopCoords, deliveryAddress, settings, additionalShops = 0, vehicleTypes = [],
  prisma = null, segment = 'SMALL_MEDIUM', serviceLevel = 'STANDARD', originZoneId = null,
  variantsById = null, // LOT VARIANTS : Map<variantId, ProductVariant> — optionnel, comportement inchangé si absent
}) {
  // Résout unit/price depuis la variante choisie si item.variantId est
  // renseigné ET connue de variantsById, sinon depuis le produit de base
  // (comportement historique inchangé pour tout appelant qui ne passe pas
  // variantsById ou pour une ligne sans variante).
  const resolveUnitPrice = (item, product) => {
    if (item.variantId && variantsById) {
      const variant = variantsById.get(item.variantId)
      if (variant) return { unit: variant.unit, price: variant.price }
    }
    return { unit: product?.unit, price: product?.price }
  }

  const weightKg = items.reduce((sum, item) => {
    const p = products.find(pr => pr.id === item.productId)
    return sum + parseWeightKg(resolveUnitPrice(item, p).unit) * item.quantity
  }, 0)

  const orderTotal = items.reduce((sum, item) => {
    const p = products.find(pr => pr.id === item.productId)
    return sum + (resolveUnitPrice(item, p).price || 0) * item.quantity
  }, 0)

  let distanceKm = 0
  let geocoded = false
  let destinationZoneId = null

  if (shopCoords && deliveryAddress) {
    const destCoords = await geocodeAddress(deliveryAddress)
    if (destCoords) {
      const crow = haversineKm(shopCoords.lat, shopCoords.lng, destCoords.lat, destCoords.lng)
      distanceKm = Math.round(crow * ROAD_FACTOR * 10) / 10
      geocoded = true
      if (prisma) destinationZoneId = await resolveZoneIdForCity(prisma, destCoords.city)
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
  const freeAbove    = s.deliveryFreeAbove   ?? 0

  let pricing = null
  if (prisma && !(freeAbove > 0 && orderTotal >= freeAbove)) {
    pricing = await pricingEngine.computePricing(prisma, {
      segment, serviceLevel, originZoneId, destinationZoneId,
      weightKg, distanceKm, packages: 1, extraOrigins: additionalShops,
    }).catch(() => null)
  }

  const deliveryFee = pricing
    ? pricing.customerPrice
    : calcDeliveryFee(weightKg, distanceKm, orderTotal, settings, additionalShops, vehicleTypes)

  return {
    deliveryFee,
    weightKg:    Math.round(weightKg * 10) / 10,
    distanceKm,
    geocoded,
    additionalShops,
    breakdown: { base, weightCost, distanceCost, pickupCost },
    // LOT 6 : présent uniquement quand une PricingRule a réellement été
    // appliquée — permet à l'appelant (routes) de persister la décomposition
    // coût interne / marge pour audit, sans jamais l'inventer si aucune règle
    // n'est configurée (pricingRuleId reste alors absent).
    pricingRuleId: pricing?.pricingRuleId ?? null,
    internalCost: pricing?.internalCost ?? null,
    platformMargin: pricing?.platformMargin ?? null,
    serviceLevel,
    destinationZoneId,
  }
}

module.exports = {
  parseWeightKg, estimateB2BWeightKg, haversineKm, geocodeAddress, calcDeliveryFee, estimateDelivery, ROAD_FACTOR,
  resolveZoneIdForCity,
}
