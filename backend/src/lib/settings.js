const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * Retourne les PlatformSettings depuis la DB.
 * Si aucune ligne n'existe encore, en crée une avec les valeurs par défaut
 * définies dans le schéma Prisma — aucune valeur n'est jamais codée en dur ici.
 */
async function getSettings() {
  return prisma.platformSettings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1 },
  })
}

/**
 * Retourne le taux de commission du livreur selon son plan.
 * Source unique : PlatformSettings admin.
 */
function driverRate(settings, plan) {
  return plan === 'PREMIUM'
    ? settings.premiumDriverCommission
    : settings.driverCommission
}

/**
 * LOT PLANS (retour utilisateur) : taux de commission plateforme sur une
 * vente boutique, selon son plan — même principe que driverRate ci-dessus.
 * Une boutique CERTIFIÉE paie moins (garde une plus grande part de chaque
 * vente) que le taux plat appliqué à toutes jusqu'ici.
 */
function sellerRate(settings, plan) {
  return plan === 'CERTIFIED'
    ? settings.certifiedCommissionRate
    : settings.commissionRate
}

module.exports = { getSettings, driverRate, sellerRate }
