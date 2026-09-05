const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

async function setupShipment(status, overrides = {}) {
  const buyer = await createUser('BUYER')
  const { shop } = await createShopUser()
  const { driver } = await createDriverUser()
  const order = await prisma.order.create({
    data: { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'PRET', total: 5000, address: 'x' },
  })
  const shipment = await prisma.shipment.create({
    data: { orderId: order.id, driverId: driver.id, status, dropoffAddress: order.address, ...overrides },
  })
  return { driver, order, shipment }
}

describe('LOT 15 — GET /api/admin/logistics/shipments/:id/gps-trail', () => {
  test('reconstitue le trajet à partir de l\'historique GPS, borné à la fenêtre de la livraison', async () => {
    const pickedUpAt = new Date(Date.now() - 20 * 60 * 1000)
    const deliveredAt = new Date()
    const { driver, shipment } = await setupShipment('DELIVERED', { pickedUpAt, deliveredAt })

    // Un point avant la prise en charge (hors fenêtre), deux points pendant.
    await prisma.driverLocationHistory.create({ data: { driverId: driver.id, lat: 5.30, lng: -4.00, createdAt: new Date(pickedUpAt.getTime() - 60 * 60 * 1000) } })
    await prisma.driverLocationHistory.create({ data: { driverId: driver.id, lat: 5.31, lng: -4.01, createdAt: new Date(pickedUpAt.getTime() + 5 * 60 * 1000) } })
    await prisma.driverLocationHistory.create({ data: { driverId: driver.id, lat: 5.32, lng: -4.02, createdAt: new Date(pickedUpAt.getTime() + 10 * 60 * 1000) } })

    const admin = await createUser('ADMIN')
    const res = await request(app).get(`/api/admin/logistics/shipments/${shipment.id}/gps-trail`).set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.trail).toHaveLength(2)
    expect(res.body.trail[0].lat).toBe(5.31)
    expect(res.body.trail[1].lat).toBe(5.32)
  })

  test('livraison sans livreur assigné : trace vide, pas d\'erreur', async () => {
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const order = await prisma.order.create({ data: { buyerId: buyer.id, shopId: shop.id, status: 'PRET', total: 1000, address: 'x' } })
    const shipment = await prisma.shipment.create({ data: { orderId: order.id, status: 'PENDING_PICKUP', dropoffAddress: 'x' } })

    const admin = await createUser('ADMIN')
    const res = await request(app).get(`/api/admin/logistics/shipments/${shipment.id}/gps-trail`).set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.trail).toEqual([])
  })

  test('404 si la livraison n\'existe pas', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/admin/logistics/shipments/999999/gps-trail').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(404)
  })
})

describe('LOT 15 — GET /api/admin/logistics/risk-signals', () => {
  test('signale un livreur dont le taux d\'échec récent dépasse le seuil', async () => {
    const { driver } = await setupShipment('FAILED', { failureReason: 'x' })
    // Même livreur : 1 échec + 1 livraison réussie = 50% (>= seuil 30%), avec un échantillon de 2 < MIN_SAMPLE(3)...
    // on ajoute une 3e pour dépasser le seuil minimal d'échantillon.
    await prisma.shipment.create({
      data: { orderId: (await prisma.order.create({ data: { buyerId: (await createUser('BUYER')).id, shopId: (await createShopUser()).shop.id, driverId: driver.id, status: 'PRET', total: 1000, address: 'x' } })).id, driverId: driver.id, status: 'DELIVERED', dropoffAddress: 'x' },
    })
    await prisma.shipment.create({
      data: { orderId: (await prisma.order.create({ data: { buyerId: (await createUser('BUYER')).id, shopId: (await createShopUser()).shop.id, driverId: driver.id, status: 'PRET', total: 1000, address: 'x' } })).id, driverId: driver.id, status: 'FAILED', dropoffAddress: 'x', failureReason: 'x' },
    })

    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/admin/logistics/risk-signals').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    const flagged = res.body.flaggedDrivers.find(f => f.driverId === driver.id)
    expect(flagged).toBeTruthy()
    expect(flagged.totalDeliveries30d).toBe(3)
    expect(flagged.failedDeliveries30d).toBe(2)
    expect(flagged.failureRate).toBeCloseTo(0.67, 1)
  })

  test('ne signale pas un livreur avec un échantillon trop faible, même à 100% d\'échec', async () => {
    const { driver } = await setupShipment('FAILED', { failureReason: 'x' })

    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/admin/logistics/risk-signals').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.body.flaggedDrivers.find(f => f.driverId === driver.id)).toBeUndefined()
  })

  test('un non-admin ne peut pas accéder aux signaux de risque', async () => {
    const seller = await createUser('SELLER')
    const res = await request(app).get('/api/admin/logistics/risk-signals').set('Authorization', `Bearer ${signToken(seller)}`)
    expect(res.status).toBe(403)
  })
})
