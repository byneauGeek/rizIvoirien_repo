// LOT 11 (Arbitrage XXX RIZ) : GET /api/b2b/transactions/:id/track — équivalent
// B2B de orders.js GET /:id/track, ajouté pour donner enfin à l'acheteur B2B
// un accès réel au QR/code de secours déjà générés côté backend depuis LOT2/3.
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createDriverUser, signToken } = require('./helpers')

async function setupB2BWithShipment() {
  const buyer = await createUser('TRADER')
  const seller = await createUser('COOPERATIVE')
  const tx = await prisma.b2BTransaction.create({
    data: {
      buyerUserId: buyer.id, sellerUserId: seller.id, product: 'Riz', quantity: 100, unit: 'sac',
      region: 'Abidjan', needsLogistics: true, deliveryAddress: 'Entrepot test', deliveryFee: 5000, status: 'DECLARED',
    },
  })
  const { user: driverUser, driver } = await createDriverUser()
  const admin = await createUser('ADMIN')
  await request(app).post(`/api/admin/logistics/b2b/${tx.id}/assign`)
    .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })
  return { buyer, seller, driverUser, tx }
}

describe('LOT 11 — GET /api/b2b/transactions/:id/track', () => {
  test('sans shipment : renvoie des valeurs nulles, jamais une erreur', async () => {
    const buyer = await createUser('TRADER')
    const seller = await createUser('COOPERATIVE')
    const tx = await prisma.b2BTransaction.create({
      data: { buyerUserId: buyer.id, sellerUserId: seller.id, product: 'Riz', quantity: 1, unit: 'tonne', region: 'x', status: 'DECLARED' },
    })
    const res = await request(app).get(`/api/b2b/transactions/${tx.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ shipmentStatus: null, deliveryCode: null, qrToken: null })
  })

  test('après ARRIVED : le QR est exposé à l\'acheteur', async () => {
    const { buyer, driverUser, tx } = await setupB2BWithShipment()
    await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    await request(app).put(`/api/drivers/delivery/b2b/${tx.id}/status`).set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })

    const res = await request(app).get(`/api/b2b/transactions/${tx.id}/track`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(200)
    expect(res.body.shipmentStatus).toBe('ARRIVED')
    expect(res.body.qrToken).toBeTruthy()
    expect(res.body.deliveryCode).toBeTruthy()
  })

  test('un tiers (le vendeur, ou un autre utilisateur) ne peut pas suivre la livraison d\'un autre acheteur', async () => {
    const { seller, tx } = await setupB2BWithShipment()
    const stranger = await createUser('TRADER')

    const sellerRes = await request(app).get(`/api/b2b/transactions/${tx.id}/track`).set('Authorization', `Bearer ${signToken(seller)}`)
    expect(sellerRes.status).toBe(403)

    const strangerRes = await request(app).get(`/api/b2b/transactions/${tx.id}/track`).set('Authorization', `Bearer ${signToken(stranger)}`)
    expect(strangerRes.status).toBe(403)
  })

  test('un admin peut consulter le suivi de n\'importe quelle transaction', async () => {
    const { tx } = await setupB2BWithShipment()
    const admin = await createUser('ADMIN')
    const res = await request(app).get(`/api/b2b/transactions/${tx.id}/track`).set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
  })
})
