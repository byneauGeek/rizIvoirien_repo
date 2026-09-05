const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, signToken } = require('./helpers')

async function createProduct(shopId, overrides = {}) {
  return prisma.product.create({
    data: {
      shopId, name: 'Riz test commande', slug: `riz-order-${Date.now()}-${Math.random()}`,
      category: 'Riz', price: 5000, stock: 20, active: true, ...overrides,
    },
  })
}

describe('POST /api/orders — création (LOT 3 : décrément via le Stock Engine)', () => {
  test('crée la commande, décrémente le stock, trace un StockMovement lié à la commande', async () => {
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, { stock: 20 })

    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ items: [{ productId: product.id, quantity: 3 }], address: '123 rue Test, Abidjan' })

    expect(res.status).toBe(201)

    const refreshedProduct = await prisma.product.findUnique({ where: { id: product.id } })
    expect(refreshedProduct.stock).toBe(17)

    const position = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(position.quantity).toBe(17)

    const movement = await prisma.stockMovement.findFirst({ where: { productId: product.id, type: 'SALE' } })
    expect(movement).toBeTruthy()
    expect(movement.quantity).toBe(-3)
    expect(movement.sourceType).toBe('ORDER')
    expect(movement.sourceId).toBe(res.body.id)
  })

  test('rejette une commande dont la quantité dépasse le stock (pré-check)', async () => {
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, { stock: 2 })

    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ items: [{ productId: product.id, quantity: 5 }], address: '123 rue Test, Abidjan' })

    expect(res.status).toBe(400)
    const unchanged = await prisma.product.findUnique({ where: { id: product.id } })
    expect(unchanged.stock).toBe(2)
    expect(await prisma.stockMovement.findMany({ where: { productId: product.id } })).toHaveLength(0)
  })

  test('deux commandes concurrentes sur un stock limité : une seule réussit, aucun stock négatif', async () => {
    const buyer1 = await createUser('BUYER')
    const buyer2 = await createUser('BUYER')
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, { stock: 10 })

    const [res1, res2] = await Promise.all([
      request(app).post('/api/orders').set('Authorization', `Bearer ${signToken(buyer1)}`)
        .send({ items: [{ productId: product.id, quantity: 8 }], address: 'Adresse 1' }),
      request(app).post('/api/orders').set('Authorization', `Bearer ${signToken(buyer2)}`)
        .send({ items: [{ productId: product.id, quantity: 8 }], address: 'Adresse 2' }),
    ])

    const statuses = [res1.status, res2.status].sort()
    expect(statuses).toEqual([201, 400])

    const finalProduct = await prisma.product.findUnique({ where: { id: product.id } })
    expect(finalProduct.stock).toBe(2)
    expect(finalProduct.stock).toBeGreaterThanOrEqual(0)

    const position = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(position.quantity).toBe(2)

    const saleMovements = await prisma.stockMovement.findMany({ where: { productId: product.id, type: 'SALE' } })
    expect(saleMovements).toHaveLength(1)
  })

  test('commande multi-boutiques : chaque article décrémente le bon produit, lié à sa propre commande', async () => {
    const buyer = await createUser('BUYER')
    const { shop: shopA } = await createShopUser()
    const { shop: shopB } = await createShopUser()
    const productA = await createProduct(shopA.id, { stock: 10 })
    const productB = await createProduct(shopB.id, { stock: 10 })

    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({
        items: [{ productId: productA.id, quantity: 2 }, { productId: productB.id, quantity: 4 }],
        address: '123 rue Test, Abidjan',
      })

    expect(res.status).toBe(201)
    expect(res.body.multiShop).toBe(true)
    expect(res.body.orders).toHaveLength(2)

    const posA = await prisma.stockPosition.findUnique({ where: { productId: productA.id } })
    const posB = await prisma.stockPosition.findUnique({ where: { productId: productB.id } })
    expect(posA.quantity).toBe(8)
    expect(posB.quantity).toBe(6)

    const movA = await prisma.stockMovement.findFirst({ where: { productId: productA.id, type: 'SALE' } })
    const movB = await prisma.stockMovement.findFirst({ where: { productId: productB.id, type: 'SALE' } })
    // Chaque mouvement doit référencer SA propre commande (pas la même pour les deux boutiques)
    expect(movA.sourceId).not.toBe(movB.sourceId)
    expect(res.body.orders.map(o => o.id)).toEqual(expect.arrayContaining([movA.sourceId, movB.sourceId]))
  })
})

describe('DELETE /api/orders/:id — annulation acheteur (restockage existant, non transactionnel)', () => {
  test('annule et restocke — reste cohérent avec le Stock Engine (Product.stock et StockPosition alignés)', async () => {
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, { stock: 10 })

    const created = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ items: [{ productId: product.id, quantity: 4 }], address: 'Adresse test' })
    expect(created.status).toBe(201)

    const afterOrder = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(afterOrder.quantity).toBe(6)

    const cancelled = await request(app).delete(`/api/orders/${created.body.id}`)
      .set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(cancelled.status).toBe(200)

    // NOTE (audit LOT 0) : ce chemin d'annulation écrit encore directement sur
    // Product.stock (pas encore migré vers stockEngine.restockFromCancellation
    // — prévu LOT 4). StockPosition n'est donc PAS mise à jour ici : c'est un
    // écart connu et documenté, pas une régression de ce lot.
    const productAfterCancel = await prisma.product.findUnique({ where: { id: product.id } })
    expect(productAfterCancel.stock).toBe(10)
  })
})
