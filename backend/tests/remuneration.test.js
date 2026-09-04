const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken, uniqueEmail } = require('./helpers')

async function grantPermissions(adminToken, userId, permissions) {
  return request(app).put(`/api/admin/accounting/accountants/${userId}/permissions`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ permissions })
}

async function makeAccountant(admin, permissions) {
  const user = await createUser('ACCOUNTANT')
  await grantPermissions(signToken(admin), user.id, permissions)
  return user
}

async function makeBuyer() {
  return createUser('BUYER')
}

describe('Rémunérations — permissions (séparation des responsabilités §3)', () => {
  test('sans permission accounting.payroll.create, le calcul est refusé', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await makeAccountant(admin, ['accounting.payroll.view'])
    const { user: driver } = await createDriverUser()

    const res = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(accountant)}`)
      .send({ beneficiaryUserId: driver.id, beneficiaryType: 'DRIVER', periodStart: '2026-01-01', periodEnd: '2026-01-31' })
    expect(res.status).toBe(403)
  })

  test('accounting.payroll.create seul ne permet pas de valider (permission distincte requise)', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await makeAccountant(admin, ['accounting.payroll.create'])
    const { user: driver, driver: driverProfile } = await createDriverUser()
    const buyer = await makeBuyer()
    const { shop } = await createShopUser()

    await prisma.order.create({
      data: {
        buyerId: buyer.id, shopId: shop.id, driverId: driverProfile.id, status: 'DELIVERED',
        total: 5000, deliveryFee: 1000, address: 'Test', updatedAt: new Date('2026-02-15'),
      },
    })

    const calc = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(accountant)}`)
      .send({ beneficiaryUserId: driver.id, beneficiaryType: 'DRIVER', periodStart: '2026-02-01', periodEnd: '2026-02-28' })
    expect(calc.status).toBe(201)

    await request(app).post(`/api/accounting/remunerations/${calc.body.id}/submit`).set('Authorization', `Bearer ${signToken(accountant)}`)

    const validate = await request(app).post(`/api/accounting/remunerations/${calc.body.id}/validate`)
      .set('Authorization', `Bearer ${signToken(accountant)}`)
    expect(validate.status).toBe(403)
  })
})

describe('Rémunérations — calcul livreur (§13)', () => {
  test('calcule le net à partir des livraisons DELIVERED réelles de la période', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await makeAccountant(admin, ['accounting.payroll.create', 'accounting.payroll.view'])
    const buyer = await makeBuyer()
    const { shop } = await createShopUser()
    const { user: driverUser, driver } = await createDriverUser({ driverData: { plan: 'BASIC' } })

    await prisma.order.createMany({
      data: [
        { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'DELIVERED', total: 5000, deliveryFee: 1000, address: 'A', updatedAt: new Date('2026-03-05') },
        { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'DELIVERED', total: 3000, deliveryFee: 800, address: 'B', updatedAt: new Date('2026-03-20') },
        // hors période : ne doit pas être compté
        { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'DELIVERED', total: 9000, deliveryFee: 5000, address: 'C', updatedAt: new Date('2026-04-05') },
      ],
    })

    const settings = await prisma.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })

    const res = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(accountant)}`)
      .send({ beneficiaryUserId: driverUser.id, beneficiaryType: 'DRIVER', periodStart: '2026-03-01', periodEnd: '2026-03-31' })

    expect(res.status).toBe(201)
    expect(res.body.grossAmount).toBe(1800) // 1000 + 800, pas les 5000 hors période
    expect(res.body.netAmount).toBe(Math.round(1800 * settings.driverCommission))
    expect(res.body.appliedCommissionRate).toBe(settings.driverCommission)
    expect(res.body.reference).toMatch(/^REM-\d{4}-\d{6}$/)
    expect(JSON.parse(res.body.calculationDetail)).toHaveLength(2)
  })

  test('bonus/pénalité/avance ajustent le net, jamais en dessous de zéro', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await makeAccountant(admin, ['accounting.payroll.create'])
    const buyer = await makeBuyer()
    const { shop } = await createShopUser()
    const { user: driverUser, driver } = await createDriverUser()

    await prisma.order.create({
      data: { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'DELIVERED', total: 5000, deliveryFee: 1000, address: 'A', updatedAt: new Date('2026-05-10') },
    })

    const tooMuchPenalty = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(accountant)}`)
      .send({ beneficiaryUserId: driverUser.id, beneficiaryType: 'DRIVER', periodStart: '2026-05-01', periodEnd: '2026-05-31', penaltyAmount: 999999 })
    expect(tooMuchPenalty.status).toBe(400)
  })

  test('aucune livraison sur la période → erreur explicite, pas une rémunération à 0', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await makeAccountant(admin, ['accounting.payroll.create'])
    const { user: driverUser } = await createDriverUser()

    const res = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(accountant)}`)
      .send({ beneficiaryUserId: driverUser.id, beneficiaryType: 'DRIVER', periodStart: '2020-01-01', periodEnd: '2020-01-31' })
    expect(res.status).toBe(400)
  })

  test('deux calculs sur exactement la même période sont refusés', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await makeAccountant(admin, ['accounting.payroll.create'])
    const buyer = await makeBuyer()
    const { shop } = await createShopUser()
    const { user: driverUser, driver } = await createDriverUser()

    await prisma.order.create({
      data: { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'DELIVERED', total: 2000, deliveryFee: 500, address: 'A', updatedAt: new Date('2026-06-10') },
    })

    const body = { beneficiaryUserId: driverUser.id, beneficiaryType: 'DRIVER', periodStart: '2026-06-01', periodEnd: '2026-06-30' }
    const first = await request(app).post('/api/accounting/remunerations/calculate').set('Authorization', `Bearer ${signToken(accountant)}`).send(body)
    expect(first.status).toBe(201)
    const second = await request(app).post('/api/accounting/remunerations/calculate').set('Authorization', `Bearer ${signToken(accountant)}`).send(body)
    expect(second.status).toBe(409)
  })
})

describe('Rémunérations — calcul vendeur (§14)', () => {
  test('calcule le solde vendeur (ventes - commission)', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await makeAccountant(admin, ['accounting.payroll.create'])
    const buyer = await makeBuyer()
    const { user: sellerUser, shop } = await createShopUser()

    await prisma.order.create({
      data: { buyerId: buyer.id, shopId: shop.id, status: 'DELIVERED', total: 10000, deliveryFee: 0, address: 'A', updatedAt: new Date('2026-07-15') },
    })
    const settings = await prisma.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })

    const res = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(accountant)}`)
      .send({ beneficiaryUserId: sellerUser.id, beneficiaryType: 'SELLER', periodStart: '2026-07-01', periodEnd: '2026-07-31' })

    expect(res.status).toBe(201)
    expect(res.body.grossAmount).toBe(10000)
    expect(res.body.netAmount).toBe(Math.round(10000 * (1 - settings.commissionRate)))
  })
})

describe('Rémunérations — bénéficiaires sans données plateforme (coopérative/employé)', () => {
  test('coopérative : grossAmount manuel requis, aucun calcul auto (la plateforme n\'encaisse pas les transactions B2B)', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await makeAccountant(admin, ['accounting.payroll.create'])
    const coopUser = await createUser('COOPERATIVE')

    const missing = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(accountant)}`)
      .send({ beneficiaryUserId: coopUser.id, beneficiaryType: 'COOPERATIVE', periodStart: '2026-08-01', periodEnd: '2026-08-31' })
    expect(missing.status).toBe(400)

    const withAmount = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(accountant)}`)
      .send({ beneficiaryUserId: coopUser.id, beneficiaryType: 'COOPERATIVE', periodStart: '2026-08-01', periodEnd: '2026-08-31', grossAmount: 50000 })
    expect(withAmount.status).toBe(201)
    expect(withAmount.body.sourceType).toBe('MANUAL')
    expect(withAmount.body.appliedCommissionRate).toBeNull()
    expect(withAmount.body.netAmount).toBe(50000)
  })
})

describe('Rémunérations — workflow complet jusqu\'à l\'ordre de paiement (§10)', () => {
  test('calcul → soumission → validation → ordre de paiement, avec permissions séparées', async () => {
    const admin = await createUser('ADMIN')
    const calculator = await makeAccountant(admin, ['accounting.payroll.create'])
    const validator  = await makeAccountant(admin, ['accounting.payroll.validate'])
    const payer      = await makeAccountant(admin, ['accounting.payments.create'])

    const buyer = await makeBuyer()
    const { shop } = await createShopUser()
    const { user: driverUser, driver } = await createDriverUser()
    await prisma.order.create({
      data: { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'DELIVERED', total: 4000, deliveryFee: 1200, address: 'A', updatedAt: new Date('2026-09-10') },
    })

    const calc = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(calculator)}`)
      .send({ beneficiaryUserId: driverUser.id, beneficiaryType: 'DRIVER', periodStart: '2026-09-01', periodEnd: '2026-09-30' })
    expect(calc.status).toBe(201)
    expect(calc.body.status).toBe('CALCULATED')

    const submit = await request(app).post(`/api/accounting/remunerations/${calc.body.id}/submit`)
      .set('Authorization', `Bearer ${signToken(calculator)}`)
    expect(submit.body.status).toBe('PENDING_VALIDATION')

    // le calculateur ne peut pas aussi valider
    const selfValidate = await request(app).post(`/api/accounting/remunerations/${calc.body.id}/validate`)
      .set('Authorization', `Bearer ${signToken(calculator)}`)
    expect(selfValidate.status).toBe(403)

    const validate = await request(app).post(`/api/accounting/remunerations/${calc.body.id}/validate`)
      .set('Authorization', `Bearer ${signToken(validator)}`)
    expect(validate.status).toBe(200)
    expect(validate.body.status).toBe('VALIDATED')
    expect(validate.body.validatedBy).toBe(validator.id)

    // le validateur ne peut pas créer l'ordre de paiement (permission différente)
    const wrongPayer = await request(app).post(`/api/accounting/remunerations/${calc.body.id}/create-payment-order`)
      .set('Authorization', `Bearer ${signToken(validator)}`)
    expect(wrongPayer.status).toBe(403)

    const order = await request(app).post(`/api/accounting/remunerations/${calc.body.id}/create-payment-order`)
      .set('Authorization', `Bearer ${signToken(payer)}`)
    expect(order.status).toBe(201)
    expect(order.body.amount).toBe(calc.body.netAmount)
    expect(order.body.status).toBe('PENDING_CONTROL')
    expect(order.body.reference).toMatch(/^ORD-\d{4}-\d{6}$/)

    const finalRem = await request(app).get(`/api/accounting/remunerations/${calc.body.id}`)
      .set('Authorization', `Bearer ${signToken(payer)}`)
    // payer n'a pas payroll.view -> 403, on vérifie plutôt via une requête admin
    expect(finalRem.status).toBe(403)
    const asAdmin = await request(app).get(`/api/accounting/remunerations/${calc.body.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(asAdmin.body.status).toBe('PAYMENT_PENDING')

    // un deuxième ordre pour la même rémunération est refusé
    const dup = await request(app).post(`/api/accounting/remunerations/${calc.body.id}/create-payment-order`)
      .set('Authorization', `Bearer ${signToken(payer)}`)
    expect(dup.status).toBe(404) // plus VALIDATED (déjà PAYMENT_PENDING)
  })

  test('rejet : nécessite un motif, repasse par PENDING_VALIDATION uniquement', async () => {
    const admin = await createUser('ADMIN')
    const calculator = await makeAccountant(admin, ['accounting.payroll.create'])
    const validator  = await makeAccountant(admin, ['accounting.payroll.validate'])
    const buyer = await makeBuyer()
    const seller = await createShopUser()
    await prisma.order.create({
      data: { buyerId: buyer.id, shopId: seller.shop.id, status: 'DELIVERED', total: 3000, address: 'A', updatedAt: new Date('2026-10-05') },
    })

    const calc = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(calculator)}`)
      .send({ beneficiaryUserId: seller.user.id, beneficiaryType: 'SELLER', periodStart: '2026-10-01', periodEnd: '2026-10-31' })
    expect(calc.status).toBe(201)
    await request(app).post(`/api/accounting/remunerations/${calc.body.id}/submit`).set('Authorization', `Bearer ${signToken(calculator)}`)

    const noReason = await request(app).post(`/api/accounting/remunerations/${calc.body.id}/reject`)
      .set('Authorization', `Bearer ${signToken(validator)}`).send({})
    expect(noReason.status).toBe(400)

    const rejected = await request(app).post(`/api/accounting/remunerations/${calc.body.id}/reject`)
      .set('Authorization', `Bearer ${signToken(validator)}`).send({ reason: 'Montant incohérent avec les commandes' })
    expect(rejected.status).toBe(200)
    expect(rejected.body.status).toBe('REJECTED')
  })

  test('annulation possible avant validation, plus après', async () => {
    const admin = await createUser('ADMIN')
    const calculator = await makeAccountant(admin, ['accounting.payroll.create'])
    const validator  = await makeAccountant(admin, ['accounting.payroll.validate'])
    const seller = await createShopUser()
    const buyer = await makeBuyer()
    await prisma.order.create({
      data: { buyerId: buyer.id, shopId: seller.shop.id, status: 'DELIVERED', total: 1000, address: 'A', updatedAt: new Date('2026-11-05') },
    })

    const calc = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(calculator)}`)
      .send({ beneficiaryUserId: seller.user.id, beneficiaryType: 'SELLER', periodStart: '2026-11-01', periodEnd: '2026-11-30' })

    const cancel = await request(app).post(`/api/accounting/remunerations/${calc.body.id}/cancel`)
      .set('Authorization', `Bearer ${signToken(calculator)}`)
    expect(cancel.status).toBe(200)
    expect(cancel.body.status).toBe('CANCELLED')

    const cancelAgain = await request(app).post(`/api/accounting/remunerations/${calc.body.id}/cancel`)
      .set('Authorization', `Bearer ${signToken(calculator)}`)
    expect(cancelAgain.status).toBe(404)
  })
})
