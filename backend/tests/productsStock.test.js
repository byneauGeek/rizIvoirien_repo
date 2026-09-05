const request = require('supertest')
const app = require('../src/index')
const { prisma, createShopUser, signToken } = require('./helpers')

describe('LOT 5 — création de produit initialise le stock via le Stock Engine', () => {
  test('POST /api/products : stock initial tracé comme INITIAL_STOCK, pas une écriture directe', async () => {
    const { user, shop } = await createShopUser()

    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz LOT5', category: 'Riz', price: 5000, stock: 40 })
    expect(res.status).toBe(201)
    expect(res.body.stock).toBe(40)

    const position = await prisma.stockPosition.findUnique({ where: { productId: res.body.id } })
    expect(position.quantity).toBe(40)

    const movement = await prisma.stockMovement.findFirst({ where: { productId: res.body.id, type: 'INITIAL_STOCK' } })
    expect(movement).toBeTruthy()
    expect(movement.quantityAfter).toBe(40)
    expect(movement.sourceType).toBe('MANUAL')
  })

  test('stock initial à 0 : position créée, aucun mouvement à tracer', async () => {
    const { user, shop } = await createShopUser()
    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz LOT5 zéro', category: 'Riz', price: 5000 })
    expect(res.status).toBe(201)
    expect(res.body.stock).toBe(0)

    const position = await prisma.stockPosition.findUnique({ where: { productId: res.body.id } })
    expect(position.quantity).toBe(0)
    const movements = await prisma.stockMovement.findMany({ where: { productId: res.body.id } })
    expect(movements).toHaveLength(0)
  })
})

describe('LOT 5 — PUT /api/products/:id n\'accepte plus de modifier le stock', () => {
  test('un champ stock envoyé est silencieusement ignoré', async () => {
    const { user, shop } = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz PUT test', category: 'Riz', price: 5000, stock: 15 })

    const updated = await request(app).put(`/api/products/${created.body.id}`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz PUT renommé', stock: 9999 })
    expect(updated.status).toBe(200)
    expect(updated.body.name).toBe('Riz PUT renommé')
    expect(updated.body.stock).toBe(15) // inchangé malgré la tentative

    const position = await prisma.stockPosition.findUnique({ where: { productId: created.body.id } })
    expect(position.quantity).toBe(15)
  })
})

describe('LOT 5 — POST /api/products/:id/adjust-stock', () => {
  test('RECEPTION augmente le stock, motif obligatoire', async () => {
    const { user, shop } = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz réception', category: 'Riz', price: 5000, stock: 10 })

    const noReason = await request(app).post(`/api/products/${created.body.id}/adjust-stock`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ type: 'RECEPTION', quantity: 20 })
    expect(noReason.status).toBe(400)

    const res = await request(app).post(`/api/products/${created.body.id}/adjust-stock`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ type: 'RECEPTION', quantity: 20, reason: 'Livraison fournisseur' })
    expect(res.status).toBe(201)
    expect(res.body.position.quantity).toBe(30)

    const refreshed = await prisma.product.findUnique({ where: { id: created.body.id } })
    expect(refreshed.stock).toBe(30)
  })

  test('LOSS diminue le stock, rejette si insuffisant', async () => {
    const { user, shop } = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz perte', category: 'Riz', price: 5000, stock: 5 })

    const tooMuch = await request(app).post(`/api/products/${created.body.id}/adjust-stock`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ type: 'LOSS', quantity: 10, reason: 'Sacs endommagés' })
    expect(tooMuch.status).toBe(400)

    const res = await request(app).post(`/api/products/${created.body.id}/adjust-stock`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ type: 'LOSS', quantity: 3, reason: 'Sacs endommagés par une fuite' })
    expect(res.status).toBe(201)
    expect(res.body.position.quantity).toBe(2)
    expect(res.body.movement.type).toBe('LOSS')
  })

  test('ADJUSTMENT accepte un delta signé (correction d\'erreur de saisie)', async () => {
    const { user, shop } = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz correction', category: 'Riz', price: 5000, stock: 50 })

    const res = await request(app).post(`/api/products/${created.body.id}/adjust-stock`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ type: 'ADJUSTMENT', quantity: -8, reason: 'Erreur de comptage à la création' })
    expect(res.status).toBe(201)
    expect(res.body.position.quantity).toBe(42)
    expect(res.body.movement.type).toBe('ADJUSTMENT')
    expect(res.body.movement.quantity).toBe(-8)
  })

  test('un vendeur ne peut pas ajuster le stock du produit d\'un autre', async () => {
    const sellerA = await createShopUser()
    const sellerB = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(sellerA.user)}`)
      .send({ name: 'Riz A', category: 'Riz', price: 5000, stock: 10 })

    const res = await request(app).post(`/api/products/${created.body.id}/adjust-stock`)
      .set('Authorization', `Bearer ${signToken(sellerB.user)}`)
      .send({ type: 'RECEPTION', quantity: 5, reason: 'x' })
    expect(res.status).toBe(404)
  })

  test('type invalide rejeté', async () => {
    const { user, shop } = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz type invalide', category: 'Riz', price: 5000, stock: 10 })

    const res = await request(app).post(`/api/products/${created.body.id}/adjust-stock`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ type: 'SALE', quantity: 5, reason: 'x' })
    expect(res.status).toBe(400)
  })
})

describe('LOT 5 — GET /api/products/:id/stock-movements', () => {
  test('retourne l\'historique dans l\'ordre chronologique inverse', async () => {
    const { user, shop } = await createShopUser()
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ name: 'Riz historique', category: 'Riz', price: 5000, stock: 10 })

    await request(app).post(`/api/products/${created.body.id}/adjust-stock`)
      .set('Authorization', `Bearer ${signToken(user)}`).send({ type: 'RECEPTION', quantity: 5, reason: 'Livraison 1' })
    await request(app).post(`/api/products/${created.body.id}/adjust-stock`)
      .set('Authorization', `Bearer ${signToken(user)}`).send({ type: 'LOSS', quantity: 2, reason: 'Casse' })

    const res = await request(app).get(`/api/products/${created.body.id}/stock-movements`)
      .set('Authorization', `Bearer ${signToken(user)}`)
    expect(res.status).toBe(200)
    expect(res.body.movements).toHaveLength(3) // INITIAL_STOCK + RECEPTION + LOSS
    expect(res.body.movements[0].type).toBe('LOSS') // le plus récent en premier
  })
})
