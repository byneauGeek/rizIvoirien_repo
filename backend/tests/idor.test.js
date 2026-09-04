const request = require('supertest')
const app = require('../src/index')
const { createShopUser, signToken, prisma } = require('./helpers')

describe('Mass-assignment fix — PUT /api/products/:id', () => {
  test('un vendeur ne peut pas réassigner son produit à une autre boutique via shopId', async () => {
    const seller1 = await createShopUser()
    const seller2 = await createShopUser()

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${signToken(seller1.user)}`)
      .send({ name: 'Riz parfumé', category: 'Riz', price: 6000, stock: 10 })
    expect(created.status).toBe(201)
    expect(created.body.shopId).toBe(seller1.shop.id)

    const updated = await request(app)
      .put(`/api/products/${created.body.id}`)
      .set('Authorization', `Bearer ${signToken(seller1.user)}`)
      .send({ name: 'Riz renommé', shopId: seller2.shop.id, rating: 5, reviewCount: 9999 })

    expect(updated.status).toBe(200)
    expect(updated.body.name).toBe('Riz renommé') // le champ autorisé est bien appliqué
    expect(updated.body.shopId).toBe(seller1.shop.id) // shopId ignoré, pas piraté
    expect(updated.body.reviewCount).toBe(0) // reviewCount ignoré (valeur par défaut)

    const inDb = await prisma.product.findUnique({ where: { id: created.body.id } })
    expect(inDb.shopId).toBe(seller1.shop.id)
  })

  test('un prix négatif ou nul est rejeté à la création', async () => {
    const seller = await createShopUser()
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${signToken(seller.user)}`)
      .send({ name: 'Riz gratuit', category: 'Riz', price: -100 })
    expect(res.status).toBe(400)
  })

  test('un prix négatif est rejeté à la mise à jour', async () => {
    const seller = await createShopUser()
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${signToken(seller.user)}`)
      .send({ name: 'Riz test prix', category: 'Riz', price: 5000 })

    const res = await request(app)
      .put(`/api/products/${created.body.id}`)
      .set('Authorization', `Bearer ${signToken(seller.user)}`)
      .send({ price: -1 })
    expect(res.status).toBe(400)
  })
})
