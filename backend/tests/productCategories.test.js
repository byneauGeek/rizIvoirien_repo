// Phase 1 (post-audit) : GET /products/categories comptait tout produit
// `active`, sans vérifier moderationStatus — un produit REJECTED/PENDING_REVIEW
// (jamais visible via GET /products) gonflait quand même le compteur affiché
// publiquement sur l'accueil et la page boutique.
const request = require('supertest')
const app = require('../src/index')
const { createUser, createShopUser, signToken } = require('./helpers')

async function createProduct(seller, overrides = {}) {
  return request(app).post('/api/products')
    .set('Authorization', `Bearer ${signToken(seller)}`)
    .send({ name: `Riz ${Date.now()}-${Math.random()}`, category: 'Riz parfumé', price: 2500, stock: 10, ...overrides })
}

describe('GET /products/categories', () => {
  test('ne compte que les produits APPROVED d\'une boutique active', async () => {
    const { user: seller } = await createShopUser()
    const uniqueCategory = `CatTest-${Date.now()}`
    const approved1 = await createProduct(seller, { category: uniqueCategory })
    const approved2 = await createProduct(seller, { category: uniqueCategory })
    expect(approved1.body.moderationStatus).toBe('APPROVED')
    expect(approved2.body.moderationStatus).toBe('APPROVED')

    const res = await request(app).get('/api/products/categories')
    const entry = res.body.find(c => c.category === uniqueCategory)
    expect(entry).toBeTruthy()
    expect(entry.count).toBe(2)
  })

  test('exclut les produits REJECTED du comptage', async () => {
    const admin = await createUser('ADMIN')
    const uniqueCategory = `CatRejected-${Date.now()}`
    const rule = await request(app).post('/api/admin/approval-rules').set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ targetType: 'PRODUCT', ruleType: 'MIN_PRICE', severity: 'AUTO_REJECT', label: 'Prix trop bas', params: { min: 999999 } })

    try {
      const { user: seller } = await createShopUser()
      const rejected = await createProduct(seller, { category: uniqueCategory, price: 2500 })
      expect(rejected.body.moderationStatus).toBe('REJECTED')

      const res = await request(app).get('/api/products/categories')
      const entry = res.body.find(c => c.category === uniqueCategory)
      expect(entry).toBeUndefined()
    } finally {
      // Ne jamais laisser cette règle active pour les tests suivants (d'autres
      // fichiers partagent la même base tout au long de `npm test`).
      await request(app).delete(`/api/admin/approval-rules/${rule.body.id}`).set('Authorization', `Bearer ${signToken(admin)}`)
    }
  })
})
