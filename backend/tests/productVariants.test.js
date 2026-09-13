// LOT VARIANTS (retour utilisateur) — jamais testé depuis sa livraison.
// Couvre le CRUD des variantes (propriété boutique, unicité de taille), et
// leur résolution au checkout (prix/stock/gros par variante, pas par le
// produit de base) via resolveLineItem() dans orders.js.
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, signToken } = require('./helpers')

async function createProduct(seller, overrides = {}) {
  const res = await request(app).post('/api/products')
    .set('Authorization', `Bearer ${signToken(seller)}`)
    .send({ name: `Riz ${Date.now()}-${Math.random()}`, category: 'Riz Parfumé', price: 2500, unit: '5kg', stock: 10, ...overrides })
  return res.body
}
async function createVariant(seller, productId, overrides = {}) {
  return request(app).post(`/api/products/${productId}/variants`)
    .set('Authorization', `Bearer ${signToken(seller)}`)
    .send({ unit: '25kg', price: 10000, stock: 5, ...overrides })
}

describe('Création de variante', () => {
  test('unit/price requis, prix invalide rejeté', async () => {
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller)
    const noUnit = await createVariant(seller, product.id, { unit: '' })
    expect(noUnit.status).toBe(400)
    const badPrice = await createVariant(seller, product.id, { price: 0 })
    expect(badPrice.status).toBe(400)
  })

  test('même unité que la taille de base : rejeté', async () => {
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller, { unit: '25kg' })
    const res = await createVariant(seller, product.id, { unit: '25kg' })
    expect(res.status).toBe(400)
  })

  test('deux variantes de la même unité pour le même produit : conflit', async () => {
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller)
    const first = await createVariant(seller, product.id, { unit: '50kg' })
    expect(first.status).toBe(201)
    const duplicate = await createVariant(seller, product.id, { unit: '50kg' })
    expect(duplicate.status).toBe(409)
  })

  test('un vendeur ne peut pas ajouter de variante au produit d\'un autre', async () => {
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller)
    const { user: stranger } = await createShopUser()
    const res = await createVariant(stranger, product.id)
    expect(res.status).toBe(404)
  })
})

describe('Édition et suppression de variante', () => {
  test('modifier le prix, désactiver', async () => {
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller)
    const variant = (await createVariant(seller, product.id)).body

    const updated = await request(app).put(`/api/products/${product.id}/variants/${variant.id}`)
      .set('Authorization', `Bearer ${signToken(seller)}`).send({ price: 12000, active: false })
    expect(updated.status).toBe(200)
    expect(updated.body.price).toBe(12000)
    expect(updated.body.active).toBe(false)
  })

  test('supprime réellement une variante jamais commandée', async () => {
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller)
    const variant = (await createVariant(seller, product.id)).body

    const del = await request(app).delete(`/api/products/${product.id}/variants/${variant.id}`)
      .set('Authorization', `Bearer ${signToken(seller)}`)
    expect(del.status).toBe(200)
    const gone = await prisma.productVariant.findUnique({ where: { id: variant.id } })
    expect(gone).toBeNull()
  })

  test('désactive au lieu de supprimer une variante déjà référencée par une commande', async () => {
    const buyer = await createUser('BUYER')
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller)
    const variant = (await createVariant(seller, product.id)).body

    await request(app).post('/api/orders').set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ items: [{ productId: product.id, variantId: variant.id, quantity: 1 }], address: 'Adresse test' })

    const del = await request(app).delete(`/api/products/${product.id}/variants/${variant.id}`)
      .set('Authorization', `Bearer ${signToken(seller)}`)
    expect(del.status).toBe(200)
    expect(del.body.deactivatedInstead).toBe(true)
    const still = await prisma.productVariant.findUnique({ where: { id: variant.id } })
    expect(still).not.toBeNull()
    expect(still.active).toBe(false)
  })
})

describe('Checkout avec variante — prix/stock résolus PAR VARIANTE', () => {
  test('la commande facture le prix de la variante, pas celui du produit de base', async () => {
    const buyer = await createUser('BUYER')
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller, { price: 2500 })
    const variant = (await createVariant(seller, product.id, { unit: '50kg', price: 20000, stock: 5 })).body

    const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ items: [{ productId: product.id, variantId: variant.id, quantity: 2 }], address: 'Adresse test' })
    expect(res.status).toBe(201)
    expect(res.body.total).toBe(40000) // 2 * 20000, pas 2 * 2500
    expect(res.body.items[0].unitLabel).toBe('50kg')
    expect(res.body.items[0].variantId).toBe(variant.id)
  })

  test('décrémente le stock de la variante commandée, jamais celui du produit de base', async () => {
    const buyer = await createUser('BUYER')
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller, { stock: 10 })
    const variant = (await createVariant(seller, product.id, { stock: 5 })).body

    await request(app).post('/api/orders').set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ items: [{ productId: product.id, variantId: variant.id, quantity: 2 }], address: 'Adresse test' })

    const refreshedVariant = await prisma.productVariant.findUnique({ where: { id: variant.id } })
    const refreshedProduct = await prisma.product.findUnique({ where: { id: product.id } })
    expect(refreshedVariant.stock).toBe(3) // 5 - 2
    expect(refreshedProduct.stock).toBe(10) // inchangé
  })

  test('stock de variante insuffisant : commande refusée', async () => {
    const buyer = await createUser('BUYER')
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller)
    const variant = (await createVariant(seller, product.id, { stock: 1 })).body

    const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ items: [{ productId: product.id, variantId: variant.id, quantity: 5 }], address: 'Adresse test' })
    expect(res.status).toBe(400)
  })

  test('une variante inactive ne peut plus être commandée', async () => {
    const buyer = await createUser('BUYER')
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller)
    const variant = (await createVariant(seller, product.id)).body
    await request(app).put(`/api/products/${product.id}/variants/${variant.id}`)
      .set('Authorization', `Bearer ${signToken(seller)}`).send({ active: false })

    const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ items: [{ productId: product.id, variantId: variant.id, quantity: 1 }], address: 'Adresse test' })
    expect(res.status).toBe(400)
  })

  test('un panier avec deux tailles différentes du MÊME produit passe correctement (pas de faux 404 productIds)', async () => {
    const buyer = await createUser('BUYER')
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller, { price: 2500, stock: 10 })
    const variant = (await createVariant(seller, product.id, { unit: '50kg', price: 20000, stock: 5 })).body

    const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({
        items: [
          { productId: product.id, quantity: 1 }, // taille de base (5kg)
          { productId: product.id, variantId: variant.id, quantity: 1 }, // variante 50kg
        ],
        address: 'Adresse test',
      })
    expect(res.status).toBe(201)
    expect(res.body.total).toBe(2500 + 20000)
    expect(res.body.items).toHaveLength(2)
  })

  test('prix de gros de la variante appliqué au-delà du seuil minWholesaleQty', async () => {
    const buyer = await createUser('BUYER')
    const { user: seller } = await createShopUser()
    const product = await createProduct(seller, { saleType: 'BOTH' })
    const variant = (await createVariant(seller, product.id, {
      unit: '50kg', price: 20000, stock: 20, wholesalePrice: 18000, minWholesaleQty: 5,
    })).body

    const belowThreshold = await request(app).post('/api/orders').set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ items: [{ productId: product.id, variantId: variant.id, quantity: 4 }], address: 'Adresse test' })
    expect(belowThreshold.body.total).toBe(4 * 20000)

    const buyer2 = await createUser('BUYER')
    const atThreshold = await request(app).post('/api/orders').set('Authorization', `Bearer ${signToken(buyer2)}`)
      .send({ items: [{ productId: product.id, variantId: variant.id, quantity: 5 }], address: 'Adresse test' })
    expect(atThreshold.body.total).toBe(5 * 18000)
  })
})
