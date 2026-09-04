// Expiration automatique des offres/demandes B2B (cahier de cadrage §5 P1 :
// notifier l'expiration d'une offre). Ni RiceOffer ni PurchaseRequest n'ont de
// date d'expiration explicite dans le cadrage (seulement une date/période de
// disponibilité) — on retient une durée de vie fixe et raisonnable depuis la
// publication, cohérente avec l'usage classique des petites annonces.
const prisma = require('../lib/prisma')
const { notify } = require('../services/notifications')

const LISTING_LIFETIME_DAYS = 60

async function checkExpiredListings() {
  const cutoff = new Date(Date.now() - LISTING_LIFETIME_DAYS * 24 * 60 * 60 * 1000)

  const expiredOffers = await prisma.riceOffer.findMany({
    where: { status: 'AVAILABLE', createdAt: { lt: cutoff } },
    include: {
      producer: { select: { user: { select: { id: true } } } },
      cooperative: { select: { user: { select: { id: true } } } },
    },
  })
  for (const offer of expiredOffers) {
    await prisma.riceOffer.update({ where: { id: offer.id }, data: { status: 'EXPIRED' } })
    const ownerId = offer.producer?.user?.id ?? offer.cooperative?.user?.id
    if (ownerId) {
      await notify(ownerId, 'B2B_OFFER_EXPIRED', 'Offre expirée',
        `Votre offre de ${offer.product} (${offer.quantity} ${offer.unit}) a expiré après ${LISTING_LIFETIME_DAYS} jours sans transaction. Republiez-la si elle est toujours disponible.`,
        { offerId: offer.id })
    }
  }

  const expiredRequests = await prisma.purchaseRequest.findMany({
    where: { status: 'ACTIVE', createdAt: { lt: cutoff } },
    include: {
      trader: { select: { user: { select: { id: true } } } },
      processor: { select: { user: { select: { id: true } } } },
      exporter: { select: { user: { select: { id: true } } } },
    },
  })
  for (const request of expiredRequests) {
    await prisma.purchaseRequest.update({ where: { id: request.id }, data: { status: 'EXPIRED' } })
    const ownerId = request.trader?.user?.id ?? request.processor?.user?.id ?? request.exporter?.user?.id
    if (ownerId) {
      await notify(ownerId, 'B2B_REQUEST_EXPIRED', 'Demande expirée',
        `Votre demande de ${request.product} (${request.quantity} ${request.unit}) a expiré après ${LISTING_LIFETIME_DAYS} jours. Republiez-la si le besoin est toujours d'actualité.`,
        { requestId: request.id })
    }
  }

  return { offers: expiredOffers.length, requests: expiredRequests.length }
}

let engineInterval = null

function startB2BExpiryEngine() {
  if (engineInterval) return
  // Toutes les heures : l'expiration se joue à l'échelle du jour, pas besoin
  // d'un polling agressif comme le moteur de livraison (échelle de la seconde).
  engineInterval = setInterval(() => { checkExpiredListings().catch(() => {}) }, 60 * 60 * 1000)
  console.log('⚙️  Moteur d\'expiration B2B démarré (interval: 1h)')
}

function stopB2BExpiryEngine() {
  if (engineInterval) clearInterval(engineInterval)
  engineInterval = null
}

module.exports = { checkExpiredListings, startB2BExpiryEngine, stopB2BExpiryEngine, LISTING_LIFETIME_DAYS }
