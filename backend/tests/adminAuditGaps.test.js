// LOT AUDIT-G7 (audit XXX RIZ) : 3 routes admin écrivaient en base sans
// AdminLog, contrairement aux ~45 routes voisines de admin.js qui loguent
// systématiquement chaque action sensible.
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

describe('LOT AUDIT-G7 — traçabilité admin', () => {
  test('DELETE /admin/subscriptions/:id journalise SUBSCRIPTION_CANCEL', async () => {
    const admin = await createUser('ADMIN')
    const { shop } = await createShopUser()
    const sub = await prisma.subscription.create({ data: { shopId: shop.id, plan: 'CERTIFIED', amount: 15000 } })

    const res = await request(app).delete(`/api/admin/subscriptions/${sub.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)

    await new Promise((r) => setImmediate(r))
    const log = await prisma.adminLog.findFirst({ where: { action: 'SUBSCRIPTION_CANCEL', targetId: sub.id } })
    expect(log).toBeTruthy()
    expect(log.adminId).toBe(admin.id)

    const updated = await prisma.subscription.findUnique({ where: { id: sub.id } })
    expect(updated.status).toBe('CANCELLED')
  })

  test('POST /admin/invite-codes journalise INVITE_CODE_CREATE', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).post('/api/admin/invite-codes')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ count: 3 })
    expect(res.status).toBe(201)
    expect(res.body).toHaveLength(3)

    await new Promise((r) => setImmediate(r))
    const log = await prisma.adminLog.findFirst({ where: { action: 'INVITE_CODE_CREATE', adminId: admin.id } })
    expect(log).toBeTruthy()
    expect(JSON.parse(log.details).count).toBe(3)
  })

  test('POST /admin/contracts/regenerate/shop/:id journalise CONTRACT_REGENERATE', async () => {
    const admin = await createUser('ADMIN')
    const { shop } = await createShopUser()

    const res = await request(app).post(`/api/admin/contracts/regenerate/shop/${shop.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)

    await new Promise((r) => setImmediate(r))
    const log = await prisma.adminLog.findFirst({ where: { action: 'CONTRACT_REGENERATE', targetType: 'SHOP', targetId: shop.id } })
    expect(log).toBeTruthy()
  })

  test('POST /admin/contracts/regenerate/driver/:id journalise CONTRACT_REGENERATE', async () => {
    const admin = await createUser('ADMIN')
    const { driver } = await createDriverUser()

    const res = await request(app).post(`/api/admin/contracts/regenerate/driver/${driver.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)

    await new Promise((r) => setImmediate(r))
    const log = await prisma.adminLog.findFirst({ where: { action: 'CONTRACT_REGENERATE', targetType: 'DRIVER', targetId: driver.id } })
    expect(log).toBeTruthy()
  })
})
