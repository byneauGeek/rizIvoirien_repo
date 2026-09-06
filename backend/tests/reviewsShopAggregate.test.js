// LOT REVIEW-4 (audit XXX RIZ) : couvre le nouvel endpoint GET /reviews/shop/:shopId
// (agrégation des avis PRODUIT par boutique — LOT REVIEW-1, la correction du
// bug "le vendeur ne voit pas les avis client") ainsi que les notifications
// NEW_REVIEW ajoutées en LOT REVIEW-3 sur POST /reviews et POST /shop-reviews.
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, signToken, uniqueEmail } = require('./helpers')

async function createProduct(shopId, overrides = {}) {
  return prisma.product.create({
    data: {
      shopId,
      name: overrides.name || 'Riz test',
      slug: `riz-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      category: 'Riz',
      price: 2500,
      ...overrides,
    },
  })
}

async function createDeliveredOrder(buyerId, shop, product) {
  return prisma.order.create({
    data: {
      buyerId,
      shopId: shop.id,
      status: 'DELIVERED',
      total: product.price,
      address: 'Adresse test',
      items: { create: [{ productId: product.id, quantity: 1, price: product.price, name: product.name }] },
    },
  })
}

describe('LOT REVIEW-4 — GET /reviews/shop/:shopId', () => {
  test('agrège les avis produit de toute la boutique, réservé au propriétaire', async () => {
    const { user: seller, shop } = await createShopUser()
    const productA = await createProduct(shop.id, { name: 'Riz A' })
    const productB = await createProduct(shop.id, { name: 'Riz B' })

    const buyer1 = await createUser('BUYER')
    const buyer2 = await createUser('BUYER')
    const order1 = await createDeliveredOrder(buyer1.id, shop, productA)
    const order2 = await createDeliveredOrder(buyer2.id, shop, productB)

    await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${signToken(buyer1)}`)
      .send({ productId: productA.id, rating: 5, comment: 'Excellent', orderId: order1.id })
    await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${signToken(buyer2)}`)
      .send({ productId: productB.id, rating: 3, comment: 'Correct', orderId: order2.id })

    const res = await request(app).get(`/api/reviews/shop/${shop.id}`)
      .set('Authorization', `Bearer ${signToken(seller)}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(2)
    expect(res.body.avg).toBe(4)
    const productNames = res.body.reviews.map(r => r.product.name).sort()
    expect(productNames).toEqual(['Riz A', 'Riz B'])
  })

  test('403 pour un autre vendeur que le propriétaire de la boutique', async () => {
    const { shop } = await createShopUser()
    const otherSeller = await createUser('SELLER')

    const res = await request(app).get(`/api/reviews/shop/${shop.id}`)
      .set('Authorization', `Bearer ${signToken(otherSeller)}`)
    expect(res.status).toBe(403)
  })

  test('200 pour un admin même non propriétaire', async () => {
    const { shop } = await createShopUser()
    const admin = await createUser('ADMIN')

    const res = await request(app).get(`/api/reviews/shop/${shop.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
  })

  test('404 si la boutique n\'existe pas', async () => {
    const seller = await createUser('SELLER')
    const res = await request(app).get('/api/reviews/shop/999999')
      .set('Authorization', `Bearer ${signToken(seller)}`)
    expect(res.status).toBe(404)
  })
})

describe('LOT REVIEW-4 — notification NEW_REVIEW', () => {
  test('POST /reviews (avis produit) notifie le vendeur propriétaire', async () => {
    const { user: seller, shop } = await createShopUser()
    const product = await createProduct(shop.id)
    const buyer = await createUser('BUYER')
    const order = await createDeliveredOrder(buyer.id, shop, product)

    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ productId: product.id, rating: 5, comment: 'Top', orderId: order.id })
    expect(res.status).toBe(201)

    const notif = await prisma.notification.findFirst({ where: { userId: seller.id, type: 'NEW_REVIEW' } })
    expect(notif).toBeTruthy()
    expect(notif.message).toMatch(/5★/)
    expect(notif.message).toContain(product.name)
  })

  test('POST /shop-reviews (avis boutique) notifie le vendeur propriétaire', async () => {
    const { user: seller, shop } = await createShopUser()
    const product = await createProduct(shop.id)
    const buyer = await createUser('BUYER')
    const order = await createDeliveredOrder(buyer.id, shop, product)

    const res = await request(app).post('/api/shop-reviews')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ shopId: shop.id, orderId: order.id, rating: 4, comment: 'Bonne boutique' })
    expect(res.status).toBe(201)

    const notif = await prisma.notification.findFirst({ where: { userId: seller.id, type: 'NEW_REVIEW' } })
    expect(notif).toBeTruthy()
    expect(notif.message).toMatch(/4★/)
  })
})
