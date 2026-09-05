const prisma = require('../lib/prisma')
const { pushToUser } = require('./sse')
const { isFreshLocation, haversineKm } = require('../lib/gps')

// distanceKm optionnel (LOT5) : absent pour tout appelant qui ne le calcule
// pas (ex. admin.js candidates avant cette évolution) — dans ce cas le score
// est inchangé (bonus de proximité neutre à 0), pas pénalisé. Bonus maximal
// à distance ~0, dégressif jusqu'à 15 km puis nul au-delà — poids comparable
// à celui de la note (0.4) pour que la proximité pèse réellement sur le choix.
const computeScore = (driver, distanceKm = null) =>
  (driver.plan === 'PREMIUM' ? 0.3 : 0) +
  (driver.rating / 5) * 0.4 +
  driver.acceptanceRate * 0.35 +
  Math.min(driver.totalDeliveries / 100, 1) * 0.25 +
  (distanceKm == null ? 0 : Math.max(0, 1 - Math.min(distanceKm, 15) / 15) * 0.4)

// ── Vérification des seuils de pénalité ──────────────────────────────────────
async function applyPenaltyAndCheck(driverId, settings) {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: { user: { select: { id: true } } },
  })
  if (!driver) return
  if (driver.status === 'SUSPENDED' || driver.status === 'REJECTED') return

  const warn1Rate   = settings?.penaltyWarn1Rate   ?? 0.70
  const warn2Rate   = settings?.penaltyWarn2Rate   ?? 0.50
  const suspendRate = settings?.penaltySuspendRate ?? 0.30
  const rate = driver.acceptanceRate

  let newWarningCount = driver.warningCount
  let shouldSuspend = false
  let eventType = null
  let eventPayload = {}

  if (rate <= suspendRate) {
    shouldSuspend = true
    eventType = 'penalty_suspended'
    eventPayload = {
      type: 'AUTO_SUSPENDED',
      message: `Votre compte a été suspendu automatiquement. Taux d'acceptation : ${Math.round(rate * 100)}%.`,
      rate: Math.round(rate * 100),
    }
  } else if (rate <= warn2Rate && driver.warningCount < 2) {
    newWarningCount = 2
    eventType = 'penalty_warning'
    eventPayload = {
      type: 'WARNING_2',
      message: `Avertissement 2/2 — taux d'acceptation : ${Math.round(rate * 100)}%. Encore une baisse et votre compte sera suspendu.`,
      rate: Math.round(rate * 100),
      count: 2,
    }
  } else if (rate <= warn1Rate && driver.warningCount < 1) {
    newWarningCount = 1
    eventType = 'penalty_warning'
    eventPayload = {
      type: 'WARNING_1',
      message: `Avertissement 1/2 — taux d'acceptation : ${Math.round(rate * 100)}%. Améliorez votre taux pour éviter une suspension.`,
      rate: Math.round(rate * 100),
      count: 1,
    }
  }

  if (!eventType) return

  const updateData = { warningCount: newWarningCount }
  if (shouldSuspend) {
    Object.assign(updateData, { status: 'SUSPENDED', autoSuspended: true, online: false, available: false })
  }
  await prisma.driver.update({ where: { id: driverId }, data: updateData })

  try {
    if (driver.user?.id) pushToUser(driver.user.id, eventType, eventPayload)
  } catch {}

  try {
    const { notify } = require('./notifications')
    if (driver.user?.id) await notify(
      driver.user.id,
      eventPayload.type,
      shouldSuspend ? 'Compte suspendu automatiquement' : `Avertissement ${newWarningCount}/2`,
      eventPayload.message,
      { driverId }
    )
  } catch {}
}

async function assignOrder(orderId) {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
  const expiryMinutes = settings?.offerExpiryMin ?? 15
  const maxAttempts = settings?.maxOfferAttempts ?? 3

  const existing = await prisma.driverOffer.findUnique({ where: { orderId } })
  const attempt = existing ? existing.attempt : 1

  if (attempt > maxAttempts) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'ESCALATED' },
    })
    return null
  }

  // Exclusion CUMULATIVE sur tout l'historique de la commande (LOT5) : DriverOffer
  // n'a qu'une ligne par commande (réécrite à chaque réaffectation), donc se fier
  // à elle seule ne permet d'exclure que le tout dernier livreur sollicité, pas
  // ceux des tentatives précédentes — qui pourraient sinon être re-proposés.
  const history = await prisma.driverOfferHistory.findMany({ where: { orderId }, select: { driverId: true } })
  const excludeDriverIds = [...new Set(history.map(h => h.driverId))]

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { shop: { select: { latitude: true, longitude: true } } },
  })
  const shopLat = order?.shop?.latitude
  const shopLng = order?.shop?.longitude

  const drivers = await prisma.driver.findMany({
    where: {
      online: true,
      available: true,
      id: { notIn: excludeDriverIds },
      rating: { gte: settings?.minDriverRating ?? 3.5 },
    },
    include: { currentLocation: true },
  })

  if (!drivers.length) return null

  const scored = drivers.map(d => {
    let distanceKm = null
    if (shopLat != null && shopLng != null && d.currentLocation && isFreshLocation(d.currentLocation.updatedAt)) {
      distanceKm = haversineKm(shopLat, shopLng, d.currentLocation.lat, d.currentLocation.lng)
    }
    return { ...d, distanceKm, score: computeScore(d, distanceKm) }
  }).sort((a, b) => b.score - a.score)
  const best = scored[0]

  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

  if (existing) {
    await prisma.driverOffer.update({
      where: { orderId },
      data: { driverId: best.id, status: 'PENDING', attempt, expiresAt },
    })
  } else {
    await prisma.driverOffer.create({
      data: { orderId, driverId: best.id, status: 'PENDING', attempt, expiresAt },
    })
  }
  await prisma.driverOfferHistory.create({ data: { orderId, driverId: best.id } })

  // Charger l'offre complète pour la notification SSE
  try {
    const offer = await prisma.driverOffer.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            buyer:  { select: { name: true, phone: true } },
            shop:   { select: { name: true, location: true } },
            items:  { include: { product: { select: { name: true } } } },
          },
        },
      },
    })
    if (offer && best.userId) {
      pushToUser(best.userId, 'new_offer', offer)
    }
  } catch {
    // SSE optionnel : ne jamais crasher le moteur d'assignation
  }

  return best
}

async function checkExpiredOffers() {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
  const expired = await prisma.driverOffer.findMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
  })

  for (const offer of expired) {
    await prisma.driverOffer.update({ where: { id: offer.id }, data: { status: 'EXPIRED' } })

    // Pénaliser le taux d'acceptation du livreur
    const driver = await prisma.driver.findUnique({ where: { id: offer.driverId } })
    if (driver) {
      const newRate = Math.max(0, driver.acceptanceRate - 0.05)
      await prisma.driver.update({ where: { id: driver.id }, data: { acceptanceRate: newRate } })
      await applyPenaltyAndCheck(driver.id, settings)
    }

    // Réassigner
    const nextAttempt = offer.attempt + 1
    await prisma.driverOffer.update({ where: { id: offer.id }, data: { attempt: nextAttempt } })
    await assignOrder(offer.orderId)
  }
}

// Lancement du moteur
let engineInterval = null

function startEngine() {
  if (engineInterval) return
  engineInterval = setInterval(checkExpiredOffers, 30 * 1000)
  console.log('⚙️  Moteur d\'assignation démarré (interval: 30s)')
}

function stopEngine() {
  if (engineInterval) clearInterval(engineInterval)
  engineInterval = null
}

module.exports = { assignOrder, startEngine, stopEngine, computeScore, applyPenaltyAndCheck }
