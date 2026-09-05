const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createDriverUser, signToken } = require('./helpers')

let refCounter = 0
const uniqueRef = () => `REM-TEST-${Date.now()}-${refCounter++}`

describe('LOT 11 — réconciliation Comptabilité ↔ Logistique (arbitrage Décision 2)', () => {
  test('un livreur avec un cumul logistique mais sans Remuneration calculée est marqué NON_CALCULE', async () => {
    const { user: driverUser, driver } = await createDriverUser()
    const now = new Date()
    await prisma.driverMetric.create({
      data: { driverId: driver.id, month: now.getMonth() + 1, year: now.getFullYear(), deliveries: 5, earnings: 4000 },
    })

    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/admin/logistics/earnings-reconciliation')
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)

    const row = res.body.rows.find(r => r.driverId === driver.id)
    expect(row).toBeTruthy()
    expect(row.logisticsEstimate).toBe(4000)
    expect(row.officialAmount).toBe(0)
    expect(row.officialStatus).toBe('NON_CALCULE')
    expect(row.delta).toBe(4000)
  })

  test('une Remuneration calculée pour la période fait apparaître un écart réel', async () => {
    const { user: driverUser, driver } = await createDriverUser()
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    await prisma.driverMetric.create({ data: { driverId: driver.id, month, year, deliveries: 3, earnings: 3000 } })

    const creator = await createUser('ADMIN')
    await prisma.remuneration.create({
      data: {
        reference: uniqueRef(),
        beneficiaryUserId: driverUser.id,
        beneficiaryType: 'DRIVER',
        periodStart: new Date(year, month - 1, 1),
        periodEnd: new Date(year, month - 1, 28),
        sourceType: 'DELIVERIES',
        grossAmount: 3000,
        netAmount: 2700,
        status: 'PAID',
        createdBy: creator.id,
      },
    })

    const admin = await createUser('ADMIN')
    const res = await request(app).get(`/api/admin/logistics/earnings-reconciliation?month=${month}&year=${year}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)

    const row = res.body.rows.find(r => r.driverId === driver.id)
    expect(row.officialAmount).toBe(2700)
    expect(row.officialPaid).toBe(2700)
    expect(row.officialStatus).toBe('PAID')
    expect(row.delta).toBe(300) // 3000 estimé - 2700 payé net (commission/ajustements)
  })

  test('une Remuneration REJECTED est ignorée dans le rapprochement', async () => {
    const { user: driverUser, driver } = await createDriverUser()
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    await prisma.driverMetric.create({ data: { driverId: driver.id, month, year, deliveries: 1, earnings: 1000 } })

    const creator = await createUser('ADMIN')
    await prisma.remuneration.create({
      data: {
        reference: uniqueRef(),
        beneficiaryUserId: driverUser.id,
        beneficiaryType: 'DRIVER',
        periodStart: new Date(year, month - 1, 1),
        periodEnd: new Date(year, month - 1, 28),
        sourceType: 'DELIVERIES',
        grossAmount: 1000,
        netAmount: 900,
        status: 'REJECTED',
        createdBy: creator.id,
      },
    })

    const admin = await createUser('ADMIN')
    const res = await request(app).get(`/api/admin/logistics/earnings-reconciliation?month=${month}&year=${year}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)

    const row = res.body.rows.find(r => r.driverId === driver.id)
    expect(row.officialAmount).toBe(0)
    expect(row.officialStatus).toBe('NON_CALCULE')
  })

  test('un non-admin ne peut pas accéder au rapprochement', async () => {
    const seller = await createUser('SELLER')
    const res = await request(app).get('/api/admin/logistics/earnings-reconciliation')
      .set('Authorization', `Bearer ${signToken(seller)}`)
    expect(res.status).toBe(403)
  })

  test('month invalide est rejeté (400)', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/admin/logistics/earnings-reconciliation?month=13')
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(400)
  })
})
