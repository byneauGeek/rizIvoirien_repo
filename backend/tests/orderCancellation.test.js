const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

async function createProduct(shopId, stock = 20) {
  return prisma.product.create({
    data: { shopId, name: 'Riz test annulation', slug: `riz-cancel-${Date.now()}-${Math.random()}`, category: 'Riz', price: 5000, stock },
  })
}

async function createOrderWithStock(shop, product, { status = 'PENDING', quantity = 4, buyer } = {}) {
  await prisma.stockPosition.upsert({
    where: { productId: product.id },
    update: {},
    create: { productId: product.id, quantity: product.stock },
  })
  // Simule un décrément déjà effectué à la création de la commande (comme le
  // ferait POST /api/orders réellement) — le stock est déjà rendu inférieur.
  await prisma.product.update({ where: { id: product.id }, data: { stock: { decrement: quantity } } })
  await prisma.stockPosition.update({ where: { productId: product.id }, data: { quantity: { decrement: quantity } } })

  const order = await prisma.order.create({
    data: {
      buyerId: buyer.id, shopId: shop.id, status, total: 5000 * quantity, address: 'Adresse test',
      items: { create: [{ productId: product.id, quantity, price: 5000, name: product.name }] },
    },
  })
  return order
}

describe('LOT 4 — annulation acheteur (DELETE /api/orders/:id), désormais transactionnelle', () => {
  test('restocke via le Stock Engine, trace un mouvement RESTOCK lié à la commande', async () => {
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 20)
    const order = await createOrderWithStock(shop, product, { status: 'PENDING', quantity: 4, buyer })

    const positionBefore = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(positionBefore.quantity).toBe(16)

    const res = await request(app).delete(`/api/orders/${order.id}`).set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(200)

    const position = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    const refreshedProduct = await prisma.product.findUnique({ where: { id: product.id } })
    expect(position.quantity).toBe(20)
    expect(refreshedProduct.stock).toBe(20)

    const movement = await prisma.stockMovement.findFirst({ where: { productId: product.id, type: 'RESTOCK' } })
    expect(movement.quantity).toBe(4)
    expect(movement.sourceType).toBe('ORDER')
    expect(movement.sourceId).toBe(order.id)
  })
})

describe('LOT 4 — annulation commerciale (POST /api/commercial/orders/:id/cancel)', () => {
  test('restocke via le Stock Engine, transaction interactive', async () => {
    const admin = await createUser('ADMIN')
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 30)
    const order = await createOrderWithStock(shop, product, { status: 'PENDING_VALIDATION', quantity: 5, buyer })

    const res = await request(app).post(`/api/commercial/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ reason: 'Client injoignable' })
    expect(res.status).toBe(200)

    const position = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(position.quantity).toBe(30)

    const movement = await prisma.stockMovement.findFirst({ where: { productId: product.id, type: 'RESTOCK', sourceId: order.id } })
    expect(movement).toBeTruthy()
    expect(movement.reason).toContain('Client injoignable')

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(updatedOrder.status).toBe('CANCELLED')
  })
})

describe('LOT 4 — annulation admin générique (PUT /api/orders/:id/status), gap comblé', () => {
  test('status=CANCELLED restocke désormais (avant ce lot : aucun restockage)', async () => {
    const admin = await createUser('ADMIN')
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 50)
    const order = await createOrderWithStock(shop, product, { status: 'ESCALATED', quantity: 6, buyer })

    const res = await request(app).put(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ status: 'CANCELLED', note: 'Aucun livreur disponible' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CANCELLED')

    const position = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(position.quantity).toBe(50)

    const movement = await prisma.stockMovement.findFirst({ where: { productId: product.id, type: 'RESTOCK', sourceId: order.id } })
    expect(movement).toBeTruthy()
  })

  test('rejette un statut hors liste blanche', async () => {
    const admin = await createUser('ADMIN')
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 10)
    const order = await createOrderWithStock(shop, product, { status: 'PENDING', quantity: 2, buyer })

    const res = await request(app).put(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ status: 'N_IMPORTE_QUOI' })
    expect(res.status).toBe(400)
  })

  test('refuse d\'annuler une commande déjà annulée (pas de double restockage)', async () => {
    const admin = await createUser('ADMIN')
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 10)
    const order = await createOrderWithStock(shop, product, { status: 'CANCELLED', quantity: 2, buyer })

    const res = await request(app).put(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ status: 'CANCELLED' })
    expect(res.status).toBe(400)

    const position = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(position.quantity).toBe(8) // inchangé — aucun restock appliqué deux fois
  })

  test('refuse d\'annuler une commande déjà livrée via cette route', async () => {
    const admin = await createUser('ADMIN')
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 10)
    const order = await createOrderWithStock(shop, product, { status: 'DELIVERED', quantity: 2, buyer })

    const res = await request(app).put(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ status: 'CANCELLED' })
    expect(res.status).toBe(400)
  })

  test('les transitions normales (non-CANCELLED) restent inchangées et ne touchent pas le stock', async () => {
    const buyer = await createUser('BUYER')
    const { user: sellerUser, shop } = await createShopUser()
    const product = await createProduct(shop.id, 10)
    const order = await createOrderWithStock(shop, product, { status: 'CONFIRMED', quantity: 2, buyer })

    const res = await request(app).put(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${signToken(sellerUser)}`).send({})
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('EN_PREPARATION')

    const position = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(position.quantity).toBe(8) // inchangé
  })
})
