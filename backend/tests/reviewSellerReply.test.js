// LOT REVIEW-REPLY (retour utilisateur — phase 2) : un avis client était à
// sens unique jusqu'ici, aucun moyen pour le vendeur d'y répondre.
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, signToken } = require('./helpers')

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

async function createReview(shop, product, buyer, order) {
  const res = await request(app).post('/api/reviews')
    .set('Authorization', `Bearer ${signToken(buyer)}`)
    .send({ productId: product.id, rating: 5, comment: 'Top', orderId: order.id })
  return res.body
}

describe('POST /reviews/:id/reply', () => {
  test('le propriétaire de la boutique peut répondre', async () => {
    const { user: seller, shop } = await createShopUser()
    const product = await createProduct(shop.id)
    const buyer = await createUser('BUYER')
    const order = await createDeliveredOrder(buyer.id, shop, product)
    const review = await createReview(shop, product, buyer, order)

    const res = await request(app).post(`/api/reviews/${review.id}/reply`)
      .set('Authorization', `Bearer ${signToken(seller)}`)
      .send({ reply: 'Merci pour votre retour !' })
    expect(res.status).toBe(200)
    expect(res.body.sellerReply).toBe('Merci pour votre retour !')
    expect(res.body.sellerRepliedAt).toBeTruthy()

    // Visible publiquement sur la fiche produit.
    const publicView = await request(app).get(`/api/reviews/product/${product.id}`)
    expect(publicView.body.reviews[0].sellerReply).toBe('Merci pour votre retour !')
  })

  test('ré-éditable : une deuxième réponse écrase la première', async () => {
    const { user: seller, shop } = await createShopUser()
    const product = await createProduct(shop.id)
    const buyer = await createUser('BUYER')
    const order = await createDeliveredOrder(buyer.id, shop, product)
    const review = await createReview(shop, product, buyer, order)

    await request(app).post(`/api/reviews/${review.id}/reply`)
      .set('Authorization', `Bearer ${signToken(seller)}`).send({ reply: 'Première réponse' })
    const second = await request(app).post(`/api/reviews/${review.id}/reply`)
      .set('Authorization', `Bearer ${signToken(seller)}`).send({ reply: 'Réponse corrigée' })
    expect(second.body.sellerReply).toBe('Réponse corrigée')
  })

  test('403 pour un autre vendeur que le propriétaire de la boutique', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id)
    const buyer = await createUser('BUYER')
    const order = await createDeliveredOrder(buyer.id, shop, product)
    const review = await createReview(shop, product, buyer, order)

    const otherSeller = await createUser('SELLER')
    const res = await request(app).post(`/api/reviews/${review.id}/reply`)
      .set('Authorization', `Bearer ${signToken(otherSeller)}`)
      .send({ reply: 'Je réponds à votre place' })
    expect(res.status).toBe(403)
  })

  test('un acheteur ne peut pas répondre', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id)
    const buyer = await createUser('BUYER')
    const order = await createDeliveredOrder(buyer.id, shop, product)
    const review = await createReview(shop, product, buyer, order)

    const res = await request(app).post(`/api/reviews/${review.id}/reply`)
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ reply: 'Je réponds à mon propre avis' })
    expect(res.status).toBe(403)
  })

  test('réponse vide rejetée, 404 sur avis inexistant', async () => {
    const { user: seller } = await createShopUser()
    const empty = await request(app).post('/api/reviews/999999/reply')
      .set('Authorization', `Bearer ${signToken(seller)}`).send({ reply: '' })
    expect(empty.status).toBe(400)

    const notFound = await request(app).post('/api/reviews/999999/reply')
      .set('Authorization', `Bearer ${signToken(seller)}`).send({ reply: 'Réponse' })
    expect(notFound.status).toBe(404)
  })

  test('notifie l\'acheteur auteur de l\'avis', async () => {
    const { user: seller, shop } = await createShopUser()
    const product = await createProduct(shop.id)
    const buyer = await createUser('BUYER')
    const order = await createDeliveredOrder(buyer.id, shop, product)
    const review = await createReview(shop, product, buyer, order)

    await request(app).post(`/api/reviews/${review.id}/reply`)
      .set('Authorization', `Bearer ${signToken(seller)}`).send({ reply: 'Merci !' })

    const notif = await prisma.notification.findFirst({ where: { userId: buyer.id, type: 'REVIEW_REPLY' } })
    expect(notif).toBeTruthy()
  })
})
