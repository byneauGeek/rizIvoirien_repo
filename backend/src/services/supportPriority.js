const prisma = require('../lib/prisma')

// LOT SUPPORT (retour utilisateur) : détermine si un ticket doit être
// PRIORITY à l'ouverture — reflète le standing RÉEL de l'utilisateur
// (boutique CERTIFIÉE ou livreur PREMIUM), jamais un rôle générique. Un
// acheteur (pas de notion de plan) est toujours NORMAL.
async function resolveTicketPriority(user) {
  if (user.role === 'SELLER') {
    const shop = await prisma.shop.findUnique({ where: { userId: user.id }, select: { plan: true } })
    if (shop?.plan === 'CERTIFIED') return 'PRIORITY'
  }
  if (user.role === 'DRIVER') {
    const driver = await prisma.driver.findUnique({ where: { userId: user.id }, select: { plan: true } })
    if (driver?.plan === 'PREMIUM') return 'PRIORITY'
  }
  return 'NORMAL'
}

module.exports = { resolveTicketPriority }
