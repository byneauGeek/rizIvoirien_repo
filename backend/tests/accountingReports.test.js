const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, signToken } = require('./helpers')

async function makeAccountant(admin, permissions) {
  const user = await createUser('ACCOUNTANT')
  await request(app).put(`/api/admin/accounting/accountants/${user.id}/permissions`)
    .set('Authorization', `Bearer ${signToken(admin)}`).send({ permissions })
  return user
}

describe('LOT 6 — rapports (§25)', () => {
  test('accounting.reports.view requis', async () => {
    const admin = await createUser('ADMIN')
    const noPerm = await makeAccountant(admin, ['accounting.view'])
    const res = await request(app).get('/api/accounting/reports/summary').set('Authorization', `Bearer ${signToken(noPerm)}`)
    expect(res.status).toBe(403)
  })

  test('agrège trésorerie/transactions/rémunérations/dettes/créances', async () => {
    const admin = await createUser('ADMIN')
    const account = await prisma.treasuryAccount.create({ data: { name: 'Caisse Rapport', type: 'CAISSE', balance: 12000 } })
    await prisma.financialTransaction.create({
      data: { reference: 'TXN-RPT-1', type: 'DECAISSEMENT', direction: 'OUT', amount: 3000, status: 'CONFIRMED', accountId: account.id, createdBy: admin.id },
    })

    const res = await request(app).get('/api/accounting/reports/summary').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.treasury.totalBalance).toBeGreaterThanOrEqual(12000)
    expect(res.body.transactions.some(t => t.type === 'DECAISSEMENT' && t.total >= 3000)).toBe(true)
    expect(res.body).toHaveProperty('debts')
    expect(res.body).toHaveProperty('receivables')
  })

  test('filtre par période (dateFrom/dateTo)', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/accounting/reports/summary?dateFrom=2020-01-01&dateTo=2020-01-31')
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.period.from).toBe('2020-01-01')
  })
})

describe('LOT 6 — export CSV (§26)', () => {
  test('accounting.documents.export requis, distincte de accounting.reports.view', async () => {
    const admin = await createUser('ADMIN')
    const viewerOnly = await makeAccountant(admin, ['accounting.reports.view'])
    const res = await request(app).get('/api/accounting/reports/export?type=transactions').set('Authorization', `Bearer ${signToken(viewerOnly)}`)
    expect(res.status).toBe(403)
  })

  test('type invalide rejeté', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/accounting/reports/export?type=nope').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(400)
  })

  test('exporte les dettes en CSV avec en-têtes et BOM UTF-8', async () => {
    const admin = await createUser('ADMIN')
    await prisma.debt.create({ data: { beneficiaryName: 'Export SARL', sourceType: 'MANUAL', initialAmount: 4500 } })

    const res = await request(app).get('/api/accounting/reports/export?type=debts').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="debts-/)
    expect(res.text).toContain('Export SARL')
    expect(res.text).toContain('Bénéficiaire')
  })
})

describe('LOT 6 — documents (§27)', () => {
  test('lister requiert accounting.documents.view', async () => {
    const admin = await createUser('ADMIN')
    const noPerm = await makeAccountant(admin, ['accounting.view'])
    const res = await request(app).get('/api/accounting/documents').set('Authorization', `Bearer ${signToken(noPerm)}`)
    expect(res.status).toBe(403)
  })

  test('un rôle hors comptabilité ne peut pas uploader', async () => {
    const buyer = await createUser('BUYER')
    const debt = await prisma.debt.create({ data: { beneficiaryName: 'X', sourceType: 'MANUAL', initialAmount: 100 } })
    const res = await request(app).post('/api/accounting/documents')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .field('targetType', 'DEBT').field('targetId', String(debt.id)).field('docType', 'INVOICE')
      .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'facture.pdf', contentType: 'application/pdf' })
    expect(res.status).toBe(403)
  })

  test('joindre une pièce à une dette requiert accounting.transactions.create, pas juste .view', async () => {
    const admin = await createUser('ADMIN')
    const viewer = await makeAccountant(admin, ['accounting.transactions.view'])
    const debt = await prisma.debt.create({ data: { beneficiaryName: 'Y', sourceType: 'MANUAL', initialAmount: 100 } })
    const res = await request(app).post('/api/accounting/documents')
      .set('Authorization', `Bearer ${signToken(viewer)}`)
      .field('targetType', 'DEBT').field('targetId', String(debt.id)).field('docType', 'INVOICE')
      .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'facture.pdf', contentType: 'application/pdf' })
    expect(res.status).toBe(403)
  })

  test('upload réussi puis visible dans la liste filtrée par cible', async () => {
    const admin = await createUser('ADMIN')
    const debt = await prisma.debt.create({ data: { beneficiaryName: 'Fournisseur Z', sourceType: 'MANUAL', initialAmount: 2000 } })

    const uploaded = await request(app).post('/api/accounting/documents')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .field('targetType', 'DEBT').field('targetId', String(debt.id)).field('docType', 'INVOICE')
      .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'facture.pdf', contentType: 'application/pdf' })
    expect(uploaded.status).toBe(201)
    expect(uploaded.body.url).toBeTruthy()

    const list = await request(app).get(`/api/accounting/documents?targetType=DEBT&targetId=${debt.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(list.status).toBe(200)
    expect(list.body.documents.some(d => d.id === uploaded.body.id)).toBe(true)
  })

  test('cible inexistante rejetée', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).post('/api/accounting/documents')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .field('targetType', 'DEBT').field('targetId', '999999').field('docType', 'INVOICE')
      .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'facture.pdf', contentType: 'application/pdf' })
    expect(res.status).toBe(404)
  })

  test('docType ou targetType invalide rejeté, fichier requis', async () => {
    const admin = await createUser('ADMIN')
    const debt = await prisma.debt.create({ data: { beneficiaryName: 'W', sourceType: 'MANUAL', initialAmount: 100 } })

    const badTarget = await request(app).post('/api/accounting/documents')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .field('targetType', 'ORDER').field('targetId', String(debt.id)).field('docType', 'INVOICE')
      .attach('file', Buffer.from('x'), { filename: 'f.pdf', contentType: 'application/pdf' })
    expect(badTarget.status).toBe(400)

    const badDocType = await request(app).post('/api/accounting/documents')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .field('targetType', 'DEBT').field('targetId', String(debt.id)).field('docType', 'NOPE')
      .attach('file', Buffer.from('x'), { filename: 'f.pdf', contentType: 'application/pdf' })
    expect(badDocType.status).toBe(400)

    const noFile = await request(app).post('/api/accounting/documents')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .field('targetType', 'DEBT').field('targetId', String(debt.id)).field('docType', 'INVOICE')
    expect(noFile.status).toBe(400)
  })

  test('un exécuteur de paiements peut joindre une preuve à un ordre de paiement', async () => {
    const admin = await createUser('ADMIN')
    const executor = await makeAccountant(admin, ['accounting.payments.execute'])
    const order = await prisma.paymentOrder.create({
      data: { reference: 'ORD-DOC-TEST', amount: 500, reason: 'x', sourceType: 'MANUAL', beneficiaryName: 'B', createdBy: admin.id },
    })
    const res = await request(app).post('/api/accounting/documents')
      .set('Authorization', `Bearer ${signToken(executor)}`)
      .field('targetType', 'PAYMENT_ORDER').field('targetId', String(order.id)).field('docType', 'PROOF_OF_PAYMENT')
      .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'preuve.pdf', contentType: 'application/pdf' })
    expect(res.status).toBe(201)
  })
})
