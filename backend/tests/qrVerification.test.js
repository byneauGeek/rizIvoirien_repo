const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')
const deliveryLifecycle = require('../src/services/deliveryLifecycle')

async function setupInTransitOrder() {
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
  return { buyer, driverUser, driver, order }
}

describe('LOT 3 — génération du QR à l\'arrivée du livreur', () => {
  test('ARRIVED génère un token, exposé à l\'acheteur, jamais au livreur', async () => {
    const { buyer, driverUser, order } = await setupInTransitOrder()

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).not.toMatch(/token/i)

    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(shipment.status).toBe('ARRIVED')

    const track = await request(app).get(`/api/orders/${order.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(track.body.qrToken).toMatch(/^[0-9a-f]{64}$/)
    expect(track.body.shipmentStatus).toBe('ARRIVED')

    const tokenRow = await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })
    expect(tokenRow.token).toBe(track.body.qrToken)
    expect(tokenRow.usedAt).toBeNull()
  })

  test('un second ARRIVED invalide le token précédent (un seul actif à la fois)', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    const firstToken = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token

    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })

    const remaining = await prisma.deliveryVerificationToken.findMany({ where: { shipmentId: shipment.id } })
    expect(remaining).toHaveLength(1)
    expect(remaining[0].token).not.toBe(firstToken)
  })
})

describe('LOT 3 — visibilité du statut Shipment pour le livreur (jamais le code)', () => {
  test('active-delivery expose shipmentStatus mais jamais deliveryCode', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })

    const res = await request(app).get('/api/drivers/active-delivery').set('Authorization', `Bearer ${signToken(driverUser)}`)
    expect(res.body.shipmentStatus).toBe('ARRIVED')
    expect(JSON.stringify(res.body)).not.toMatch(/deliveryCode|qrToken/i)
  })
})

describe('LOT 3 — scan du QR par le livreur', () => {
  test('un scan avec le bon token fait passer le Shipment à QR_SCANNED, Order reste IN_TRANSIT', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    const token = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken: token })
    expect(res.status).toBe(200)

    const updated = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    expect(updated.status).toBe('QR_SCANNED')
    const refreshedOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshedOrder.status).toBe('IN_TRANSIT') // pas encore DELIVERED : confirmation acheteur à venir (LOT4/5)

    const tokenRow = await prisma.deliveryVerificationToken.findUnique({ where: { token } })
    expect(tokenRow.usedAt).toBeTruthy()
  })

  test('un token inconnu est rejeté (400)', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken: 'deadbeef'.repeat(8) })
    expect(res.status).toBe(400)
  })

  test('un token déjà utilisé est rejeté (usage unique)', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    const token = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken: token })

    // Simule une commande FAILED puis reprise : impossible ici car statut final déjà
    // atteint côté Shipment (QR_SCANNED n'est pas final) — on retente le MÊME scan.
    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken: token })
    expect(res.status).toBe(400)
  })

  test('un token expiré est rejeté', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    await prisma.deliveryVerificationToken.updateMany({ where: { shipmentId: shipment.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    const token = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken: token })
    expect(res.status).toBe(400)
  })

  test('un token d\'un AUTRE shipment est rejeté', async () => {
    const { driverUser: d1, order: order1 } = await setupInTransitOrder()
    const { driverUser: d2, order: order2 } = await setupInTransitOrder()
    await request(app).put(`/api/drivers/delivery/${order1.id}/status`).set('Authorization', `Bearer ${signToken(d1)}`).send({ status: 'ARRIVED' })
    const shipment1 = await prisma.shipment.findUnique({ where: { orderId: order1.id } })
    const token1 = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment1.id } })).token

    await request(app).put(`/api/drivers/delivery/${order2.id}/status`).set('Authorization', `Bearer ${signToken(d2)}`).send({ status: 'ARRIVED' })
    const res = await request(app).put(`/api/drivers/delivery/${order2.id}/status`)
      .set('Authorization', `Bearer ${signToken(d2)}`).send({ status: 'QR_SCANNED', qrToken: token1 })
    expect(res.status).toBe(400)
  })
})

describe('LOT 3 — l\'OTP reste un fallback complet, indépendant du QR', () => {
  test('DELIVERED via OTP fonctionne après QR_SCANNED (sans confirmation acheteur, LOT4/5 à venir)', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    const qrToken = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken })

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: shipment.deliveryCode })
    expect(res.status).toBe(200)

    const refreshedOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshedOrder.status).toBe('DELIVERED')
  })

  test('DELIVERED via OTP fonctionne SANS jamais être passé par ARRIVED/QR (fallback total)', async () => {
    const { driverUser, order } = await setupInTransitOrder()
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })

    const res = await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: shipment.deliveryCode })
    expect(res.status).toBe(200)
  })
})

describe('LOT 3 — parité B2B (service direct, pas de route HTTP driver pour B2B — LOT2)', () => {
  test('ARRIVED puis QR_SCANNED fonctionnent identiquement pour un Shipment B2B', async () => {
    const buyerUser = await createUser('BUYER')
    const sellerUser = await createUser('SELLER')
    const tx = await prisma.b2BTransaction.create({
      data: { buyerUserId: buyerUser.id, sellerUserId: sellerUser.id, product: 'Riz', quantity: 500, unit: 'sac', region: 'Abidjan', needsLogistics: true, deliveryAddress: 'x', deliveryFee: 5000 },
    })
    const { driver } = await createDriverUser()
    await deliveryLifecycle.createShipmentForB2BTransaction(prisma, { b2bTransactionId: tx.id, driverId: driver.id, dropoffAddress: 'x' })
    await deliveryLifecycle.advanceShipment(prisma, { b2bTransactionId: tx.id, status: 'PICKED_UP', actorId: sellerUser.id })

    await deliveryLifecycle.advanceShipment(prisma, { b2bTransactionId: tx.id, status: 'ARRIVED', actorId: sellerUser.id })
    const shipment = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id } })
    expect(shipment.status).toBe('ARRIVED')
    const token = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token

    await deliveryLifecycle.advanceShipment(prisma, { b2bTransactionId: tx.id, status: 'QR_SCANNED', qrToken: token, actorId: sellerUser.id })
    const updated = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id } })
    expect(updated.status).toBe('QR_SCANNED')

    const refreshedTx = await prisma.b2BTransaction.findUnique({ where: { id: tx.id } })
    expect(refreshedTx.status).toBe('IN_TRANSIT') // mirroring identique à Order : pas encore DELIVERED
  })
})
