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

async function manualOrder(token, overrides = {}) {
  const res = await request(app).post('/api/accounting/payment-orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ beneficiaryName: 'Bénéficiaire Test', amount: 5000, reason: 'Ordre de test', sourceType: 'MANUAL', ...overrides })
  return res
}

describe('LOT 5 — permissions (séparation des tâches)', () => {
  test('créer un ordre requiert accounting.payments.create', async () => {
    const admin = await createUser('ADMIN')
    const noPerm = await makeAccountant(admin, ['accounting.payments.view'])
    const res = await manualOrder(signToken(noPerm))
    expect(res.status).toBe(403)
  })

  test('contrôler/exécuter requiert accounting.payments.execute, distincte de .create', async () => {
    const admin = await createUser('ADMIN')
    const creator = await makeAccountant(admin, ['accounting.payments.create'])
    const created = await manualOrder(signToken(creator))
    expect(created.status).toBe(201)

    const control = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(creator)}`).send({ decision: 'APPROVE' })
    expect(control.status).toBe(403)
  })

  test('annuler requiert accounting.payments.cancel, distincte de .execute', async () => {
    const admin = await createUser('ADMIN')
    const controller = await makeAccountant(admin, ['accounting.payments.create', 'accounting.payments.execute'])
    const created = await manualOrder(signToken(controller))

    const cancel = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${signToken(controller)}`).send({ reason: 'Test' })
    expect(cancel.status).toBe(403)
  })
})

describe('LOT 5 — comptes disponibles pour l\'exécution', () => {
  test('accounting.payments.execute suffit à lister les comptes, sans accounting.treasury.view', async () => {
    const admin = await createUser('ADMIN')
    await fundedAccount(1000)
    const executor = await makeAccountant(admin, ['accounting.payments.execute'])

    const forbidden = await request(app).get('/api/accounting/treasury/accounts').set('Authorization', `Bearer ${signToken(executor)}`)
    expect(forbidden.status).toBe(403)

    const res = await request(app).get('/api/accounting/payable-accounts').set('Authorization', `Bearer ${signToken(executor)}`)
    expect(res.status).toBe(200)
    expect(res.body.accounts.length).toBeGreaterThan(0)
    expect(res.body.accounts[0]).toHaveProperty('balance')
  })
})

describe('LOT 5 — création manuelle d\'ordre (§17)', () => {
  test('sourceType invalide ou bénéficiaire manquant rejetés', async () => {
    const admin = await createUser('ADMIN')
    const bad1 = await request(app).post('/api/accounting/payment-orders').set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ amount: 100, reason: 'x', sourceType: 'CRYPTO' })
    expect(bad1.status).toBe(400)

    const bad2 = await request(app).post('/api/accounting/payment-orders').set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ amount: 100, reason: 'x', sourceType: 'MANUAL' })
    expect(bad2.status).toBe(400)
  })

  test('ordre DEBT plafonné au solde restant de la dette', async () => {
    const admin = await createUser('ADMIN')
    const debt = await prisma.debt.create({ data: { beneficiaryName: 'Fournisseur X', sourceType: 'MANUAL', initialAmount: 3000 } })

    const tooMuch = await request(app).post('/api/accounting/payment-orders').set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ beneficiaryName: 'Fournisseur X', amount: 5000, reason: 'Règlement', sourceType: 'DEBT', sourceId: debt.id })
    expect(tooMuch.status).toBe(400)

    const ok = await request(app).post('/api/accounting/payment-orders').set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ beneficiaryName: 'Fournisseur X', amount: 3000, reason: 'Règlement', sourceType: 'DEBT', sourceId: debt.id })
    expect(ok.status).toBe(201)
  })
})

describe('LOT 5 — pipeline complet, succès (§18-20)', () => {
  test('ordre → contrôle → exécution → confirmation débite la trésorerie et trace le mouvement', async () => {
    const admin = await createUser('ADMIN')
    const account = await fundedAccount(50000)
    const created = await manualOrder(signToken(admin), { amount: 7000 })
    expect(created.body.status).toBe('PENDING_CONTROL')

    const approved = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'APPROVE' })
    expect(approved.status).toBe(200)
    expect(approved.body.status).toBe('PENDING_PAYMENT')

    const executed = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'BANK_TRANSFER' })
    expect(executed.status).toBe(201)
    expect(executed.body.order.status).toBe('PROCESSING')
    expect(executed.body.payment.status).toBe('PROCESSING')

    // Le solde ne bouge pas tant que ce n'est pas confirmé.
    const accountMidway = await prisma.treasuryAccount.findUnique({ where: { id: account.id } })
    expect(accountMidway.balance).toBe(50000)

    const confirmed = await request(app).post(`/api/accounting/payments/${executed.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ outcome: 'PAID' })
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.order.status).toBe('PAID')
    expect(confirmed.body.payment.status).toBe('PAID')

    const accountAfter = await prisma.treasuryAccount.findUnique({ where: { id: account.id } })
    expect(accountAfter.balance).toBe(43000)

    const txn = await prisma.financialTransaction.findFirst({ where: { sourceType: 'PAYMENT_ORDER', sourceId: created.body.id } })
    expect(txn).toBeTruthy()
    expect(txn.type).toBe('PAYMENT_EXECUTED')
    expect(txn.direction).toBe('OUT')
    expect(txn.amount).toBe(7000)
  })

  test('exécution refusée si l\'ordre n\'a pas été approuvé, ou si le compte est en solde insuffisant', async () => {
    const admin = await createUser('ADMIN')
    const account = await fundedAccount(100)
    const created = await manualOrder(signToken(admin), { amount: 500 })

    const tooEarly = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'CASH' })
    expect(tooEarly.status).toBe(400)

    await request(app).post(`/api/accounting/payment-orders/${created.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'APPROVE' })

    const insufficient = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'CASH' })
    expect(insufficient.status).toBe(400)
  })
})

describe('LOT 5 — échec de paiement puis nouvelle tentative', () => {
  test('un échec ne débite pas la trésorerie et permet une nouvelle exécution', async () => {
    const admin = await createUser('ADMIN')
    const account = await fundedAccount(20000)
    const created = await manualOrder(signToken(admin), { amount: 4000 })
    await request(app).post(`/api/accounting/payment-orders/${created.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'APPROVE' })

    const firstAttempt = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'MOBILE_MONEY' })

    const failed = await request(app).post(`/api/accounting/payments/${firstAttempt.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ outcome: 'FAILED', failureReason: 'Numéro invalide' })
    expect(failed.status).toBe(200)
    expect(failed.body.order.status).toBe('FAILED')
    expect(failed.body.payment.status).toBe('FAILED')

    const accountAfterFailure = await prisma.treasuryAccount.findUnique({ where: { id: account.id } })
    expect(accountAfterFailure.balance).toBe(20000)

    // Nouvelle tentative sur le même ordre (toujours FAILED = ré-exécutable).
    const retry = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'MOBILE_MONEY' })
    expect(retry.status).toBe(201)

    const succeeded = await request(app).post(`/api/accounting/payments/${retry.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ outcome: 'PAID' })
    expect(succeeded.status).toBe(200)
    expect(succeeded.body.order.status).toBe('PAID')

    const accountFinal = await prisma.treasuryAccount.findUnique({ where: { id: account.id } })
    expect(accountFinal.balance).toBe(16000)

    const payments = await prisma.payment.findMany({ where: { paymentOrderId: created.body.id } })
    expect(payments).toHaveLength(2)
  })
})

describe('LOT 5 — doublons bloqués', () => {
  test('exécuter deux fois le même ordre en cours est refusé', async () => {
    const admin = await createUser('ADMIN')
    const account = await fundedAccount(20000)
    const created = await manualOrder(signToken(admin), { amount: 1000 })
    await request(app).post(`/api/accounting/payment-orders/${created.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'APPROVE' })
    await request(app).post(`/api/accounting/payment-orders/${created.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'CASH' })

    const duplicate = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'CASH' })
    expect(duplicate.status).toBe(400)
  })

  test('confirmer deux fois le même paiement est refusé', async () => {
    const admin = await createUser('ADMIN')
    const account = await fundedAccount(20000)
    const created = await manualOrder(signToken(admin), { amount: 1000 })
    await request(app).post(`/api/accounting/payment-orders/${created.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'APPROVE' })
    const executed = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'CASH' })

    await request(app).post(`/api/accounting/payments/${executed.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ outcome: 'PAID' })
    const duplicateConfirm = await request(app).post(`/api/accounting/payments/${executed.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ outcome: 'PAID' })
    expect(duplicateConfirm.status).toBe(400)
  })
})

describe('LOT 5 — mise en attente, libération, annulation', () => {
  test('HOLD puis RELEASE remet l\'ordre en file de contrôle', async () => {
    const admin = await createUser('ADMIN')
    const created = await manualOrder(signToken(admin))
    const held = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'HOLD', reason: 'Vérification en cours' })
    expect(held.status).toBe(200)
    expect(held.body.status).toBe('ON_HOLD')

    const released = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'RELEASE' })
    expect(released.status).toBe(200)
    expect(released.body.status).toBe('PENDING_CONTROL')
  })

  test('un ordre payé ou en cours ne peut pas être annulé', async () => {
    const admin = await createUser('ADMIN')
    const account = await fundedAccount(20000)
    const created = await manualOrder(signToken(admin), { amount: 1000 })
    await request(app).post(`/api/accounting/payment-orders/${created.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'APPROVE' })
    const executed = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'CASH' })

    const cancelWhileProcessing = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ reason: 'x' })
    expect(cancelWhileProcessing.status).toBe(400)

    await request(app).post(`/api/accounting/payments/${executed.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ outcome: 'PAID' })

    const cancelWhilePaid = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ reason: 'x' })
    expect(cancelWhilePaid.status).toBe(400)
  })

  test('annulation depuis PENDING_CONTROL réussit', async () => {
    const admin = await createUser('ADMIN')
    const created = await manualOrder(signToken(admin))
    const cancelled = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ reason: 'Doublon' })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.status).toBe('CANCELLED')
  })
})

describe('LOT 5 — rémunération : rejet d\'ordre puis nouvelle tentative', () => {
  test('un ordre rejeté libère la rémunération pour un nouvel ordre (même référence, remunerationId unique)', async () => {
    const admin = await createUser('ADMIN')
    const driver = await createUser('DRIVER')
    const remuneration = await prisma.remuneration.create({
      data: {
        reference: 'REM-TEST-0001', beneficiaryUserId: driver.id, beneficiaryType: 'DRIVER',
        periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
        sourceType: 'DRIVER_COMMISSION', grossAmount: 1000, netAmount: 1000, status: 'VALIDATED',
        validatedBy: admin.id, validatedAt: new Date(), createdBy: admin.id,
      },
    })

    const created = await request(app).post(`/api/accounting/remunerations/${remuneration.id}/create-payment-order`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(created.status).toBe(201)
    const firstReference = created.body.reference

    const rejected = await request(app).post(`/api/accounting/payment-orders/${created.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'REJECT', reason: 'Mauvais compte bénéficiaire' })
    expect(rejected.status).toBe(200)
    expect(rejected.body.status).toBe('REJECTED')

    const remAfterReject = await prisma.remuneration.findUnique({ where: { id: remuneration.id } })
    expect(remAfterReject.status).toBe('VALIDATED')

    const blocked = await request(app).post(`/api/accounting/remunerations/${remuneration.id}/create-payment-order`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(blocked.status).toBe(201) // pas de 409 : l'ordre rejeté est réinitialisé
    expect(blocked.body.reference).toBe(firstReference)
    expect(blocked.body.status).toBe('PENDING_CONTROL')

    const stillBlocked = await request(app).post(`/api/accounting/remunerations/${remuneration.id}/create-payment-order`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(stillBlocked.status).toBe(404) // remuneration n'est plus VALIDATED (repassée PAYMENT_PENDING)
  })
})

describe('LOT 5 — paiement partiel d\'une dette (§22 + §20)', () => {
  test('deux ordres successifs soldent progressivement la même dette', async () => {
    const admin = await createUser('ADMIN')
    const account = await fundedAccount(20000)
    const debt = await prisma.debt.create({ data: { beneficiaryName: 'Coopérative Y', sourceType: 'MANUAL', initialAmount: 10000 } })

    const order1 = await request(app).post('/api/accounting/payment-orders').set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ beneficiaryName: 'Coopérative Y', amount: 4000, reason: 'Acompte', sourceType: 'DEBT', sourceId: debt.id })
    await request(app).post(`/api/accounting/payment-orders/${order1.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'APPROVE' })
    const exec1 = await request(app).post(`/api/accounting/payment-orders/${order1.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'BANK_TRANSFER' })
    await request(app).post(`/api/accounting/payments/${exec1.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ outcome: 'PAID' })

    const debtMidway = await prisma.debt.findUnique({ where: { id: debt.id } })
    expect(debtMidway.status).toBe('PARTIALLY_PAID')
    expect(debtMidway.paidAmount).toBe(4000)

    const order2 = await request(app).post('/api/accounting/payment-orders').set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ beneficiaryName: 'Coopérative Y', amount: 6000, reason: 'Solde', sourceType: 'DEBT', sourceId: debt.id })
    await request(app).post(`/api/accounting/payment-orders/${order2.body.id}/control`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ decision: 'APPROVE' })
    const exec2 = await request(app).post(`/api/accounting/payment-orders/${order2.body.id}/execute`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ accountId: account.id, method: 'BANK_TRANSFER' })
    await request(app).post(`/api/accounting/payments/${exec2.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ outcome: 'PAID' })

    const debtFinal = await prisma.debt.findUnique({ where: { id: debt.id } })
    expect(debtFinal.status).toBe('PAID')
    expect(debtFinal.paidAmount).toBe(10000)

    const accountFinal = await prisma.treasuryAccount.findUnique({ where: { id: account.id } })
    expect(accountFinal.balance).toBe(10000)
  })
})
