const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, signToken } = require('./helpers')

describe('LOT 2 (Arbitrage XXX RIZ) — capacités additives (BUYER + TRADER)', () => {
  test('un BUYER sans capacité ne peut pas accéder à une route réservée TRADER', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(app).get('/api/b2b/my-profile').set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(403)
  })

  test('activer la capacité TRADER donne accès aux routes B2B sans changer le rôle principal', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(app).post('/api/auth/capabilities')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ profileType: 'TRADER', profile: { companyName: 'Négoce Test' } })
    expect(res.status).toBe(201)
    expect(res.body.capabilities).toContain('TRADER')

    const refreshed = await prisma.user.findUnique({ where: { id: buyer.id } })
    expect(refreshed.role).toBe('BUYER') // rôle principal inchangé

    const profileRes = await request(app).get('/api/b2b/my-profile').set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(profileRes.status).toBe(200)
  })

  test('effective dès la requête suivante, sans réémission de token', async () => {
    const buyer = await createUser('BUYER')
    const token = signToken(buyer) // émis AVANT l'activation
    await request(app).post('/api/auth/capabilities')
      .set('Authorization', `Bearer ${token}`)
      .send({ profileType: 'TRADER', profile: { companyName: 'Négoce Test' } })

    // Même token, capacité pourtant déjà effective (chargée depuis la DB à chaque requête).
    const res = await request(app).get('/api/b2b/my-profile').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  test('idempotent : activer deux fois ne duplique pas la capacité ni le profil', async () => {
    const buyer = await createUser('BUYER')
    const token = signToken(buyer)
    await request(app).post('/api/auth/capabilities').set('Authorization', `Bearer ${token}`)
      .send({ profileType: 'TRADER', profile: { companyName: 'Négoce Test' } })
    const second = await request(app).post('/api/auth/capabilities').set('Authorization', `Bearer ${token}`)
      .send({ profileType: 'TRADER', profile: { companyName: 'Négoce Test 2' } })
    expect(second.status).toBe(200) // pas 201 : rien créé la 2e fois

    const capabilities = await prisma.userCapability.findMany({ where: { userId: buyer.id } })
    expect(capabilities).toHaveLength(1)
    const traders = await prisma.trader.findMany({ where: { userId: buyer.id } })
    expect(traders).toHaveLength(1)
    expect(traders[0].companyName).toBe('Négoce Test') // pas écrasé par le 2e appel
  })

  test('refuse d\'activer une capacité déjà égale au rôle principal', async () => {
    const trader = await createUser('TRADER')
    const res = await request(app).post('/api/auth/capabilities')
      .set('Authorization', `Bearer ${signToken(trader)}`)
      .send({ profileType: 'TRADER', profile: { companyName: 'x' } })
    expect(res.status).toBe(400)
  })

  test('champs requis manquants rejetés (400)', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(app).post('/api/auth/capabilities')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ profileType: 'TRADER', profile: {} })
    expect(res.status).toBe(400)
  })

  test('un compte SANS la capacité n\'est jamais affecté par celle d\'un autre', async () => {
    const buyerWithCapability = await createUser('BUYER')
    await request(app).post('/api/auth/capabilities').set('Authorization', `Bearer ${signToken(buyerWithCapability)}`)
      .send({ profileType: 'TRADER', profile: { companyName: 'x' } })

    const plainBuyer = await createUser('BUYER')
    const res = await request(app).get('/api/b2b/my-profile').set('Authorization', `Bearer ${signToken(plainBuyer)}`)
    expect(res.status).toBe(403)
  })
})
