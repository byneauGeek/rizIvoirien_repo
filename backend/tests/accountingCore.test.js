const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, signToken } = require('./helpers')

async function makeAccountant(admin, permissions) {
  const user = await createUser('ACCOUNTANT')
  await request(app).put(`/api/admin/accounting/accountants/${user.id}/permissions`)
    .set('Authorization', `Bearer ${signToken(admin)}`).send({ permissions })
  return user
}

describe('Comptabilité — dashboard (LOT 4)', () => {
  test('un rôle non comptable est refusé', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(app).get('/api/accounting/dashboard').set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(403)
  })

  test('un ACCOUNTANT sans accounting.view est refusé, un ADMIN passe toujours', async () => {
    const admin = await createUser('ADMIN')
    const noView = await makeAccountant(admin, ['accounting.transactions.view'])
    const denied = await request(app).get('/api/accounting/dashboard').set('Authorization', `Bearer ${signToken(noView)}`)
    expect(denied.status).toBe(403)

    const asAdmin = await request(app).get('/api/accounting/dashboard').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(asAdmin.status).toBe(200)
    expect(asAdmin.body).toHaveProperty('treasury')
    expect(asAdmin.body).toHaveProperty('debts')
    expect(asAdmin.body).toHaveProperty('receivables')
    expect(asAdmin.body).toHaveProperty('paymentsByStatus')
    expect(asAdmin.body).toHaveProperty('remunerationsByStatus')
  })
})

describe('Comptabilité — recherche de bénéficiaire (nécessaire à l\'écran Rémunérations)', () => {
  test('un ACCOUNTANT peut chercher un livreur par nom sans accès à GET /admin/users', async () => {
    const admin = await createUser('ADMIN')
    const payroll = await makeAccountant(admin, ['accounting.payroll.view'])
    const driver = await createUser('DRIVER', { name: 'Kouassi Livreur Unique' })

    const forbidden = await request(app).get('/api/admin/users?search=Kouassi').set('Authorization', `Bearer ${signToken(payroll)}`)
    expect(forbidden.status).toBe(403)

    const res = await request(app).get('/api/accounting/beneficiaries/search?role=DRIVER&q=Kouassi Livreur Unique')
      .set('Authorization', `Bearer ${signToken(payroll)}`)
    expect(res.status).toBe(200)
    expect(res.body.users.some(u => u.id === driver.id)).toBe(true)
  })

  test('rôle invalide rejeté', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/accounting/beneficiaries/search?role=NOT_A_ROLE')
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(400)
  })
})

describe('Comptabilité — trésorerie (§21)', () => {
  test('accounting.treasury.view ne permet pas de créer un compte (permission distincte)', async () => {
    const admin = await createUser('ADMIN')
    const viewer = await makeAccountant(admin, ['accounting.treasury.view'])
    const res = await request(app).post('/api/accounting/treasury/accounts')
      .set('Authorization', `Bearer ${signToken(viewer)}`)
      .send({ name: 'Caisse test', type: 'CAISSE' })
    expect(res.status).toBe(403)
  })

  test('création puis lecture d\'un compte de trésorerie', async () => {
    const admin = await createUser('ADMIN')
    const manager = await makeAccountant(admin, ['accounting.treasury.manage', 'accounting.treasury.view'])

    const created = await request(app).post('/api/accounting/treasury/accounts')
      .set('Authorization', `Bearer ${signToken(manager)}`)
      .send({ name: 'Mobile Money Orange', type: 'MOBILE_MONEY' })
    expect(created.status).toBe(201)
    expect(created.body.balance).toBe(0)
    expect(created.body.currency).toBe('XOF')

    const detail = await request(app).get(`/api/accounting/treasury/accounts/${created.body.id}`)
      .set('Authorization', `Bearer ${signToken(manager)}`)
    expect(detail.status).toBe(200)
    expect(detail.body.transactions).toEqual([])
  })

  test('type de compte invalide rejeté', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).post('/api/accounting/treasury/accounts')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ name: 'X', type: 'CRYPTO' })
    expect(res.status).toBe(400)
  })
})

describe('Comptabilité — dettes (§22)', () => {
  test('création, règlement partiel puis total, avec mouvement de trésorerie', async () => {
    const admin = await createUser('ADMIN')
    const account = await prisma.treasuryAccount.create({ data: { name: 'Caisse LOT4', type: 'CAISSE', balance: 100000 } })
    const driver = await createUser('DRIVER')

    const debt = await request(app).post('/api/accounting/debts')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ beneficiaryUserId: driver.id, sourceType: 'MANUAL', initialAmount: 10000 })
    expect(debt.status).toBe(201)
    expect(debt.body.status).toBe('OPEN')

    const partial = await request(app).post(`/api/accounting/debts/${debt.body.id}/record-payment`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ amount: 4000, accountId: account.id })
    expect(partial.status).toBe(200)
    expect(partial.body.status).toBe('PARTIALLY_PAID')
    expect(partial.body.paidAmount).toBe(4000)

    const accountAfterPartial = await prisma.treasuryAccount.findUnique({ where: { id: account.id } })
    expect(accountAfterPartial.balance).toBe(96000)

    const overpay = await request(app).post(`/api/accounting/debts/${debt.body.id}/record-payment`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ amount: 999999 })
    expect(overpay.status).toBe(400)

    const final = await request(app).post(`/api/accounting/debts/${debt.body.id}/record-payment`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ amount: 6000, accountId: account.id })
    expect(final.status).toBe(200)
    expect(final.body.status).toBe('PAID')

    const accountFinal = await prisma.treasuryAccount.findUnique({ where: { id: account.id } })
    expect(accountFinal.balance).toBe(90000)

    const afterPaid = await request(app).post(`/api/accounting/debts/${debt.body.id}/record-payment`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ amount: 1 })
    expect(afterPaid.status).toBe(400)

    const txns = await prisma.financialTransaction.findMany({ where: { sourceType: 'DEBT', sourceId: debt.body.id } })
    expect(txns).toHaveLength(2)
    expect(txns.every(t => t.type === 'DECAISSEMENT' && t.direction === 'OUT')).toBe(true)
  })

  test('bénéficiaire externe sans compte plateforme (beneficiaryName)', async () => {
    const admin = await createUser('ADMIN')
    const debt = await request(app).post('/api/accounting/debts')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ beneficiaryName: 'Fournisseur Externe SARL', sourceType: 'MANUAL', initialAmount: 3000 })
    expect(debt.status).toBe(201)
    expect(debt.body.beneficiaryUserId).toBeNull()
  })

  test('sans bénéficiaire ni montant valide -> rejeté', async () => {
    const admin = await createUser('ADMIN')
    const noBeneficiary = await request(app).post('/api/accounting/debts')
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ sourceType: 'MANUAL', initialAmount: 1000 })
    expect(noBeneficiary.status).toBe(400)

    const badAmount = await request(app).post('/api/accounting/debts')
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ beneficiaryName: 'X', initialAmount: -5 })
    expect(badAmount.status).toBe(400)
  })
})

describe('Comptabilité — créances (§23)', () => {
  test('création puis encaissement total incrémente la trésorerie', async () => {
    const admin = await createUser('ADMIN')
    const account = await prisma.treasuryAccount.create({ data: { name: 'Banque LOT4', type: 'BANQUE', balance: 0 } })

    const receivable = await request(app).post('/api/accounting/receivables')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ debtorName: 'Client Entreprise X', sourceType: 'MANUAL', amount: 20000 })
    expect(receivable.status).toBe(201)

    const encaissement = await request(app).post(`/api/accounting/receivables/${receivable.body.id}/record-payment`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ amount: 20000, accountId: account.id })
    expect(encaissement.status).toBe(200)
    expect(encaissement.body.status).toBe('PAID')

    const accountAfter = await prisma.treasuryAccount.findUnique({ where: { id: account.id } })
    expect(accountAfter.balance).toBe(20000)

    const txn = await prisma.financialTransaction.findFirst({ where: { sourceType: 'RECEIVABLE', sourceId: receivable.body.id } })
    expect(txn.type).toBe('ENCAISSEMENT')
    expect(txn.direction).toBe('IN')
  })
})

describe('Comptabilité — transactions et ordres de paiement (lecture, §9/§17)', () => {
  test('liste des transactions filtrable par type/statut', async () => {
    const admin = await createUser('ADMIN')
    await prisma.financialTransaction.create({
      data: { reference: 'TXN-FILTER-TEST-1', type: 'ADJUSTMENT', direction: 'IN', amount: 500, status: 'CONFIRMED', createdBy: admin.id },
    })
    const res = await request(app).get('/api/accounting/financial-transactions?type=ADJUSTMENT&status=CONFIRMED')
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.transactions.some(t => t.reference === 'TXN-FILTER-TEST-1')).toBe(true)
  })

  test('un permission payments.view distincte de transactions.view protège les ordres de paiement', async () => {
    const admin = await createUser('ADMIN')
    const txOnly = await makeAccountant(admin, ['accounting.transactions.view'])
    const res = await request(app).get('/api/accounting/payment-orders').set('Authorization', `Bearer ${signToken(txOnly)}`)
    expect(res.status).toBe(403)
  })
})
