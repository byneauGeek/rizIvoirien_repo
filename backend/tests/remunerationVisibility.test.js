const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

let refCounter = 0
const uniqueRef = (prefix) => `${prefix}-TEST-${Date.now()}-${refCounter++}`

async function makeRemuneration({ beneficiaryUserId, beneficiaryType, withPaymentOrder = false }) {
  const creator = await createUser('ADMIN')
  const remuneration = await prisma.remuneration.create({
    data: {
      reference: uniqueRef('REM'),
      beneficiaryUserId,
      beneficiaryType,
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
      sourceType: beneficiaryType === 'DRIVER' ? 'DELIVERIES' : 'SALES',
      grossAmount: 10000,
      netAmount: 8000,
      status: withPaymentOrder ? 'PAYMENT_PENDING' : 'VALIDATED',
      createdBy: creator.id,
    },
  })
  if (withPaymentOrder) {
    await prisma.paymentOrder.create({
      data: {
        reference: uniqueRef('ORD'),
        beneficiaryUserId,
        amount: 8000,
        reason: 'test',
        sourceType: 'REMUNERATION',
        remunerationId: remuneration.id,
        createdBy: creator.id,
      },
    })
  }
  return remuneration
}

describe('LOT 7 — visibilité livreur sur ses propres rémunérations (arbitrage Décision 2)', () => {
  test('un livreur voit ses propres rémunérations, avec le statut de paiement associé', async () => {
    const { user: driverUser, driver } = await createDriverUser()
    await makeRemuneration({ beneficiaryUserId: driverUser.id, beneficiaryType: 'DRIVER', withPaymentOrder: true })

    const res = await request(app).get('/api/drivers/me/remunerations').set('Authorization', `Bearer ${signToken(driverUser)}`)
    expect(res.status).toBe(200)
    expect(res.body.remunerations).toHaveLength(1)
    expect(res.body.remunerations[0].netAmount).toBe(8000)
    expect(res.body.remunerations[0].paymentOrder).toBeTruthy()
    expect(res.body.remunerations[0].paymentOrder.status).toBe('PENDING_CONTROL')
  })

  test('un livreur ne voit jamais les rémunérations d\'un autre livreur', async () => {
    const { user: driverA } = await createDriverUser()
    const { user: driverB } = await createDriverUser()
    await makeRemuneration({ beneficiaryUserId: driverA.id, beneficiaryType: 'DRIVER' })

    const res = await request(app).get('/api/drivers/me/remunerations').set('Authorization', `Bearer ${signToken(driverB)}`)
    expect(res.status).toBe(200)
    expect(res.body.remunerations).toHaveLength(0)
  })

  test('un non-livreur ne peut pas accéder à la route livreur', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(app).get('/api/drivers/me/remunerations').set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(403)
  })
})

describe('LOT 7 — visibilité boutique (partenaire) sur ses propres rémunérations', () => {
  test('une boutique voit ses propres rémunérations SELLER uniquement', async () => {
    const { user: sellerUser } = await createShopUser()
    await makeRemuneration({ beneficiaryUserId: sellerUser.id, beneficiaryType: 'SELLER' })

    const res = await request(app).get('/api/shops/my/remunerations').set('Authorization', `Bearer ${signToken(sellerUser)}`)
    expect(res.status).toBe(200)
    expect(res.body.remunerations).toHaveLength(1)
    expect(res.body.remunerations[0].paymentOrder).toBeNull()
  })

  test('une boutique ne voit pas les rémunérations DRIVER même si le même compte avait un jour ce rôle', async () => {
    const { user: sellerUser } = await createShopUser()
    // Rémunération d'un autre type de bénéficiaire, même s'il partageait l'id (cas limite improbable) : filtrée par beneficiaryType.
    await makeRemuneration({ beneficiaryUserId: sellerUser.id, beneficiaryType: 'DRIVER' })

    const res = await request(app).get('/api/shops/my/remunerations').set('Authorization', `Bearer ${signToken(sellerUser)}`)
    expect(res.body.remunerations).toHaveLength(0)
  })
})
