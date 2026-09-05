// LOT 6 (Arbitrage XXX RIZ, décision "tarification par zone réellement
// branchée") : moteur de tarification à 3 axes indépendants — SEGMENT
// (SMALL_MEDIUM = B2C consommateur | B2B_CARGO), SERVICE_LEVEL (ECONOMIC |
// STANDARD | EXPRESS, choisi par le client) et corridor (zone d'origine ->
// zone de destination). Sépare explicitement :
//   - COÛT INTERNE  : ce que la livraison coûte réellement à la plateforme
//   - PRIX CLIENT   : coût interne * (1 + marge) — jamais un % du panier
//   - MARGE/SUBVENTION plateforme = prix client - coût interne (peut être
//     négative : subvention assumée, pas une erreur)
// La rémunération du livreur (DRIVER PAY) reste calculée séparément, en aval,
// par payDriverForDelivery() dans deliveryLifecycle.js (commission sur le
// prix client) — ce moteur ne la touche pas. Il n'existe pas de réseau de
// transporteurs tiers dans cette plateforme (les livreurs sont le réseau
// propre de la plateforme) : la dimension "CARRIER FEE" évoquée dans
// l'arbitrage ne s'applique donc à aucune donnée réelle ici — sciemment
// absente plutôt que mockée.
//
// Repli : si aucune PricingRule active ne correspond au (segment,
// serviceLevel) demandé (grille pas encore configurée par l'admin pour cet
// axe), computePricing() renvoie null — l'appelant retombe alors sur l'ancien
// calcul forfaitaire (calcDeliveryFee, deliveryService.js). Jamais de rupture.

const VALID_SEGMENTS = ['SMALL_MEDIUM', 'B2B_CARGO']
const VALID_SERVICE_LEVELS = ['ECONOMIC', 'STANDARD', 'EXPRESS']

// Résout la meilleure règle disponible par ordre de spécificité décroissante :
// corridor exact > origine précise (destination joker) > destination précise
// (origine jokère) > joker complet. Le segment et le serviceLevel, eux, ne
// tolèrent AUCUN repli l'un vers l'autre — ce sont des choix délibérés
// (nature du fret, rapidité voulue), jamais interchangeables.
async function resolvePricingRule(prisma, { segment, serviceLevel, originZoneId, destinationZoneId }) {
  const candidates = [
    { originZoneId: originZoneId ?? undefined, destinationZoneId: destinationZoneId ?? undefined },
  ]
  if (originZoneId != null && destinationZoneId != null) {
    candidates.push({ originZoneId, destinationZoneId: null })
    candidates.push({ originZoneId: null, destinationZoneId })
  } else if (originZoneId != null) {
    candidates.push({ originZoneId, destinationZoneId: null })
  } else if (destinationZoneId != null) {
    candidates.push({ originZoneId: null, destinationZoneId })
  }
  candidates.push({ originZoneId: null, destinationZoneId: null })

  for (const where of candidates) {
    const rule = await prisma.pricingRule.findFirst({
      where: { segment, serviceLevel, active: true, originZoneId: where.originZoneId, destinationZoneId: where.destinationZoneId },
    })
    if (rule) return rule
  }
  return null
}

function computeInternalCost(rule, { weightKg = 0, distanceKm = 0, packages = 1, extraOrigins = 0, extraStops = 0 }) {
  const weightCost   = Math.round(weightKg * rule.pricePerKg)
  const distanceCost = Math.round(distanceKm * rule.pricePerKm)
  const packageCost  = Math.round(Math.max(0, packages - 1) * rule.pricePerPackage)
  const originCost   = Math.round(extraOrigins * rule.pricePerExtraOrigin)
  const stopCost     = Math.round(extraStops * rule.pricePerExtraStop)
  return {
    internalCost: rule.basePrice + weightCost + distanceCost + packageCost + originCost + stopCost,
    breakdown: { base: rule.basePrice, weightCost, distanceCost, packageCost, originCost, stopCost },
  }
}

async function computePricing(prisma, params) {
  const { segment, serviceLevel } = params
  if (!VALID_SEGMENTS.includes(segment) || !VALID_SERVICE_LEVELS.includes(serviceLevel)) {
    throw new Error('segment ou serviceLevel invalide')
  }

  const rule = await resolvePricingRule(prisma, params)
  if (!rule) return null

  const { internalCost, breakdown } = computeInternalCost(rule, params)
  let customerPrice = Math.round(internalCost * (1 + rule.marginPct))
  if (rule.maxDeliveryFee != null) customerPrice = Math.min(customerPrice, rule.maxDeliveryFee)
  const platformMargin = customerPrice - internalCost

  return {
    pricingRuleId: rule.id,
    internalCost,
    customerPrice,
    platformMargin,
    breakdown,
  }
}

module.exports = { VALID_SEGMENTS, VALID_SERVICE_LEVELS, resolvePricingRule, computeInternalCost, computePricing }
