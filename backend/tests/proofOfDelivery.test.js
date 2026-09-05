const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

async function setupReadyOrder() {
  const buyer = await createUser('BUYER')
  const { shop } = await createShopUser()
  const { user: driverUser, driver } = await createDriverUser()
  const order = await prisma.order.create({
    data: { buyerId: buyer.id, shopId: shop.id, status: 'PRET', total: 5000, deliveryFee: 1000, address: 'Adresse test' },
  })
  const offer = await prisma.driverOffer.create({
    data: { orderId: order.id, driverId: driver.id, status: 'PENDING', expiresAt: new Date(Date.now() + 60000) },
  })
  await request(app).post(`/api/drivers/offers/${offer.id}/accept`).set('Authorization', `Bearer ${signToken(driverUser)}`)
  return { buyer, driverUser, driver, order }
}

describe('LOT 9 — génération du code de livraison à la prise en charge', () => {
  test('PICKED_UP (IN_TRANSIT côté API) génère un code à 4 chiffres', async () => {
    const { driverUser, order } = await setupReadyOrder()
    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    expect(res.status).toBe(200)

    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(shipment.deliveryCode).toMatch(/^\d{4}$/)
    expect(shipment.deliveryCodeAttempts).toBe(0)
  })

  test('le code de livraison n\'est jamais renvoyé au livreur dans la réponse HTTP', async () => {
    const { driverUser, order } = await setupReadyOrder()
    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    expect(JSON.stringify(res.body)).not.toMatch(/deliveryCode/i)
  })

  test('l\'acheteur voit son code de livraison via le suivi de commande', async () => {
    const { buyer, driverUser, order } = await setupReadyOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })

    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    const res = await request(app).get(`/api/orders/${order.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.body.deliveryCode).toBe(shipment.deliveryCode)
  })
})

describe('LOT 9 — vérification du code à la livraison', () => {
  test('DELIVERED sans code est rejeté (400), le statut ne change pas', async () => {
    const { driverUser, order } = await setupReadyOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED' })
    expect(res.status).toBe(400)

    const refreshed = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshed.status).toBe('IN_TRANSIT')
  })

  test('DELIVERED avec un code incorrect est rejeté et incrémente le compteur de tentatives', async () => {
    const { driverUser, order } = await setupReadyOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: '0000' })
    expect(res.status).toBe(400)

    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(shipment.deliveryCodeAttempts).toBe(1)
    expect(shipment.status).toBe('PICKED_UP')
  })

  test('DELIVERED avec le bon code réussit', async () => {
    const { driverUser, order } = await setupReadyOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: shipment.deliveryCode })
    expect(res.status).toBe(200)

    const refreshed = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshed.status).toBe('DELIVERED')
  })

  test('après 5 tentatives incorrectes, le code est verrouillé même s\'il est ensuite fourni correctement', async () => {
    const { driverUser, order } = await setupReadyOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })

    for (let i = 0; i < 5; i++) {
      await request(app).put(`/api/drivers/delivery/${order.id}/status`)
        .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: '9999' })
    }

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: shipment.deliveryCode })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/verrouillé/i)
  })
})

describe('LOT 9 — signal de proximité GPS (informatif, jamais bloquant)', () => {
  test('enregistre la distance entre position livreur et destination géocodée, sans bloquer', async () => {
    const { driverUser, driver, order } = await setupReadyOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    await prisma.shipment.update({ where: { orderId: order.id }, data: { dropoffLat: 5.36, dropoffLng: -4.0 } })
    await prisma.driverCurrentLocation.create({ data: { driverId: driver.id, orderId: order.id, lat: 5.36, lng: -4.001 } })
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: shipment.deliveryCode })
    expect(res.status).toBe(200)

    const updated = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(updated.deliveryProofDistanceKm).toBeGreaterThan(0)
    expect(updated.deliveryProofDistanceKm).toBeLessThan(1)
  })

  test('absence de position ou de destination géocodée ne bloque jamais la livraison', async () => {
    const { driverUser, order } = await setupReadyOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: shipment.deliveryCode })
    expect(res.status).toBe(200)

    const updated = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(updated.deliveryProofDistanceKm).toBeNull()
  })
})

describe('LOT 9 — historique GPS avec rétention', () => {
  test('chaque envoi de position ajoute une entrée à DriverLocationHistory', async () => {
    const { user, driver } = await createDriverUser()
    await request(app).post('/api/drivers/location').set('Authorization', `Bearer ${signToken(user)}`).send({ lat: 5.3, lng: -4.0 })
    await request(app).post('/api/drivers/location').set('Authorization', `Bearer ${signToken(user)}`).send({ lat: 5.31, lng: -4.01 })

    const history = await prisma.driverLocationHistory.findMany({ where: { driverId: driver.id } })
    expect(history.length).toBe(2)
  })

  test('purge les entrées plus vieilles que la rétention configurée', async () => {
    const { user, driver } = await createDriverUser()
    await prisma.driverLocationHistory.create({
      data: { driverId: driver.id, lat: 5.3, lng: -4.0, createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
    })
    await prisma.platformSettings.upsert({ where: { id: 1 }, update: { gpsHistoryRetentionDays: 30 }, create: { id: 1, gpsHistoryRetentionDays: 30 } })

    await request(app).post('/api/drivers/location').set('Authorization', `Bearer ${signToken(user)}`).send({ lat: 5.32, lng: -4.02 })
    await new Promise(r => setTimeout(r, 200)) // laisse le setImmediate de purge s'exécuter

    const history = await prisma.driverLocationHistory.findMany({ where: { driverId: driver.id } })
    expect(history.length).toBe(1)
    expect(history[0].lat).toBe(5.32)
  })
})
