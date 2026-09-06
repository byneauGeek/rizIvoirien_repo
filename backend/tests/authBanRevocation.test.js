// LOT PROD-5 (audit XXX RIZ) : gap confirmé — `banned` n'était vérifié qu'à la
// connexion (POST /auth/login). Un compte banni APRÈS avoir obtenu un JWT (7j)
// gardait un accès complet jusqu'à l'expiration du token, faute de contrôle
// dans le middleware authenticate(). Ce lot ajoute ce contrôle (auth.js),
// puisqu'il recharge déjà l'utilisateur en base à chaque requête.
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, signToken } = require('./helpers')

describe('LOT PROD-5 — révocation immédiate d\'un compte banni', () => {
  test('un token émis avant le ban est rejeté (403) dès la requête suivante', async () => {
    const user = await createUser('BUYER')
    const token = signToken(user)

    const before = await request(app).get('/api/wishlist').set('Authorization', `Bearer ${token}`)
    expect(before.status).not.toBe(403)

    await prisma.user.update({ where: { id: user.id }, data: { banned: true } })

    const after = await request(app).get('/api/wishlist').set('Authorization', `Bearer ${token}`)
    expect(after.status).toBe(403)
    expect(after.body.error).toMatch(/suspendu/i)
  })

  test('un token valide pour un compte non banni continue de fonctionner', async () => {
    const user = await createUser('BUYER')
    const token = signToken(user)
    const res = await request(app).get('/api/wishlist').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})
