const { calcDeliveryFee } = require('../src/services/deliveryService')

const VEHICLE_TYPES = [
  { code: 'VELO',        capacityKg: 20,   active: true, maxDeliveryFee: 3000 },
  { code: 'MOTO',        capacityKg: 50,   active: true, maxDeliveryFee: 8000 },
  { code: 'TRICYCLE',    capacityKg: 300,  active: true, maxDeliveryFee: 15000 },
  { code: 'VOITURE',     capacityKg: 400,  active: true, maxDeliveryFee: 20000 },
  { code: 'CAMIONNETTE', capacityKg: 1500, active: true, maxDeliveryFee: 50000 },
]

describe('LOT 6 — tarification consciente du véhicule (arbitrage Décision 5)', () => {
  test('sans VehicleType (rétro-compatibilité) : plafond plat de PlatformSettings, comportement inchangé', () => {
    const fee = calcDeliveryFee(500, 10, 10000, { deliveryMaxPrice: 8000 }, 0, [])
    // 500 (base) + 500*25 (poids) + 10*100 (distance) = 14000, plafonné à 8000
    expect(fee).toBe(8000)
  })

  test('exemple chiffré : une commande de 500 kg n\'est plus plafonnée au même prix qu\'une commande de 300 kg', () => {
    const settings = { deliveryMaxPrice: 8000 } // valeur globale historique, ne doit plus s'appliquer ici
    const fee300 = calcDeliveryFee(300, 10, 10000, settings, 0, VEHICLE_TYPES)
    const fee500 = calcDeliveryFee(500, 10, 10000, settings, 0, VEHICLE_TYPES)

    // 300 kg : brut = 500 + 300*25 + 1000 = 9000 → TRICYCLE (300 kg, plafond 15000) : pas plafonné
    expect(fee300).toBe(9000)
    // 500 kg : brut = 500 + 500*25 + 1000 = 14000 → aucun véhicule <= 400kg ne convient,
    // CAMIONNETTE (1500 kg, plafond 50000) s'applique : pas plafonné non plus
    expect(fee500).toBe(14000)
    // Avant ce lot, les deux auraient été plafonnés à 8000 FCFA : le poids
    // devient enfin significatif au-delà de ~300 kg.
    expect(fee500).toBeGreaterThan(fee300)
    expect(fee300).toBeLessThan(8000 * 2) // sanity : pas un chiffre aberrant
  })

  test('commande légère : cap VELO (le plus petit véhicule suffisant) atteint, comportement conservateur', () => {
    // 15 kg, longue distance : brut = 500 + 15*25 + 50*100 = 5875 → VELO (20kg, cap 3000)
    const fee = calcDeliveryFee(15, 50, 10000, {}, 0, VEHICLE_TYPES)
    expect(fee).toBe(3000)
  })

  test('commande plus lourde que le plus gros véhicule connu : plafonnée au plafond du plus gros véhicule (pas illimitée)', () => {
    const fee = calcDeliveryFee(5000, 5, 10000, {}, 0, VEHICLE_TYPES)
    // brut = 500 + 5000*25 + 500 = 126000, plafonné à celui de CAMIONNETTE (50000)
    expect(fee).toBe(50000)
  })

  test('VehicleType présents mais sans maxDeliveryFee configuré : retombe sur PlatformSettings', () => {
    const noCapConfigured = VEHICLE_TYPES.map(v => ({ ...v, maxDeliveryFee: null }))
    const fee = calcDeliveryFee(500, 10, 10000, { deliveryMaxPrice: 8000 }, 0, noCapConfigured)
    expect(fee).toBe(8000)
  })

  test('livraison gratuite au-dessus du seuil reste prioritaire sur tout plafond par véhicule', () => {
    const fee = calcDeliveryFee(500, 10, 50000, { deliveryFreeAbove: 30000 }, 0, VEHICLE_TYPES)
    expect(fee).toBe(0)
  })
})
