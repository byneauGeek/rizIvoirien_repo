const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

describe('LOT 5 — pipeline B2B unifié (mêmes garanties que B2C, via HTTP)', () => {
  async function setupB2BTransaction() {
    const buyerUser = await createUser('BUYER')
    const sellerUser = await createUser('SELLER')
    const tx = await prisma.b2BTransaction.create({
      data: {
        buyerUserId: buyerUser.id, sellerUserId: sellerUser.id, product: 'Riz', quantity: 500, unit: 'sac',
        region: 'Abidjan', needsLogistics: true, deliveryAddress: 'Adresse B2B test', deliveryFee: 5000,
      },
    })
    const { user: driverUser, driver } = await createDriverUser()
    const admin = await createUser('ADMIN')
    await request(app).post(`/api/admin/logistics/b2b/${tx.id}/assign`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })
    return { buyerUser, sellerUser, driverUser, driver, tx }
  }

  test('driver peut faire progresser un Shipment B2B via HTTP jusqu\'à QR_SCANNED', async () => {
    const { driverUser, tx } = await setupB2BTransaction()

    await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })

    const shipment = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id } })
    expect(shipment.status).toBe('ARRIVED')
    const qrToken = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token

    const res = await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken })
    expect(res.status).toBe(200)

    const updated = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id } })
    expect(updated.status).toBe('QR_SCANNED')
  })

  test('un livreur non assigné à ce Shipment B2B ne peut pas agir dessus', async () => {
    const { tx } = await setupB2BTransaction()
    const { user: otherDriverUser } = await createDriverUser()

    const res = await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`)
      .set('Authorization', `Bearer ${signToken(otherDriverUser)}`).send({ status: 'IN_TRANSIT' })
    expect(res.status).toBe(404)
  })

  test('acheteur B2B confirme la réception via HTTP, transaction passe DELIVERED, livreur payé', async () => {
    const { buyerUser, driverUser, driver, tx } = await setupB2BTransaction()
    await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
    const shipment = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id } })
    const qrToken = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token
    await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken })

    const res = await request(app).post(`/api/b2b/transactions/${tx.id}/confirm-receipt`)
      .set('Authorization', `Bearer ${signToken(buyerUser)}`)
    expect(res.status).toBe(200)

    const refreshedTx = await prisma.b2BTransaction.findUnique({ where: { id: tx.id } })
    expect(refreshedTx.status).toBe('DELIVERED')

    const refreshedDriver = await prisma.driver.findUnique({ where: { id: driver.id } })
    expect(refreshedDriver.monthlyEarnings).toBe(Math.round(5000 * 0.15))

    const notif = await prisma.notification.findFirst({ where: { userId: driverUser.id, type: 'DELIVERY_CONFIRMED' } })
    expect(notif).toBeTruthy()
  })

  test('seul l\'acheteur de LA transaction peut confirmer (pas le vendeur, pas un tiers)', async () => {
    const { sellerUser, driverUser, tx } = await setupB2BTransaction()
    await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })

    const res = await request(app).post(`/api/b2b/transactions/${tx.id}/confirm-receipt`)
      .set('Authorization', `Bearer ${signToken(sellerUser)}`)
    expect(res.status).toBe(404)
  })
})

describe('LOT 5 — message d\'erreur précis si la livraison a échoué après le scan', () => {
  test('confirmer après un FAILED post-QR_SCANNED renvoie un message explicite, pas générique', async () => {
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const { user: driverUser, driver } = await createDriverUser()
    const order = await prisma.order.create({ data: { buyerId: buyer.id, shopId: shop.id, status: 'PRET', total: 5000, deliveryFee: 1000, address: 'x' } })
    const offer = await prisma.driverOffer.create({ data: { orderId: order.id, driverId: driver.id, status: 'PENDING', expiresAt: new Date(Date.now() + 60000) } })
    await request(app).post(`/api/drivers/offers/${offer.id}/accept`).set('Authorization', `Bearer ${signToken(driverUser)}`)
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    const qrToken = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken })

    // Le livreur redevient disponible (LOT10) : réassigner un NOUVEAU livreur
    // n'est pas nécessaire pour signaler l'échec, mais le Shipment doit
    // pouvoir passer à FAILED même après QR_SCANNED (client a refusé le colis
    // après avoir scanné, par exemple).
    await request(app).put(`/api/drivers/delivery/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'FAILED', failureReason: 'Client a refusé le colis' })

    const res = await request(app).post(`/api/orders/${order.id}/confirm-receipt`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/échec/i)
    expect(res.body.error).not.toMatch(/pas encore été scanné/i)
  })
})

describe('LOT 5 — pipeline B2C complet de bout en bout (une seule vérification globale)', () => {
  test('PICKED_UP -> ARRIVED -> QR_SCANNED -> confirmation acheteur : chaque effet de bord une seule fois', async () => {
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const product = await prisma.product.create({ data: { shopId: shop.id, name: 'Riz LOT5', slug: `riz-lot5-${Date.now()}`, category: 'Riz', price: 5000, stock: 20, active: true } })
    await prisma.stockPosition.create({ data: { productId: product.id, quantity: 20 } })
    const { user: driverUser, driver } = await createDriverUser()
    const order = await prisma.order.create({
      data: {
        buyerId: buyer.id, shopId: shop.id, status: 'PRET', total: 10000, deliveryFee: 1000, address: 'x',
        items: { create: { productId: product.id, quantity: 2, price: 5000, name: product.name } },
      },
    })
    const offer = await prisma.driverOffer.create({ data: { orderId: order.id, driverId: driver.id, status: 'PENDING', expiresAt: new Date(Date.now() + 60000) } })
    await request(app).post(`/api/drivers/offers/${offer.id}/accept`).set('Authorization', `Bearer ${signToken(driverUser)}`)
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
    const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
    const qrToken = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token
    await request(app).put(`/api/drivers/delivery/${order.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken })

    await request(app).post(`/api/orders/${order.id}/confirm-receipt`).set('Authorization', `Bearer ${signToken(buyer)}`)

    const refreshedOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshedOrder.status).toBe('DELIVERED')

    const refreshedDriver = await prisma.driver.findUnique({ where: { id: driver.id } })
    expect(refreshedDriver.totalDeliveries).toBe(1) // pas 2, pas 0

    // La commande n'a jamais échoué : le succès de la livraison ne doit pas
    // toucher au stock (le débit se fait à la commande, pas ici ; seul un
    // FAILED déclenche un restock, testé ailleurs) — quantité inchangée.
    const position = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(position.quantity).toBe(20)

    const events = await prisma.shipmentEvent.findMany({ where: { shipmentId: shipment.id } })
    const statuses = events.map(e => e.status)
    expect(statuses).toEqual(['PICKED_UP', 'ARRIVED', 'QR_SCANNED', 'DELIVERED'])
  })
})
