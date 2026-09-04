const request = require('supertest')
const app = require('../src/index')
const { createUser, createShopUser, signToken } = require('./helpers')

describe('RBAC', () => {
  test('un BUYER ne peut pas créer de produit (route SELLER uniquement)', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ name: 'Riz test', category: 'Riz', price: 5000 })
    expect(res.status).toBe(403)
  })

  test('un SELLER ne peut pas accéder aux routes ADMIN', async () => {
    const { user } = await createShopUser()
    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${signToken(user)}`)
    expect(res.status).toBe(403)
  })

  test('une route ADMIN sans aucun token → 401 (pas 403)', async () => {
    const res = await request(app).get('/api/admin/analytics')
    expect(res.status).toBe(401)
  })

  test('un ADMIN accède bien à ses routes', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
  })

  test('un SELLER ne peut pas modifier le produit d\'un autre vendeur (IDOR)', async () => {
    const seller1 = await createShopUser()
    const seller2 = await createShopUser()

    const product = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${signToken(seller1.user)}`)
      .send({ name: 'Riz seller1', category: 'Riz', price: 5000 })
    expect(product.status).toBe(201)

    const attempt = await request(app)
      .put(`/api/products/${product.body.id}`)
      .set('Authorization', `Bearer ${signToken(seller2.user)}`)
      .send({ name: 'Piraté' })
    expect(attempt.status).toBe(404) // findFirst scopé à shopId du vendeur → introuvable pour seller2
  })
})
