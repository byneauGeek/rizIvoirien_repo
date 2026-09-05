const request = require('supertest')
const app = require('../src/index')
const { prisma, createShopUser, signToken } = require('./helpers')

describe('LOT 6 — POST /api/products/:id/inventory-count', () => {
  test('un écart négatif est calculé et tracé (INVENTORY_ADJUSTMENT)', async () => {
    const { user } = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz inventaire 1', category: 'Riz', price: 5000, stock: 100 })

    const res = await request(app).post(`/api/products/${created.body.id}/inventory-count`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ countedQuantity: 92, reason: 'Comptage mensuel entrepôt' })
    expect(res.status).toBe(201)
    expect(res.body.delta).toBe(-8)
    expect(res.body.position.quantity).toBe(92)
    expect(res.body.movement.type).toBe('INVENTORY_ADJUSTMENT')
    expect(res.body.movement.sourceType).toBe('INVENTORY')

    const refreshed = await prisma.product.findUnique({ where: { id: created.body.id } })
    expect(refreshed.stock).toBe(92)
  })

  test('un écart positif (stock retrouvé) est aussi accepté', async () => {
    const { user } = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz inventaire 2', category: 'Riz', price: 5000, stock: 10 })

    const res = await request(app).post(`/api/products/${created.body.id}/inventory-count`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ countedQuantity: 14 })
    expect(res.status).toBe(201)
    expect(res.body.delta).toBe(4)
    expect(res.body.position.quantity).toBe(14)
  })

  test('aucun écart : aucun mouvement créé', async () => {
    const { user } = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz inventaire 3', category: 'Riz', price: 5000, stock: 25 })

    const res = await request(app).post(`/api/products/${created.body.id}/inventory-count`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ countedQuantity: 25 })
    expect(res.status).toBe(201)
    expect(res.body.delta).toBe(0)
    expect(res.body.movement).toBeNull()

    const movements = await prisma.stockMovement.findMany({ where: { productId: created.body.id, type: 'INVENTORY_ADJUSTMENT' } })
    expect(movements).toHaveLength(0)
  })

  test('rejette une quantité comptée négative ou non entière', async () => {
    const { user } = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz inventaire 4', category: 'Riz', price: 5000, stock: 10 })

    const negative = await request(app).post(`/api/products/${created.body.id}/inventory-count`)
      .set('Authorization', `Bearer ${signToken(user)}`).send({ countedQuantity: -1 })
    expect(negative.status).toBe(400)

    const nonInteger = await request(app).post(`/api/products/${created.body.id}/inventory-count`)
      .set('Authorization', `Bearer ${signToken(user)}`).send({ countedQuantity: 4.5 })
    expect(nonInteger.status).toBe(400)
  })

  test('un vendeur ne peut pas compter l\'inventaire du produit d\'un autre', async () => {
    const sellerA = await createShopUser()
    const sellerB = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(sellerA.user)}`)
      .send({ name: 'Riz A inventaire', category: 'Riz', price: 5000, stock: 10 })

    const res = await request(app).post(`/api/products/${created.body.id}/inventory-count`)
      .set('Authorization', `Bearer ${signToken(sellerB.user)}`)
      .send({ countedQuantity: 5 })
    expect(res.status).toBe(404)
  })
})
