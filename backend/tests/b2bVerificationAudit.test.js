// LOT B2B-8 (audit XXX RIZ) : PUT /api/admin/b2b/verifications/:profileType/:id
// journalise déjà chaque changement (AdminLog) et notifie déjà le vendeur
// concerné — confirmé fonctionnel en lisant le code, mais sans AUCUN test
// avant ce lot (grep exhaustif : zéro fichier ne couvrait cette route,
// contrairement à ce qu'affirmait à tort un premier passage d'audit).
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, signToken, uniqueEmail } = require('./helpers')

async function registerB2B(profileType, profile) {
  const res = await request(app).post('/api/auth/register-b2b').send({
    profileType, email: uniqueEmail(profileType.toLowerCase()), password: 'Password123!',
    name: `${profileType} test`, phone: '0700000000', profile,
  })
  return res
}

describe('LOT B2B-8 — traçabilité et notification sur changement de vérification B2B', () => {
  test('VERIFIED : journalisé dans AdminLog et notifié au vendeur', async () => {
    const admin = await createUser('ADMIN')
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const producerId = reg.body.user.producer.id
    const producerUserId = reg.body.user.id

    const res = await request(app).put(`/api/admin/b2b/verifications/PRODUCER/${producerId}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ verification: 'VERIFIED' })
    expect(res.status).toBe(200)
    expect(res.body.verification).toBe('VERIFIED')

    // setImmediate : laisser le event loop vider la microtask/macrotask avant de lire.
    await new Promise(r => setImmediate(r))

    const log = await prisma.adminLog.findFirst({ where: { action: 'B2B_VERIFICATION', targetId: producerId } })
    expect(log).toBeTruthy()
    expect(log.adminId).toBe(admin.id)
    expect(JSON.parse(log.details).verification).toBe('VERIFIED')

    const notif = await prisma.notification.findFirst({ where: { userId: producerUserId, type: 'B2B_VERIFICATION' } })
    expect(notif).toBeTruthy()
    expect(notif.message).toMatch(/vérifié/i)
  })

  test('REJECTED : retombe sur UNVERIFIED, notifie avec le bon message de refus', async () => {
    const admin = await createUser('ADMIN')
    const reg = await registerB2B('TRADER', { companyName: 'Négoce Test' })
    const traderId = reg.body.user.trader.id
    const traderUserId = reg.body.user.id

    const res = await request(app).put(`/api/admin/b2b/verifications/TRADER/${traderId}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ verification: 'REJECTED' })
    expect(res.status).toBe(200)
    expect(res.body.verification).toBe('UNVERIFIED')

    await new Promise(r => setImmediate(r))

    const notif = await prisma.notification.findFirst({
      where: { userId: traderUserId, type: 'B2B_VERIFICATION' },
      orderBy: { createdAt: 'desc' },
    })
    expect(notif).toBeTruthy()
    expect(notif.message).toMatch(/refusée/i)
  })

  test('SUSPENDED : journalisé et notifié', async () => {
    const admin = await createUser('ADMIN')
    const reg = await registerB2B('COOPERATIVE', { name: 'Coop Test', responsable: 'Kouassi', region: 'Man' })
    const coopId = reg.body.user.cooperative.id
    const coopUserId = reg.body.user.id

    const res = await request(app).put(`/api/admin/b2b/verifications/COOPERATIVE/${coopId}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ verification: 'SUSPENDED' })
    expect(res.status).toBe(200)

    await new Promise(r => setImmediate(r))

    const log = await prisma.adminLog.findFirst({ where: { action: 'B2B_VERIFICATION', targetId: coopId } })
    expect(log).toBeTruthy()
    const notif = await prisma.notification.findFirst({ where: { userId: coopUserId, type: 'B2B_VERIFICATION' } })
    expect(notif.message).toMatch(/suspendu/i)
  })

  test('un non-admin ne peut pas modifier une vérification B2B', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const producerId = reg.body.user.producer.id
    const res = await request(app).put(`/api/admin/b2b/verifications/PRODUCER/${producerId}`)
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ verification: 'VERIFIED' })
    expect(res.status).toBe(403)
  })
})
