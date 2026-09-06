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
  return { buyer, shop, driverUser, driver, order, offer }
}

describe('LOT 3 — création du Shipment à l\'assignation', () => {
  test('acceptation d\'offre crée un Shipment PENDING_PICKUP', async () => {
    const { driverUser, driver, order, offer } = await setupReadyOrder()

    const res = await request(app).post(`/api/drivers/offers/${offer.id}/accept`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`)
    expect(res.status).toBe(200)

    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(shipment).toBeTruthy()
    expect(shipment.status).toBe('PENDING_PICKUP')
    expect(shipment.driverId).toBe(driver.id)
  })

  test('assignation manuelle admin crée aussi un Shipment', async () => {
    const admin = await createUser('ADMIN')
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const { driver } = await createDriverUser()
    const order = await prisma.order.create({ data: { buyerId: buyer.id, shopId: shop.id, status: 'PRET', total: 3000, address: 'x' } })

    const res = await request(app).post(`/api/admin/orders/${order.id}/assign`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })
    expect(res.status).toBe(200)

    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(shipment).toBeTruthy()
    expect(shipment.driverId).toBe(driver.id)
  })
})

describe('LOT 3 — deliveryLifecycle, point d\'entrée unique', () => {
  test('IN_TRANSIT fait avancer Shipment (PICKED_UP) ET Order.status en miroir', async () => {
    const { driverUser, order, offer } = await setupReadyOrder()
    await request(app).post(`/api/drivers/offers/${offer.id}/accept`).set('Authorization', `Bearer ${signToken(driverUser)}`)

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    expect(res.status).toBe(200)

    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(shipment.status).toBe('PICKED_UP')
    expect(shipment.pickedUpAt).toBeTruthy()

    const refreshedOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshedOrder.status).toBe('IN_TRANSIT')

    const event = await prisma.shipmentEvent.findFirst({ where: { shipmentId: shipment.id, status: 'PICKED_UP' } })
    expect(event).toBeTruthy()

    const history = await prisma.orderStatusHistory.findFirst({ where: { orderId: order.id, status: 'IN_TRANSIT' } })
    expect(history).toBeTruthy()
  })

  test('DELIVERED paie le livreur une seule fois, avec reset mensuel correct', async () => {
    const { driverUser, driver, order, offer } = await setupReadyOrder()
    await request(app).post(`/api/drivers/offers/${offer.id}/accept`).set('Authorization', `Bearer ${signToken(driverUser)}`)
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    // LOT 9 : IN_TRANSIT génère un code de preuve de livraison, requis pour DELIVERED.
    const { deliveryCode } = await prisma.shipment.findUnique({ where: { orderId: order.id } })

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: deliveryCode })
    expect(res.status).toBe(200)

    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(shipment.status).toBe('DELIVERED')
    expect(shipment.deliveredAt).toBeTruthy()

    const refreshedOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshedOrder.status).toBe('DELIVERED')

    const refreshedDriver = await prisma.driver.findUnique({ where: { id: driver.id } })
    expect(refreshedDriver.totalDeliveries).toBe(1)
    expect(refreshedDriver.monthlyEarnings).toBe(Math.round(1000 * 0.15)) // driverCommission par défaut

    const now = new Date()
    const metric = await prisma.driverMetric.findFirst({ where: { driverId: driver.id, month: now.getMonth() + 1, year: now.getFullYear() } })
    expect(metric.deliveries).toBe(1)
  })

  test('DELIVERED réinitialise monthlyEarnings si le mois a changé', async () => {
    const { driverUser, driver, order, offer } = await setupReadyOrder()
    await prisma.driver.update({ where: { id: driver.id }, data: { monthlyEarnings: 99999, earningsMonth: 1, earningsYear: 2000 } })
    await request(app).post(`/api/drivers/offers/${offer.id}/accept`).set('Authorization', `Bearer ${signToken(driverUser)}`)
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    const { deliveryCode } = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: deliveryCode })

    const refreshedDriver = await prisma.driver.findUnique({ where: { id: driver.id } })
    expect(refreshedDriver.monthlyEarnings).toBe(Math.round(1000 * 0.15)) // pas 99999 + gain
  })
})

describe('LOT 3 — ancien chemin générique supprimé', () => {
  // LOT AUDIT-G4 (audit XXX RIZ) : cette route ne gère plus aucune transition
  // DRIVER (déplacée vers /api/drivers/delivery/:orderId/status, LOT 3). Le
  // rejet doit être un 403 explicite, PAS le 400 générique "transition
  // impossible depuis {order.status}" que la route renvoyait avant ce lot —
  // ce 400 révélait le statut réel d'une commande à un livreur qui n'a aucun
  // droit dessus via cette route, même quand il en est l'assigné légitime.
  test('PUT /api/orders/:id/status en tant que DRIVER est refusé (403), même pour le livreur assigné', async () => {
    const { driverUser, order, offer } = await setupReadyOrder()
    await request(app).post(`/api/drivers/offers/${offer.id}/accept`).set('Authorization', `Bearer ${signToken(driverUser)}`)

    const res = await request(app).put(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({})
    expect(res.status).toBe(403)

    const refreshedOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshedOrder.status).toBe('PRET') // inchangé
  })

  test('un ADMIN ne peut plus poser DELIVERED via la route générique', async () => {
    const admin = await createUser('ADMIN')
    const { order } = await setupReadyOrder()

    const res = await request(app).put(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ status: 'DELIVERED' })
    expect(res.status).toBe(400)
  })
})

describe('LOT 3 — bout-en-bout : les consommateurs existants de Order.status continuent de fonctionner', () => {
  test('une commande livrée via le nouveau chemin peut faire l\'objet d\'un litige', async () => {
    const { buyer, driverUser, order, offer } = await setupReadyOrder()
    await request(app).post(`/api/drivers/offers/${offer.id}/accept`).set('Authorization', `Bearer ${signToken(driverUser)}`)
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    const { deliveryCode } = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: deliveryCode })

    const res = await request(app).post('/api/disputes')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ orderId: order.id, reason: 'OTHER', description: 'test' })
    expect(res.status).toBe(201)
  })
})
