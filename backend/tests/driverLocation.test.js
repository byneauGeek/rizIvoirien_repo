const request = require('supertest')
const app = require('../src/index')
const { prisma, createDriverUser, signToken } = require('./helpers')

describe('LOT 1 (Logistique) — POST /api/drivers/location, persistance DB', () => {
  test('enregistre la position en base (pas seulement en mémoire)', async () => {
    const { user, driver } = await createDriverUser()

    const res = await request(app).post('/api/drivers/location')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ lat: 5.36, lng: -4.01, accuracy: 12.5, orderId: 42 })
    expect(res.status).toBe(200)

    const stored = await prisma.driverCurrentLocation.findUnique({ where: { driverId: driver.id } })
    expect(stored.lat).toBe(5.36)
    expect(stored.lng).toBe(-4.01)
    expect(stored.accuracy).toBe(12.5)
    expect(stored.orderId).toBe(42)
  })

  test('un second envoi met à jour la même ligne (upsert), pas une nouvelle', async () => {
    const { user, driver } = await createDriverUser()
    await request(app).post('/api/drivers/location').set('Authorization', `Bearer ${signToken(user)}`)
      .send({ lat: 5.30, lng: -4.00, orderId: 1 })
    await request(app).post('/api/drivers/location').set('Authorization', `Bearer ${signToken(user)}`)
      .send({ lat: 5.31, lng: -4.02, orderId: 1 })

    const rows = await prisma.driverCurrentLocation.findMany({ where: { driverId: driver.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].lat).toBe(5.31)
  })

  test('rejette des coordonnées invalides', async () => {
    const { user } = await createDriverUser()
    const res = await request(app).post('/api/drivers/location')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ lat: 999, lng: -4 })
    expect(res.status).toBe(400)
  })
})

describe('LOT 1 (Logistique) — GET /api/orders/:id/track, lecture depuis la DB', () => {
  async function createInTransitOrder(buyer, shop, driver) {
    return prisma.order.create({
      data: { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'IN_TRANSIT', total: 5000, address: 'x' },
    })
  }

  test('retourne la position si fraîche et liée à cette commande', async () => {
    const { createUser, createShopUser } = require('./helpers')
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const { user: driverUser, driver } = await createDriverUser()
    const order = await createInTransitOrder(buyer, shop, driver)

    await request(app).post('/api/drivers/location').set('Authorization', `Bearer ${signToken(driverUser)}`)
      .send({ lat: 5.36, lng: -4.01, orderId: order.id })

    const res = await request(app).get(`/api/orders/${order.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(200)
    expect(res.body.tracking).toBeTruthy()
    expect(res.body.tracking.lat).toBe(5.36)
    expect(typeof res.body.tracking.ts).toBe('number')
  })

  test('retourne tracking=null si la commande n\'est pas IN_TRANSIT', async () => {
    const { createUser, createShopUser } = require('./helpers')
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const order = await prisma.order.create({ data: { buyerId: buyer.id, shopId: shop.id, status: 'CONFIRMED', total: 1000, address: 'x' } })

    const res = await request(app).get(`/api/orders/${order.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(200)
    expect(res.body.tracking).toBeNull()
  })

  test('retourne tracking=null si la position vient d\'une autre commande du même livreur', async () => {
    const { createUser, createShopUser } = require('./helpers')
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const { user: driverUser, driver } = await createDriverUser()
    const order = await createInTransitOrder(buyer, shop, driver)

    // Position GPS liée à une AUTRE commande (ex. livraison précédente)
    await request(app).post('/api/drivers/location').set('Authorization', `Bearer ${signToken(driverUser)}`)
      .send({ lat: 5.36, lng: -4.01, orderId: 999999 })

    const res = await request(app).get(`/api/orders/${order.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.body.tracking).toBeNull()
  })

  test('un autre acheteur ne peut pas suivre cette commande', async () => {
    const { createUser, createShopUser } = require('./helpers')
    const buyer = await createUser('BUYER')
    const stranger = await createUser('BUYER')
    const { shop } = await createShopUser()
    const { driver } = await createDriverUser()
    const order = await createInTransitOrder(buyer, shop, driver)

    const res = await request(app).get(`/api/orders/${order.id}/track`).set('Authorization', `Bearer ${signToken(stranger)}`)
    expect(res.status).toBe(403)
  })

  test('une position vieille de plus de 10 minutes est traitée comme absente', async () => {
    const { createUser, createShopUser } = require('./helpers')
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const { driver } = await createDriverUser()
    const order = await createInTransitOrder(buyer, shop, driver)

    const old = new Date(Date.now() - 11 * 60 * 1000)
    await prisma.driverCurrentLocation.create({
      data: { driverId: driver.id, orderId: order.id, lat: 5.3, lng: -4.0, updatedAt: old },
    })

    const res = await request(app).get(`/api/orders/${order.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.body.tracking).toBeNull()
  })
})
