// LOT RENOUVELLEMENT-RAPPEL (retour utilisateur — phase 2) : /commercial/renewals
// listait déjà les abonnements arrivant à échéance, mais aucune action de
// relance n'existait depuis cet écran (contrairement au contrat, qui a la
// sienne — remind-contract).
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, signToken } = require('./helpers')

async function createSubscription(shopId, overrides = {}) {
  return prisma.subscription.create({
    data: {
      shopId,
      plan: 'CERTIFIED',
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      amount: 15000,
      ...overrides,
    },
  })
}

describe('POST /commercial/subscriptions/:id/remind-renewal', () => {
  test('ADMIN/COMMERCIAL peut relancer, notifie le propriétaire de la boutique', async () => {
    const admin = await createUser('ADMIN')
    const { user: seller, shop } = await createShopUser()
    const sub = await createSubscription(shop.id)

    const res = await request(app).post(`/api/commercial/subscriptions/${sub.id}/remind-renewal`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)

    const notif = await prisma.notification.findFirst({ where: { userId: seller.id, type: 'SUBSCRIPTION_RENEWAL_REMINDER' } })
    expect(notif).toBeTruthy()
    expect(notif.message).toContain('CERTIFIED')
  })

  test('un rôle non ADMIN/COMMERCIAL est refusé', async () => {
    const { shop } = await createShopUser()
    const sub = await createSubscription(shop.id)
    const buyer = await createUser('BUYER')

    const res = await request(app).post(`/api/commercial/subscriptions/${sub.id}/remind-renewal`)
      .set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(403)
  })

  test('404 si l\'abonnement n\'existe pas', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).post('/api/commercial/subscriptions/999999/remind-renewal')
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(404)
  })
})
