const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')
const deliveryLifecycle = require('../src/services/deliveryLifecycle')

async function createInTransitOrderWithShipment({ dropoffLat = null, dropoffLng = null } = {}) {
  const buyer = await createUser('BUYER')
  const { shop } = await createShopUser()
  const { user: driverUser, driver } = await createDriverUser()
  const order = await prisma.order.create({
    data: { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'IN_TRANSIT', total: 5000, address: 'Destination test' },
  })
  const shipment = await prisma.shipment.create({
    data: { orderId: order.id, driverId: driver.id, dropoffAddress: order.address, status: 'IN_TRANSIT', dropoffLat, dropoffLng },
  })
  return { buyer, driverUser, driver, order, shipment }
}

describe('LOT 8 — ETA réelle sur le suivi client', () => {
  test('calcule une ETA cohérente quand la destination est géocodée et la position fraîche', async () => {
    // Destination à ~11km au nord (1 degré de latitude ≈ 111km / 10)
    const { buyer, driverUser, order } = await createInTransitOrderWithShipment({ dropoffLat: 5.46, dropoffLng: -4.0 })
    await request(app).post('/api/drivers/location').set('Authorization', `Bearer ${signToken(driverUser)}`)
      .send({ lat: 5.36, lng: -4.0, orderId: order.id })

    const res = await request(app).get(`/api/orders/${order.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(200)
    expect(res.body.eta).toBeTruthy()
    expect(res.body.eta.distanceKm).toBeGreaterThan(10)
    expect(res.body.eta.minutes).toBeGreaterThan(0)
    // Vitesse par défaut 20 km/h, route (facteur 1.4) : ~11km réel -> ~15.4km route -> ~46 min
    expect(res.body.eta.minutes).toBeGreaterThan(20)
    expect(res.body.destination).toEqual({ lat: 5.46, lng: -4.0 })
  })

  test('pas d\'ETA tant que la destination n\'a pas encore été géocodée (mais la requête réussit)', async () => {
    const { buyer, driverUser, order } = await createInTransitOrderWithShipment() // dropoffLat/Lng = null
    await request(app).post('/api/drivers/location').set('Authorization', `Bearer ${signToken(driverUser)}`)
      .send({ lat: 5.36, lng: -4.0, orderId: order.id })

    const res = await request(app).get(`/api/orders/${order.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(200)
    expect(res.body.eta).toBeNull()
    expect(res.body.tracking).toBeTruthy() // la position, elle, reste disponible
  })

  test('pas d\'ETA si la position GPS est périmée, même avec une destination géocodée', async () => {
    const { buyer, driver, order } = await createInTransitOrderWithShipment({ dropoffLat: 5.46, dropoffLng: -4.0 })
    await prisma.driverCurrentLocation.create({
      data: { driverId: driver.id, orderId: order.id, lat: 5.36, lng: -4.0, updatedAt: new Date(Date.now() - 20 * 60 * 1000) },
    })

    const res = await request(app).get(`/api/orders/${order.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.body.eta).toBeNull()
    expect(res.body.tracking).toBeNull()
    // La destination géocodée reste utile pour l'affichage carte même sans ETA calculable.
    expect(res.body.destination).toEqual({ lat: 5.46, lng: -4.0 })
  })

  test('aucune ETA ni crash quand la commande n\'a pas de Shipment (chemins hérités des tests LOT1)', async () => {
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const { driver } = await createDriverUser()
    const order = await prisma.order.create({ data: { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'IN_TRANSIT', total: 1000, address: 'x' } })

    const res = await request(app).get(`/api/orders/${order.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(200)
    expect(res.body.eta).toBeNull()
  })
})

describe('LOT 8 — ensureShipmentDropoffCoords (géocodage paresseux)', () => {
  test('ne fait aucun appel réseau et ne modifie rien en environnement de test', async () => {
    const { order, shipment } = await createInTransitOrderWithShipment()
    await deliveryLifecycle.ensureShipmentDropoffCoords(shipment.id, order.address)

    const refreshed = await prisma.shipment.findUnique({ where: { id: shipment.id } })
    expect(refreshed.dropoffLat).toBeNull()
    expect(refreshed.dropoffLng).toBeNull()
  })
})
