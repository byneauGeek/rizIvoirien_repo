const { prisma, createUser, uniqueEmail } = require('./helpers')
const { checkExpiredListings, LISTING_LIFETIME_DAYS } = require('../src/services/b2bExpiry')

async function makeProducer(overrides = {}) {
  const user = await createUser('PRODUCER', overrides)
  const producer = await prisma.producer.create({ data: { userId: user.id, region: 'Bouaké' } })
  return { user, producer }
}

async function makeProcessor(overrides = {}) {
  const user = await createUser('PROCESSOR', overrides)
  const processor = await prisma.processor.create({ data: { userId: user.id, companyName: 'Rizerie test' } })
  return { user, processor }
}

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

describe('B2B — expiration automatique des annonces', () => {
  test('une offre plus vieille que la durée de vie passe à EXPIRED et notifie le propriétaire', async () => {
    const { user, producer } = await makeProducer()
    const offer = await prisma.riceOffer.create({
      data: {
        producerId: producer.id, product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Bouaké',
        status: 'AVAILABLE', createdAt: daysAgo(LISTING_LIFETIME_DAYS + 1),
      },
    })

    await checkExpiredListings()

    const updated = await prisma.riceOffer.findUnique({ where: { id: offer.id } })
    expect(updated.status).toBe('EXPIRED')

    const notif = await prisma.notification.findFirst({ where: { userId: user.id, type: 'B2B_OFFER_EXPIRED' } })
    expect(notif).toBeTruthy()
  })

  test('une offre récente n\'est pas touchée', async () => {
    const { producer } = await makeProducer()
    const offer = await prisma.riceOffer.create({
      data: {
        producerId: producer.id, product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Bouaké',
        status: 'AVAILABLE', createdAt: daysAgo(1),
      },
    })

    await checkExpiredListings()

    const updated = await prisma.riceOffer.findUnique({ where: { id: offer.id } })
    expect(updated.status).toBe('AVAILABLE')
  })

  test('une demande expirée passe à EXPIRED et notifie son auteur', async () => {
    const { user, processor } = await makeProcessor()
    const req = await prisma.purchaseRequest.create({
      data: {
        processorId: processor.id, product: 'Riz paddy', quantity: 50, unit: 'tonne', region: 'Bouaké',
        status: 'ACTIVE', createdAt: daysAgo(LISTING_LIFETIME_DAYS + 5),
      },
    })

    await checkExpiredListings()

    const updated = await prisma.purchaseRequest.findUnique({ where: { id: req.id } })
    expect(updated.status).toBe('EXPIRED')

    const notif = await prisma.notification.findFirst({ where: { userId: user.id, type: 'B2B_REQUEST_EXPIRED' } })
    expect(notif).toBeTruthy()
  })

  test('une offre déjà vendue n\'est jamais réétiquetée EXPIRED', async () => {
    const { producer } = await makeProducer()
    const offer = await prisma.riceOffer.create({
      data: {
        producerId: producer.id, product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Bouaké',
        status: 'SOLD', createdAt: daysAgo(LISTING_LIFETIME_DAYS + 10),
      },
    })

    await checkExpiredListings()

    const updated = await prisma.riceOffer.findUnique({ where: { id: offer.id } })
    expect(updated.status).toBe('SOLD')
  })
})
