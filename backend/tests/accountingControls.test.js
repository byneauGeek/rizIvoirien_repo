const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, signToken } = require('./helpers')

async function makeAccountant(admin, permissions) {
  const user = await createUser('ACCOUNTANT')
  await request(app).put(`/api/admin/accounting/accountants/${user.id}/permissions`)
    .set('Authorization', `Bearer ${signToken(admin)}`).send({ permissions })
  return user
}

describe('LOT 7 — comptes disponibles pour le rapprochement', () => {
  test('accounting.reconciliation.view suffit, sans accounting.treasury.view', async () => {
    const admin = await createUser('ADMIN')
    await prisma.treasuryAccount.create({ data: { name: 'Caisse Reconcilable', type: 'CAISSE', balance: 0 } })
    const viewer = await makeAccountant(admin, ['accounting.reconciliation.view'])

    const forbidden = await request(app).get('/api/accounting/treasury/accounts').set('Authorization', `Bearer ${signToken(viewer)}`)
    expect(forbidden.status).toBe(403)

    const res = await request(app).get('/api/accounting/reconcilable-accounts').set('Authorization', `Bearer ${signToken(viewer)}`)
    expect(res.status).toBe(200)
    expect(res.body.accounts.length).toBeGreaterThan(0)
  })
})

describe('LOT 7 — rapprochement bancaire (§28)', () => {
  test('accounting.reconciliation.view requis pour consulter', async () => {
    const admin = await createUser('ADMIN')
    const account = await prisma.treasuryAccount.create({ data: { name: 'Caisse Rappro', type: 'CAISSE', balance: 0 } })
    const noPerm = await makeAccountant(admin, ['accounting.view'])
    const res = await request(app).get(`/api/accounting/treasury/accounts/${account.id}/reconciliation`)
      .set('Authorization', `Bearer ${signToken(noPerm)}`)
    expect(res.status).toBe(403)
  })

  test('accounting.reconciliation.manage requis pour pointer, distincte de .view', async () => {
    const admin = await createUser('ADMIN')
    const account = await prisma.treasuryAccount.create({ data: { name: 'Caisse Rappro 2', type: 'CAISSE', balance: 0 } })
    const txn = await prisma.financialTransaction.create({
      data: { reference: 'TXN-RAPPRO-1', type: 'ENCAISSEMENT', direction: 'IN', amount: 1000, status: 'CONFIRMED', accountId: account.id, createdBy: admin.id },
    })
    const viewer = await makeAccountant(admin, ['accounting.reconciliation.view'])
    const res = await request(app).post(`/api/accounting/treasury/accounts/${account.id}/reconcile`)
      .set('Authorization', `Bearer ${signToken(viewer)}`).send({ transactionIds: [txn.id], reconciled: true })
    expect(res.status).toBe(403)
  })

  test('pointer puis dépointer une transaction, totaux recalculés', async () => {
    const admin = await createUser('ADMIN')
    const account = await prisma.treasuryAccount.create({ data: { name: 'Caisse Rappro 3', type: 'CAISSE', balance: 0 } })
    const txn1 = await prisma.financialTransaction.create({
      data: { reference: 'TXN-RAPPRO-2', type: 'ENCAISSEMENT', direction: 'IN', amount: 1000, status: 'CONFIRMED', accountId: account.id, createdBy: admin.id },
    })
    const txn2 = await prisma.financialTransaction.create({
      data: { reference: 'TXN-RAPPRO-3', type: 'DECAISSEMENT', direction: 'OUT', amount: 300, status: 'CONFIRMED', accountId: account.id, createdBy: admin.id },
    })

    const before = await request(app).get(`/api/accounting/treasury/accounts/${account.id}/reconciliation`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(before.body.unreconciled).toHaveLength(2)
    expect(before.body.unreconciledTotal).toBe(700)

    const marked = await request(app).post(`/api/accounting/treasury/accounts/${account.id}/reconcile`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ transactionIds: [txn1.id, txn2.id], reconciled: true })
    expect(marked.status).toBe(200)
    expect(marked.body.updated).toBe(2)

    const after = await request(app).get(`/api/accounting/treasury/accounts/${account.id}/reconciliation`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(after.body.unreconciled).toHaveLength(0)
    expect(after.body.reconciled).toHaveLength(2)
    expect(after.body.reconciledTotal).toBe(700)

    const unmarked = await request(app).post(`/api/accounting/treasury/accounts/${account.id}/reconcile`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ transactionIds: [txn1.id], reconciled: false })
    expect(unmarked.status).toBe(200)
    const afterUnmark = await prisma.financialTransaction.findUnique({ where: { id: txn1.id } })
    expect(afterUnmark.reconciled).toBe(false)
    expect(afterUnmark.reconciledBy).toBeNull()
  })

  test('une transaction d\'un autre compte est rejetée', async () => {
    const admin = await createUser('ADMIN')
    const accountA = await prisma.treasuryAccount.create({ data: { name: 'A', type: 'CAISSE', balance: 0 } })
    const accountB = await prisma.treasuryAccount.create({ data: { name: 'B', type: 'CAISSE', balance: 0 } })
    const txnB = await prisma.financialTransaction.create({
      data: { reference: 'TXN-RAPPRO-4', type: 'ENCAISSEMENT', direction: 'IN', amount: 500, status: 'CONFIRMED', accountId: accountB.id, createdBy: admin.id },
    })
    const res = await request(app).post(`/api/accounting/treasury/accounts/${accountA.id}/reconcile`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ transactionIds: [txnB.id], reconciled: true })
    expect(res.status).toBe(400)
  })
})

describe('LOT 7 — contrôle de cohérence de trésorerie (§29)', () => {
  test('accounting.audit.view requis', async () => {
    const admin = await createUser('ADMIN')
    const noPerm = await makeAccountant(admin, ['accounting.reconciliation.view'])
    const res = await request(app).get('/api/accounting/controls/treasury-consistency').set('Authorization', `Bearer ${signToken(noPerm)}`)
    expect(res.status).toBe(403)
  })

  test('détecte un compte cohérent et un compte incohérent', async () => {
    const admin = await createUser('ADMIN')
    const good = await prisma.treasuryAccount.create({ data: { name: 'Cohérent', type: 'CAISSE', balance: 500 } })
    await prisma.financialTransaction.create({
      data: { reference: 'TXN-COH-1', type: 'ENCAISSEMENT', direction: 'IN', amount: 500, status: 'CONFIRMED', accountId: good.id, createdBy: admin.id },
    })
    const bad = await prisma.treasuryAccount.create({ data: { name: 'Incohérent', type: 'CAISSE', balance: 999 } })
    await prisma.financialTransaction.create({
      data: { reference: 'TXN-COH-2', type: 'ENCAISSEMENT', direction: 'IN', amount: 500, status: 'CONFIRMED', accountId: bad.id, createdBy: admin.id },
    })

    const res = await request(app).get('/api/accounting/controls/treasury-consistency').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    const goodResult = res.body.accounts.find(a => a.accountId === good.id)
    const badResult = res.body.accounts.find(a => a.accountId === bad.id)
    expect(goodResult.consistent).toBe(true)
    expect(badResult.consistent).toBe(false)
    expect(badResult.difference).toBe(499)
  })
})

describe('LOT 7 — dettes/créances échues (§29)', () => {
  test('liste et bascule automatique vers OVERDUE', async () => {
    const admin = await createUser('ADMIN')
    const past = new Date(Date.now() - 86400000)
    const debt = await prisma.debt.create({ data: { beneficiaryName: 'Retard SARL', sourceType: 'MANUAL', initialAmount: 1000, dueDate: past } })

    const list = await request(app).get('/api/accounting/controls/overdue').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(list.status).toBe(200)
    expect(list.body.debts.some(d => d.id === debt.id)).toBe(true)

    const refresh = await request(app).post('/api/accounting/controls/overdue/refresh').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(refresh.status).toBe(200)
    expect(refresh.body.debtsFlagged).toBeGreaterThanOrEqual(1)

    const updated = await prisma.debt.findUnique({ where: { id: debt.id } })
    expect(updated.status).toBe('OVERDUE')
  })

  test('accounting.reconciliation.manage requis pour rafraîchir, distincte de .view', async () => {
    const admin = await createUser('ADMIN')
    const viewer = await makeAccountant(admin, ['accounting.reconciliation.view'])
    const res = await request(app).post('/api/accounting/controls/overdue/refresh').set('Authorization', `Bearer ${signToken(viewer)}`)
    expect(res.status).toBe(403)
  })

  test('une dette non échue n\'est pas basculée', async () => {
    const admin = await createUser('ADMIN')
    const future = new Date(Date.now() + 86400000)
    const debt = await prisma.debt.create({ data: { beneficiaryName: 'Pas encore', sourceType: 'MANUAL', initialAmount: 500, dueDate: future } })
    await request(app).post('/api/accounting/controls/overdue/refresh').set('Authorization', `Bearer ${signToken(admin)}`)
    const unchanged = await prisma.debt.findUnique({ where: { id: debt.id } })
    expect(unchanged.status).toBe('OPEN')
  })
})

describe('LOT 7 — paiements en cours depuis trop longtemps (§29)', () => {
  test('un paiement PROCESSING ancien est remonté', async () => {
    const admin = await createUser('ADMIN')
    const order = await prisma.paymentOrder.create({
      data: { reference: 'ORD-STALE-1', amount: 100, reason: 'x', sourceType: 'MANUAL', beneficiaryName: 'B', createdBy: admin.id, status: 'PROCESSING' },
    })
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000)
    await prisma.payment.create({
      data: { reference: 'PAY-STALE-1', paymentOrderId: order.id, amount: 100, method: 'CASH', status: 'PROCESSING', createdAt: old },
    })

    const res = await request(app).get('/api/accounting/controls/stale-payments?hours=24').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.payments.some(p => p.reference === 'PAY-STALE-1')).toBe(true)
  })

  test('un paiement récent n\'apparaît pas', async () => {
    const admin = await createUser('ADMIN')
    const order = await prisma.paymentOrder.create({
      data: { reference: 'ORD-STALE-2', amount: 100, reason: 'x', sourceType: 'MANUAL', beneficiaryName: 'B', createdBy: admin.id, status: 'PROCESSING' },
    })
    await prisma.payment.create({
      data: { reference: 'PAY-STALE-2', paymentOrderId: order.id, amount: 100, method: 'CASH', status: 'PROCESSING' },
    })
    const res = await request(app).get('/api/accounting/controls/stale-payments?hours=24').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.body.payments.some(p => p.reference === 'PAY-STALE-2')).toBe(false)
  })
})
