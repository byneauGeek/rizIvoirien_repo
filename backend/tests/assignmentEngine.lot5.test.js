const { assignOrder } = require('../src/services/assignmentEngine')
const { prisma, createUser, createShopUser, createDriverUser } = require('./helpers')

async function makeOrder(shopId) {
  const buyer = await createUser('BUYER')
  return prisma.order.create({ data: { buyerId: buyer.id, shopId, status: 'PRET', total: 1000, address: 'x' } })
}

// assignOrder() interroge TOUS les livreurs online+available de la base — la
// base de test n'étant réinitialisée qu'une fois pour toute la suite, des
// livreurs créés par d'autres tests (ce fichier ou d'autres) resteraient
// candidats et rendraient le classement non déterministe. On neutralise donc
// tout livreur préexistant avant chaque test, pour n'avoir comme candidats
// que ceux créés par le test en cours.
beforeEach(async () => {
  await prisma.driver.updateMany({ data: { available: false } })
})

describe('LOT 5 — exclusion cumulative des livreurs déjà sollicités', () => {
  test('un livreur ayant déjà refusé/expiré ne peut plus être re-proposé sur la même commande', async () => {
    const { shop } = await createShopUser()
    const order = await makeOrder(shop.id)
    const { driver: d1 } = await createDriverUser()
    const { driver: d2 } = await createDriverUser()

    const first = await assignOrder(order.id)
    expect([d1.id, d2.id]).toContain(first.id)

    // Simule l'expiration + la tentative suivante, comme checkExpiredOffers
    await prisma.driverOffer.update({ where: { orderId: order.id }, data: { status: 'EXPIRED', attempt: 2 } })
    const second = await assignOrder(order.id)
    expect(second).toBeTruthy()
    expect(second.id).not.toBe(first.id)

    // Plus aucun livreur n'est éligible : les deux ont déjà été sollicités.
    // Avant ce lot, seul le dernier (second) aurait été exclu, et `first`
    // aurait pu être re-proposé ici — c'est exactement le bug corrigé.
    await prisma.driverOffer.update({ where: { orderId: order.id }, data: { status: 'EXPIRED', attempt: 3 } })
    const third = await assignOrder(order.id)
    expect(third).toBeNull()
  })
})

describe('LOT 5 — scoring par proximité GPS', () => {
  test('à mérites égaux, le livreur le plus proche (position GPS fraîche) est choisi', async () => {
    const { shop } = await createShopUser()
    await prisma.shop.update({ where: { id: shop.id }, data: { latitude: 5.359, longitude: -4.008 } })
    const order = await makeOrder(shop.id)

    const { driver: close } = await createDriverUser()
    const { driver: far } = await createDriverUser()
    await prisma.driverCurrentLocation.create({ data: { driverId: close.id, lat: 5.360, lng: -4.009 } })
    await prisma.driverCurrentLocation.create({ data: { driverId: far.id, lat: 6.5, lng: -5.5 } })

    const best = await assignOrder(order.id)
    expect(best.id).toBe(close.id)
  })

  test('une position GPS périmée (> 10 min) est ignorée, pas utilisée pour la distance', async () => {
    // Coordonnées volontairement éloignées de celles du test précédent : un
    // livreur "close" y reste online/available après son test et ne doit pas
    // fausser celui-ci en se retrouvant candidat proche ici aussi.
    const { shop } = await createShopUser()
    await prisma.shop.update({ where: { id: shop.id }, data: { latitude: 14.0, longitude: -2.0 } })
    const order = await makeOrder(shop.id)

    const { driver: stale } = await createDriverUser({ driverData: { acceptanceRate: 0.5 } })
    const { driver: better } = await createDriverUser({ driverData: { acceptanceRate: 1 } })
    // Position très proche mais périmée : ne doit PAS lui donner le bonus de proximité.
    await prisma.driverCurrentLocation.create({
      data: { driverId: stale.id, lat: 14.0001, lng: -2.0001, updatedAt: new Date(Date.now() - 20 * 60 * 1000) },
    })

    const best = await assignOrder(order.id)
    expect(best.id).toBe(better.id)
  })

  test('fonctionne toujours sans aucune donnée géographique (boutique et livreur sans position)', async () => {
    const { shop } = await createShopUser()
    const order = await makeOrder(shop.id)
    await createDriverUser()

    const best = await assignOrder(order.id)
    expect(best).toBeTruthy()
  })
})
