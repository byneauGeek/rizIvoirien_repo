const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createDriverUser, signToken } = require('./helpers')

async function createDeclaredTransaction() {
  const buyer = await createUser('TRADER')
  const seller = await createUser('COOPERATIVE')
  const tx = await prisma.b2BTransaction.create({
    data: { buyerUserId: buyer.id, sellerUserId: seller.id, product: 'Riz paddy', quantity: 5, unit: 'tonne', region: 'Gagnoa', status: 'DECLARED' },
  })
  return { buyer, seller, tx }
}

describe('LOT 2 — B2B : demande de logistique (PUT /b2b/transactions/:id/request-logistics)', () => {
  test('l\'acheteur peut demander une livraison sur sa transaction déclarée', async () => {
    const { buyer, tx } = await createDeclaredTransaction()
    const res = await request(app).put(`/api/b2b/transactions/${tx.id}/request-logistics`)
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ deliveryAddress: 'Entrepôt Gagnoa', deliveryFee: 15000 })
    expect(res.status).toBe(200)
    expect(res.body.needsLogistics).toBe(true)
    expect(res.body.deliveryFee).toBe(15000)
  })

  test('le vendeur ne peut pas demander la logistique (seul l\'acheteur, destinataire, le peut)', async () => {
    const { seller, tx } = await createDeclaredTransaction()
    const res = await request(app).put(`/api/b2b/transactions/${tx.id}/request-logistics`)
      .set('Authorization', `Bearer ${signToken(seller)}`)
      .send({ deliveryAddress: 'x' })
    expect(res.status).toBe(404)
  })

  test('adresse manquante rejetée (400)', async () => {
    const { buyer, tx } = await createDeclaredTransaction()
    const res = await request(app).put(`/api/b2b/transactions/${tx.id}/request-logistics`)
      .set('Authorization', `Bearer ${signToken(buyer)}`).send({})
    expect(res.status).toBe(400)
  })

  test('GET /b2b/transactions inclut le statut du shipment une fois assigné', async () => {
    const { buyer, tx } = await createDeclaredTransaction()
    await request(app).put(`/api/b2b/transactions/${tx.id}/request-logistics`)
      .set('Authorization', `Bearer ${signToken(buyer)}`).send({ deliveryAddress: 'x', deliveryFee: 10000 })
    const { driver } = await createDriverUser()
    const admin = await createUser('ADMIN')
    await request(app).post(`/api/admin/logistics/b2b/${tx.id}/assign`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })

    const res = await request(app).get('/api/b2b/transactions').set('Authorization', `Bearer ${signToken(buyer)}`)
    const row = res.body.transactions.find(t => t.id === tx.id)
    expect(row.shipment).toBeTruthy()
    expect(row.shipment.status).toBe('PENDING_PICKUP')
  })
})

describe('LOT 2 — B2B : assignation admin (POST /admin/logistics/b2b/:id/assign)', () => {
  test('crée le Shipment et passe needsLogistics en file assignable', async () => {
    const { buyer, tx } = await createDeclaredTransaction()
    await request(app).put(`/api/b2b/transactions/${tx.id}/request-logistics`)
      .set('Authorization', `Bearer ${signToken(buyer)}`).send({ deliveryAddress: 'Entrepôt X', deliveryFee: 12000 })
    const { driver } = await createDriverUser()
    const admin = await createUser('ADMIN')

    const res = await request(app).post(`/api/admin/logistics/b2b/${tx.id}/assign`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })
    expect(res.status).toBe(200)

    const shipment = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id } })
    expect(shipment).toBeTruthy()
    expect(shipment.driverId).toBe(driver.id)
    expect(shipment.dropoffAddress).toBe('Entrepôt X')
    expect(shipment.orderId).toBeNull()
  })

  test('refuse si needsLogistics n\'a jamais été demandé', async () => {
    const { tx } = await createDeclaredTransaction()
    const { driver } = await createDriverUser()
    const admin = await createUser('ADMIN')
    const res = await request(app).post(`/api/admin/logistics/b2b/${tx.id}/assign`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })
    expect(res.status).toBe(400)
  })

  test('un non-admin ne peut pas assigner', async () => {
    const { buyer, tx } = await createDeclaredTransaction()
    await request(app).put(`/api/b2b/transactions/${tx.id}/request-logistics`)
      .set('Authorization', `Bearer ${signToken(buyer)}`).send({ deliveryAddress: 'x' })
    const { driver } = await createDriverUser()
    const res = await request(app).post(`/api/admin/logistics/b2b/${tx.id}/assign`)
      .set('Authorization', `Bearer ${signToken(buyer)}`).send({ driverId: driver.id })
    expect(res.status).toBe(403)
  })
})

describe('LOT 2 — cycle de vie complet d\'un Shipment B2B (polymorphisme deliveryLifecycle.js)', () => {
  async function setupAssignedB2BShipment(deliveryFee = 20000) {
    const { buyer, tx } = await createDeclaredTransaction()
    await prisma.b2BTransaction.update({ where: { id: tx.id }, data: { needsLogistics: true, deliveryAddress: 'Entrepôt Y', deliveryFee } })
    const { driverUser, driver } = await createDriverUser()
    const admin = await createUser('ADMIN')
    await request(app).post(`/api/admin/logistics/b2b/${tx.id}/assign`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })
    return { buyer, tx, driverUser, driver }
  }

  test('deliveryLifecycle.advanceShipment gère un Shipment B2B de bout en bout (PICKED_UP → DELIVERED)', async () => {
    const deliveryLifecycle = require('../src/services/deliveryLifecycle')
    const { tx, driver } = await setupAssignedB2BShipment(20000)
    const shipment = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id } })

    const { shipment: pickedUp } = await deliveryLifecycle.advanceShipment(prisma, { shipmentId: shipment.id, status: 'PICKED_UP' })
    expect(pickedUp.deliveryCode).toMatch(/^\d{4}$/)

    const refreshedTx = await prisma.b2BTransaction.findUnique({ where: { id: tx.id } })
    expect(refreshedTx.status).toBe('IN_TRANSIT') // mirroring identique à Order

    await expect(
      deliveryLifecycle.advanceShipment(prisma, { shipmentId: shipment.id, status: 'DELIVERED', otp: '0000' })
    ).rejects.toThrow(/incorrect/)

    const { shipment: delivered } = await deliveryLifecycle.advanceShipment(prisma, { shipmentId: shipment.id, status: 'DELIVERED', otp: pickedUp.deliveryCode })
    expect(delivered.status).toBe('DELIVERED')

    const finalTx = await prisma.b2BTransaction.findUnique({ where: { id: tx.id } })
    expect(finalTx.status).toBe('DELIVERED')

    // Rémunération livreur calculée sur B2BTransaction.deliveryFee, même formule que B2C.
    const refreshedDriver = await prisma.driver.findUnique({ where: { id: driver.id } })
    expect(refreshedDriver.monthlyEarnings).toBe(Math.round(20000 * 0.15))
  })

  test('un échec B2B ne tente PAS de restocker (aucune relation stock côté B2B)', async () => {
    const deliveryLifecycle = require('../src/services/deliveryLifecycle')
    const { tx, driver } = await setupAssignedB2BShipment()
    const shipment = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id } })
    await deliveryLifecycle.advanceShipment(prisma, { shipmentId: shipment.id, status: 'PICKED_UP' })

    await expect(
      deliveryLifecycle.advanceShipment(prisma, { shipmentId: shipment.id, status: 'FAILED', failureReason: 'Adresse introuvable' })
    ).resolves.toBeTruthy()

    const refreshedTx = await prisma.b2BTransaction.findUnique({ where: { id: tx.id } })
    expect(refreshedTx.status).toBe('ESCALATED')
    const refreshedDriver = await prisma.driver.findUnique({ where: { id: driver.id } })
    expect(refreshedDriver.available).toBe(true)
  })

  test('une transaction ESCALATED peut être réassignée par admin', async () => {
    const deliveryLifecycle = require('../src/services/deliveryLifecycle')
    const { tx } = await setupAssignedB2BShipment()
    const shipment = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id } })
    await deliveryLifecycle.advanceShipment(prisma, { shipmentId: shipment.id, status: 'PICKED_UP' })
    await deliveryLifecycle.advanceShipment(prisma, { shipmentId: shipment.id, status: 'FAILED', failureReason: 'x' })

    const { driver: newDriver } = await createDriverUser()
    const admin = await createUser('ADMIN')
    const res = await request(app).post(`/api/admin/logistics/b2b/${tx.id}/assign`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: newDriver.id })
    expect(res.status).toBe(200)

    const refreshedShipment = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id } })
    expect(refreshedShipment.status).toBe('PENDING_PICKUP')
    expect(refreshedShipment.driverId).toBe(newDriver.id)
    expect(refreshedShipment.deliveryCode).toBeNull() // réinitialisé, même garde-fou que le B2C (LOT10)
  })
})
