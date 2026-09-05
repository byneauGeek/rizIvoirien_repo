const prisma = require('./prisma')

// LOT 4/6 : catalogue des catégories de véhicule, avec plafond de frais par
// catégorie (LOT6) — MOTO reprend le plafond global historique (8000) pour
// ne rien changer au cas majoritaire ; les catégories plus grandes ont un
// plafond plus haut pour que le poids reste significatif au-delà de ~300 kg.
const DEFAULT_VEHICLE_TYPES = [
  { code: 'VELO',        label: 'Vélo',        capacityKg: 20,   maxDeliveryFee: 3000 },
  { code: 'MOTO',        label: 'Moto',        capacityKg: 50,   maxDeliveryFee: 8000 },
  { code: 'TRICYCLE',    label: 'Tricycle',    capacityKg: 300,  maxDeliveryFee: 15000 },
  { code: 'VOITURE',     label: 'Voiture',     capacityKg: 400,  maxDeliveryFee: 20000 },
  { code: 'CAMIONNETTE', label: 'Camionnette', capacityKg: 1500, maxDeliveryFee: 50000 },
]

// Même logique que getSettings() (lib/settings.js) : jamais de valeur codée
// en dur consommée directement, on s'assure juste qu'un jeu de départ
// exploitable existe avant de le lire. `code` étant unique, une double
// initialisation concurrente ne crée pas de doublons (la 2e upsert échoue
// silencieusement en no-op sur update:{}).
// Partagée entre admin.js (CRUD complet) et drivers.js (lecture seule, LOT12)
// — extraite ici pour que les deux bootstrapent le même jeu de départ plutôt
// que de dupliquer la liste.
async function ensureDefaultVehicleTypes() {
  const count = await prisma.vehicleType.count()
  if (count > 0) return
  for (const vt of DEFAULT_VEHICLE_TYPES) {
    await prisma.vehicleType.upsert({ where: { code: vt.code }, update: {}, create: vt })
  }
}

module.exports = { DEFAULT_VEHICLE_TYPES, ensureDefaultVehicleTypes }
