const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, signToken } = require('./helpers')

async function makeAccountant(admin, permissions) {
  const user = await createUser('ACCOUNTANT')
  await request(app).put(`/api/admin/accounting/accountants/${user.id}/permissions`)
    .set('Authorization', `Bearer ${signToken(admin)}`).send({ permissions })
  return user
}

async function fundedAccount(balance = 100000) {
  return prisma.treasuryAccount.create({ data: { name: `Caisse ${Date.now()}-${Math.random()}`, type: 'CAISSE', balance } })
}

async function createExpense(token, overrides = {}) {
  return request(app).post('/api/accounting/expenses')
    .set('Authorization', `Bearer ${token}`)
    .send({ category: 'Fournitures', amount: 5000, ...overrides })
}

describe('Dépenses — permissions', () => {
  test('un rôle non comptable est refusé', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(app).get('/api/accounting/expenses').set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(403)
  })

  test('créer requiert accounting.transactions.create', async () => {
    const admin = await createUser('ADMIN')
    const noPerm = await makeAccountant(admin, ['accounting.transactions.view'])
    const res = await createExpense(signToken(noPerm))
    expect(res.status).toBe(403)
  })

  test('valider/rejeter requiert accounting.transactions.validate, distincte de .create', async () => {
    const admin = await createUser('ADMIN')
    const creator = await makeAccountant(admin, ['accounting.transactions.create'])
    const created = await createExpense(signToken(creator))
    await request(app).post(`/api/accounting/expenses/${created.body.id}/submit`).set('Authorization', `Bearer ${signToken(creator)}`)

    const denied = await request(app).post(`/api/accounting/expenses/${created.body.id}/validate`)
      .set('Authorization', `Bearer ${signToken(creator)}`)
    expect(denied.status).toBe(403)
  })
})

describe('Dépenses — cycle de vie', () => {
  test('création rejette montant invalide ou catégorie manquante', async () => {
    const admin = await createUser('ADMIN')
    const bad1 = await createExpense(signToken(admin), { amount: 0 })
    expect(bad1.status).toBe(400)
    const bad2 = await createExpense(signToken(admin), { category: '' })
    expect(bad2.status).toBe(400)
  })

  test('DRAFT → soumission → validation, référence EXP générée', async () => {
    const admin = await createUser('ADMIN')
    const created = await createExpense(signToken(admin))
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('DRAFT')
    expect(created.body.reference).toMatch(/^EXP-\d{4}-\d{6}$/)

    const submitted = await request(app).post(`/api/accounting/expenses/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(submitted.status).toBe(200)
    expect(submitted.body.status).toBe('PENDING_VALIDATION')

    const validated = await request(app).post(`/api/accounting/expenses/${created.body.id}/validate`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(validated.status).toBe(200)
    expect(validated.body.status).toBe('VALIDATED')
    expect(validated.body.validatedBy).toBe(admin.id)
  })

  test('rejet fait passer de PENDING_VALIDATION à REJECTED', async () => {
    const admin = await createUser('ADMIN')
    const created = await createExpense(signToken(admin))
    await request(app).post(`/api/accounting/expenses/${created.body.id}/submit`).set('Authorization', `Bearer ${signToken(admin)}`)

    const rejected = await request(app).post(`/api/accounting/expenses/${created.body.id}/reject`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ reason: 'Justificatif manquant' })
    expect(rejected.status).toBe(200)
    expect(rejected.body.status).toBe('REJECTED')
  })

  test('une dépense non-DRAFT ne peut plus être éditée ni supprimée', async () => {
    const admin = await createUser('ADMIN')
    const created = await createExpense(signToken(admin))
    await request(app).post(`/api/accounting/expenses/${created.body.id}/submit`).set('Authorization', `Bearer ${signToken(admin)}`)

    const edit = await request(app).put(`/api/accounting/expenses/${created.body.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ amount: 9999 })
    expect(edit.status).toBe(400)

    const del = await request(app).delete(`/api/accounting/expenses/${created.body.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(del.status).toBe(400)
  })

  test('validate/reject refusés hors PENDING_VALIDATION', async () => {
    const admin = await createUser('ADMIN')
    const created = await createExpense(signToken(admin))
    const validate = await request(app).post(`/api/accounting/expenses/${created.body.id}/validate`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(validate.status).toBe(400)
  })
})

describe('Dépenses — intégration avec les ordres de paiement (§17-20)', () => {
  test('impossible de créer un ordre de paiement pour une dépense non validée', async () => {
    const admin = await createUser('ADMIN')
    const created = await createExpense(signToken(admin), { amount: 4000 })
    const order = await request(app).post('/api/accounting/payment-orders')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ beneficiaryName: 'Fournisseur Test', amount: 4000, reason: 'Test', sourceType: 'EXPENSE', sourceId: created.body.id })
    expect(order.status).toBe(400)
  })

  test('le montant de l\'ordre doit correspondre exactement au montant de la dépense', async () => {
    const admin = await createUser('ADMIN')
    const created = await createExpense(signToken(admin), { amount: 4000 })
    await request(app).post(`/api/accounting/expenses/${created.body.id}/submit`).set('Authorization', `Bearer ${signToken(admin)}`)
    await request(app).post(`/api/accounting/expenses/${created.body.id}/validate`).set('Authorization', `Bearer ${signToken(admin)}`)

    const mismatch = await request(app).post('/api/accounting/payment-orders')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ beneficiaryName: 'Fournisseur Test', amount: 3999, reason: 'Test', sourceType: 'EXPENSE', sourceId: created.body.id })
    expect(mismatch.status).toBe(400)
  })

  test('pipeline complet : dépense validée → ordre → exécution → confirmation passe la dépense à PAID', async () => {
    const admin = await createUser('ADMIN')
    const account = await fundedAccount(20000)
    const created = await createExpense(signToken(admin), { amount: 4000 })
    await request(app).post(`/api/accounting/expenses/${created.body.id}/submit`).set('Authorization', `Bearer ${signToken(admin)}`)
    await request(app).post(`/api/accounting/expenses/${created.body.id}/validate`).set('Authorization', `Bearer ${signToken(admin)}`)

    const order = await request(app).post('/api/accounting/payment-orders')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ beneficiaryName: 'Fournisseur Test', amount: 4000, reason: 'Règlement dépense', sourceType: 'EXPENSE', sourceId: created.body.id })
    expect(order.status).toBe(201)

    await request(app).post(`/api/accounting/payment-orders/${order.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'APPROVE' })
    const executed = await request(app).post(`/api/accounting/payment-orders/${order.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'BANK_TRANSFER' })
    expect(executed.status).toBe(201)

    const confirmed = await request(app).post(`/api/accounting/payments/${executed.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ outcome: 'PAID' })
    expect(confirmed.status).toBe(200)

    const expense = await prisma.expense.findUnique({ where: { id: created.body.id } })
    expect(expense.status).toBe('PAID')
  })
})

describe('Dépenses — export CSV (§26)', () => {
  test('le type "expenses" est exportable', async () => {
    const admin = await createUser('ADMIN')
    await createExpense(signToken(admin), { amount: 1234 })
    const res = await request(app).get('/api/accounting/reports/export?type=expenses')
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.text).toContain('Référence')
  })
})
