const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

async function setupInTransitOrder() {
  const buyer = await createUser('BUYER')
  const { shop } = await createShopUser()
  const product = await prisma.product.create({
    data: { shopId: shop.id, name: 'Riz échec', slug: `riz-fail-${Date.now()}`, category: 'Riz', price: 5000, stock: 20, active: true },
  })
  await prisma.stockPosition.create({ data: { productId: product.id, quantity: 20 } })
  const { user: driverUser, driver } = await createDriverUser()
  const order = await prisma.order.create({
    data: {
      buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'PRET', total: 10000, deliveryFee: 1000, address: 'x',
      items: { create: { productId: product.id, quantity: 2, price: 5000, name: product.name } },
    },
  })
  await prisma.shipment.create({ data: { orderId: order.id, driverId: driver.id, status: 'PENDING_PICKUP', dropoffAddress: order.address } })
  // Simule la décrémentation de stock déjà faite à la commande (LOT3, hors périmètre de ce test).
  await prisma.product.update({ where: { id: product.id }, data: { stock: { decrement: 2 } } })
  await prisma.stockPosition.update({ where: { productId: product.id }, data: { quantity: { decrement: 2 } } })
  await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
  return { buyer, driverUser, driver, order, product }
}

describe('LOT 10 — signalement d\'un échec de livraison', () => {
  test('exige un motif (400 sans failureReason)', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'FAILED' })
    expect(res.status).toBe(400)
  })

  test('FAILED fait passer le Shipment à FAILED et la commande à ESCALATED', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'FAILED', failureReason: 'Client injoignable' })
    expect(res.status).toBe(200)

    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(shipment.status).toBe('FAILED')
    expect(shipment.failureReason).toBe('Client injoignable')

    const refreshedOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshedOrder.status).toBe('ESCALATED')
  })

  test('restocke la marchandise (le produit n\'a jamais atteint le client)', async () => {
    const { driverUser, order, product } = await setupInTransitOrder()
    const before = await prisma.stockPosition.findUnique({ where: { productId: product.id } })

    await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'FAILED', failureReason: 'Adresse introuvable' })

    const after = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(after.quantity).toBe(before.quantity + 2)

    const movement = await prisma.stockMovement.findFirst({ where: { productId: product.id, type: 'RESTOCK', sourceType: 'ORDER', sourceId: order.id } })
    expect(movement).toBeTruthy()
    expect(movement.quantity).toBe(2)
  })

  test('le livreur redevient disponible pour une nouvelle offre', async () => {
    const { driverUser, driver, order } = await setupInTransitOrder()
    await prisma.driver.update({ where: { id: driver.id }, data: { available: false } })

    await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'FAILED', failureReason: 'Refus du client' })

    const refreshedDriver = await prisma.driver.findUnique({ where: { id: driver.id } })
    expect(refreshedDriver.available).toBe(true)
  })

  test('une livraison déjà FAILED ne peut pas être re-signalée par le même livreur (Order.driverId libéré)', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'FAILED', failureReason: 'Premier échec' })

    // Order.driverId a été libéré par le premier échec (sinon admin ne pourrait
    // jamais réassigner, voir le test de réassignation ci-dessous) : le même
    // livreur ne retrouve donc même plus la commande, avant même le
    // garde-fou de statut final.
    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'FAILED', failureReason: 'Second appel' })
    expect(res.status).toBe(404)

    const movements = await prisma.shipmentEvent.findMany({ where: { shipment: { orderId: order.id }, status: 'FAILED' } })
    expect(movements).toHaveLength(1) // pas de double traitement
  })

  test('un double DELIVERED ne paie pas le livreur deux fois (même garde-fou)', async () => {
    const { driverUser, driver, order } = await setupInTransitOrder()
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: shipment.deliveryCode })
    const afterFirst = await prisma.driver.findUnique({ where: { id: driver.id } })

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: shipment.deliveryCode })
    expect(res.status).toBe(500)

    const afterSecond = await prisma.driver.findUnique({ where: { id: driver.id } })
    expect(afterSecond.monthlyEarnings).toBe(afterFirst.monthlyEarnings)
    expect(afterSecond.totalDeliveries).toBe(afterFirst.totalDeliveries)
  })

  test('admin peut réassigner une commande ESCALATED après échec, ce qui repart avec un Shipment propre', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'FAILED', failureReason: 'Client injoignable' })

    const admin = await createUser('ADMIN')
    const { driver: newDriver } = await createDriverUser()
    const res = await request(app).post(`/api/admin/orders/${order.id}/assign`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: newDriver.id })
    expect(res.status).toBe(200)

    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(shipment.status).toBe('PENDING_PICKUP')
    expect(shipment.driverId).toBe(newDriver.id)
    expect(shipment.failureReason).toBeNull()
    expect(shipment.deliveryCode).toBeNull()
  })
})
