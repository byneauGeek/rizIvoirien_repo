const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

async function setupQrScannedOrder() {
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
  await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
  await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
  const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
  const qrToken = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token
  await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken })
  return { buyer, driverUser, driver, order }
}

describe('LOT 4 — confirmation active de l\'acheteur ("J\'ai reçu mon colis")', () => {
  test('refusée tant que le QR n\'a pas été scanné', async () => {
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const { driver } = await createDriverUser()
    const order = await prisma.order.create({ data: { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'IN_TRANSIT', total: 5000, address: 'x' } })
    await prisma.shipment.create({ data: { orderId: order.id, driverId: driver.id, status: 'IN_TRANSIT', dropoffAddress: order.address } })

    const res = await request(app).post(`/api/orders/${order.id}/confirm-receipt`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(400)

    const refreshed = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshed.status).toBe('IN_TRANSIT')
  })

  test('réussit une fois QR_SCANNED : Order passe à DELIVERED, sans OTP', async () => {
    const { buyer, order } = await setupQrScannedOrder()

    const res = await request(app).post(`/api/orders/${order.id}/confirm-receipt`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(200)

    const refreshed = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshed.status).toBe('DELIVERED')
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(shipment.status).toBe('DELIVERED')
    expect(shipment.deliveredAt).toBeTruthy()
  })

  test('paie le livreur (même mécanisme que la confirmation OTP)', async () => {
    const { buyer, driver, order } = await setupQrScannedOrder()
    await request(app).post(`/api/orders/${order.id}/confirm-receipt`).set('Authorization', `Bearer ${signToken(buyer)}`)

    const refreshedDriver = await prisma.driver.findUnique({ where: { id: driver.id } })
    expect(refreshedDriver.totalDeliveries).toBe(1)
    expect(refreshedDriver.monthlyEarnings).toBe(Math.round(1000 * 0.15))
  })

  test('notifie le livreur de la confirmation', async () => {
    const { buyer, driverUser, order } = await setupQrScannedOrder()
    await request(app).post(`/api/orders/${order.id}/confirm-receipt`).set('Authorization', `Bearer ${signToken(buyer)}`)

    const notif = await prisma.notification.findFirst({ where: { userId: driverUser.id, type: 'DELIVERY_CONFIRMED' } })
    expect(notif).toBeTruthy()
  })

  test('idempotente : une double confirmation échoue proprement, sans double paiement', async () => {
    const { buyer, driver, order } = await setupQrScannedOrder()
    await request(app).post(`/api/orders/${order.id}/confirm-receipt`).set('Authorization', `Bearer ${signToken(buyer)}`)
    const afterFirst = await prisma.driver.findUnique({ where: { id: driver.id } })

    const res = await request(app).post(`/api/orders/${order.id}/confirm-receipt`).set('Authorization', `Bearer ${signToken(buyer)}`)
    // confirmDeliveryByBuyer() détecte "déjà DELIVERED" avant même d'atteindre
    // le garde-fou générique TERMINAL_STATUSES (LOT10) — message plus précis,
    // toujours 400 (CONFIRMATION_NOT_READY), pas une erreur 500 générique.
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/déjà été confirmée/i)

    const afterSecond = await prisma.driver.findUnique({ where: { id: driver.id } })
    expect(afterSecond.monthlyEarnings).toBe(afterFirst.monthlyEarnings)
    expect(afterSecond.totalDeliveries).toBe(afterFirst.totalDeliveries)
  })

  test('un autre acheteur ne peut pas confirmer cette commande', async () => {
    const { order } = await setupQrScannedOrder()
    const stranger = await createUser('BUYER')

    const res = await request(app).post(`/api/orders/${order.id}/confirm-receipt`).set('Authorization', `Bearer ${signToken(stranger)}`)
    expect(res.status).toBe(403)
  })

  test('le livreur ne peut pas confirmer à la place de l\'acheteur (pas de route driver pour ça)', async () => {
    const { driverUser, order } = await setupQrScannedOrder()
    const res = await request(app).post(`/api/orders/${order.id}/confirm-receipt`).set('Authorization', `Bearer ${signToken(driverUser)}`)
    expect(res.status).toBe(403)
  })
})
