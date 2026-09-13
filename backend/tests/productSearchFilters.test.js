// LOT RECHERCHE (phase 1 post-audit) : Product.origin et ProductVariant
// existaient déjà, jamais exposés comme filtre de recherche/région/taille.
const request = require('supertest')
const app = require('../src/index')
const { createShopUser, signToken } = require('./helpers')

async function createProduct(seller, overrides = {}) {
  return request(app).post('/api/products')
    .set('Authorization', `Bearer ${signToken(seller)}`)
    .send({ name: `Riz ${Date.now()}-${Math.random()}`, category: 'Riz local', price: 2500, unit: '5kg', stock: 10, ...overrides })
}
async function createVariant(seller, productId, overrides = {}) {
  return request(app).post(`/api/products/${productId}/variants`)
    .set('Authorization', `Bearer ${signToken(seller)}`).send({ unit: '25kg', price: 10000, stock: 5, ...overrides })
}

describe('Filtre par origine/région', () => {
  test('GET /products?origin= ne renvoie que les produits de cette origine', async () => {
    const { user: seller } = await createShopUser()
    const uniqueOrigin = `Man-${Date.now()}`
    const matching = await createProduct(seller, { origin: uniqueOrigin })
    await createProduct(seller, { origin: 'Autre région' })

    const res = await request(app).get(`/api/products?origin=${encodeURIComponent(uniqueOrigin)}`)
    expect(res.status).toBe(200)
    expect(res.body.products.every(p => p.origin === uniqueOrigin)).toBe(true)
    expect(res.body.products.some(p => p.id === matching.body.id)).toBe(true)
  })

  test('GET /products/origins liste les origines réelles avec comptage', async () => {
    const { user: seller } = await createShopUser()
    const uniqueOrigin = `Korhogo-${Date.now()}`
    await createProduct(seller, { origin: uniqueOrigin })
    await createProduct(seller, { origin: uniqueOrigin })

    const res = await request(app).get('/api/products/origins')
    expect(res.status).toBe(200)
    const entry = res.body.find(o => o.origin === uniqueOrigin)
    expect(entry).toBeTruthy()
    expect(entry.count).toBe(2)
  })
})

describe('Filtre par taille de sac (produit de base OU variante)', () => {
  test('GET /products?unit= remonte un produit dont la taille de BASE correspond', async () => {
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller, { unit: '10kg', category: `CatUnit-${Date.now()}` })

    const res = await request(app).get(`/api/products?unit=10kg&category=${product.body.category}`)
    expect(res.body.products.some(p => p.id === product.body.id)).toBe(true)
  })

  test('GET /products?unit= remonte un produit dont seule une VARIANTE correspond', async () => {
    const { user: seller } = await createShopUser()
    const category = `CatUnitVariant-${Date.now()}`
    const product = await createProduct(seller, { unit: '5kg', category })
    await createVariant(seller, product.body.id, { unit: '50kg' })

    const res = await request(app).get(`/api/products?unit=50kg&category=${category}`)
    expect(res.body.products.some(p => p.id === product.body.id)).toBe(true)

    // La taille de base (5kg) ne doit pas matcher un filtre sur 50kg.
    const wrongUnit = await request(app).get(`/api/products?unit=5kg&category=${category}`)
    expect(wrongUnit.body.products.some(p => p.id === product.body.id)).toBe(true) // matche via sa taille de base
  })

  test('une variante DÉSACTIVÉE n\'est plus retenue par le filtre', async () => {
    const { user: seller } = await createShopUser()
    const category = `CatUnitInactive-${Date.now()}`
    const product = await createProduct(seller, { unit: '5kg', category })
    const variant = (await createVariant(seller, product.body.id, { unit: '100kg' })).body
    await request(app).put(`/api/products/${product.body.id}/variants/${variant.id}`)
      .set('Authorization', `Bearer ${signToken(seller)}`).send({ active: false })

    const res = await request(app).get(`/api/products?unit=100kg&category=${category}`)
    expect(res.body.products.some(p => p.id === product.body.id)).toBe(false)
  })

  test('GET /products/units liste les tailles distinctes (base + variantes)', async () => {
    const { user: seller } = await createShopUser()
    const uniqueUnit = `${Date.now()}kg`
    const product = await createProduct(seller, { unit: uniqueUnit })
    await createVariant(seller, product.body.id, { unit: `${Date.now()}-v-kg` })

    const res = await request(app).get('/api/products/units')
    expect(res.status).toBe(200)
    expect(res.body).toContain(uniqueUnit)
  })
})
