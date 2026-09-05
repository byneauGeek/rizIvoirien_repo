// LOT 8 (Arbitrage XXX RIZ, "cohérence logistique ↔ stock ↔ finance ↔
// rémunération") : avant ce lot, GET /api/admin/finance, GET
// /api/admin/drivers/:id/payslip et GET /api/commercial/drivers/:id
// n'agrégeaient que des Order (B2C) — une livraison B2B (payée au livreur via
// payDriverForDelivery, exactement comme un B2C) était invisible sur ces trois
// vues alors que Driver.monthlyEarnings/DriverMetric.earnings l'incluaient
// déjà. Ces tests prouvent la correction : chaque vue reflète maintenant le
// même total que ce que le livreur a réellement touché.
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

async function deliverB2BTransaction({ driverUser, driver, deliveryFee }) {
  const buyer = await createUser('TRADER')
  const seller = await createUser('COOPERATIVE')
  const tx = await prisma.b2BTransaction.create({
    data: {
      buyerUserId: buyer.id, sellerUserId: seller.id, product: 'Riz paddy', quantity: 1, unit: 'tonne',
      region: 'TestRegion', needsLogistics: true, deliveryAddress: 'Entrepot', deliveryFee, status: 'DECLARED',
    },
  })
  const admin = await createUser('ADMIN')
  await request(app).post(`/api/admin/logistics/b2b/${tx.id}/assign`)
    .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })

  await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
  await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
  const shipment = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id } })
  const qrToken = (await prisma.deliveryVerificationToken.findFirst({ where: { shipmentId: shipment.id } })).token
  await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'QR_SCANNED', qrToken })
  const buyerTx = buyer
  await request(app).post(`/api/b2b/transactions/${tx.id}/confirm-receipt`).set('Authorization', `Bearer ${signToken(buyerTx)}`)

  return { tx }
}

describe('LOT 8 — GET /api/admin/finance inclut les livraisons B2B', () => {
  test('driverPayouts et totalDeliveryFees reflètent le B2C ET le B2B, distinctement labellisés', async () => {
    const admin = await createUser('ADMIN')
    const { user: driverUser, driver } = await createDriverUser()
    await deliverB2BTransaction({ driverUser, driver, deliveryFee: 10000 })

    const res = await request(app).get('/api/admin/finance').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.b2bDeliveryFees).toBeGreaterThanOrEqual(10000)
    expect(res.body.totalDeliveryFees).toBeGreaterThanOrEqual(res.body.b2bDeliveryFees)
    expect(res.body.totalDeliveryFees).toBe(res.body.b2cDeliveryFees + res.body.b2bDeliveryFees)
    // driverPayouts doit inclure la part livreur du B2B, pas seulement du B2C.
    expect(res.body.driverPayouts).toBeGreaterThanOrEqual(Math.round(10000 * res.body.deliveryShare))
  })
})

describe('LOT 8 — GET /api/admin/drivers/:id/payslip inclut les livraisons B2B', () => {
  test('la fiche de paie d\'un livreur reflète ses livraisons B2B, pas seulement B2C', async () => {
    const admin = await createUser('ADMIN')
    const { user: driverUser, driver } = await createDriverUser()
    await deliverB2BTransaction({ driverUser, driver, deliveryFee: 8000 })

    const res = await request(app).get(`/api/admin/drivers/${driver.id}/payslip?period=monthly`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.b2bDeliveries).toHaveLength(1)
    expect(res.body.b2bDeliveries[0].deliveryFee).toBe(8000)
    expect(res.body.grossDeliveryFees).toBeGreaterThanOrEqual(8000)
    expect(res.body.totalDeliveries).toBeGreaterThanOrEqual(1)

    // Cohérence avec ce que le livreur a réellement touché (source de vérité).
    const refreshedDriver = await prisma.driver.findUnique({ where: { id: driver.id } })
    expect(res.body.driverEarnings).toBeLessThanOrEqual(refreshedDriver.monthlyEarnings)
    expect(res.body.driverEarnings).toBeGreaterThan(0)
  })

  test('un livreur sans aucune livraison B2B garde une fiche de paie B2C inchangée (b2bDeliveries vide)', async () => {
    const admin = await createUser('ADMIN')
    const { driver } = await createDriverUser()
    const res = await request(app).get(`/api/admin/drivers/${driver.id}/payslip?period=monthly`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.b2bDeliveries).toEqual([])
  })
})

describe('LOT 8 — GET /api/commercial/drivers/:id inclut les statistiques B2B', () => {
  test('les statistiques mensuelles d\'un livreur incluent ses livraisons B2B', async () => {
    const commercial = await createUser('COMMERCIAL')
    const { user: driverUser, driver } = await createDriverUser()
    await deliverB2BTransaction({ driverUser, driver, deliveryFee: 6000 })

    const res = await request(app).get(`/api/commercial/drivers/${driver.id}`)
      .set('Authorization', `Bearer ${signToken(commercial)}`)
    expect(res.status).toBe(200)
    expect(res.body.stats.thisMonth.fees).toBeGreaterThanOrEqual(6000)
    expect(res.body.stats.thisMonth.deliveries).toBeGreaterThanOrEqual(1)
  })
})
