// LOT INTEGRITE-COMPTABLE (phase 1 post-audit) : GET /admin/finance
// recalculait la commission de tout l'historique avec le taux PLAT actuel,
// ignorant le plan de la boutique et toute évolution future du taux.
// Order.appliedCommissionRate fige maintenant le taux réellement applicable
// à CHAQUE commande, au moment de sa création.
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, signToken } = require('./helpers')

async function placeOrder(buyer, seller, shop, overrides = {}) {
  const product = await request(app).post('/api/products')
    .set('Authorization', `Bearer ${signToken(seller)}`)
    .send({ name: `Riz ${Date.now()}-${Math.random()}`, category: 'Riz local', price: 10000, stock: 10 })
  const order = await request(app).post('/api/orders')
    .set('Authorization', `Bearer ${signToken(buyer)}`)
    .send({ items: [{ productId: product.body.id, quantity: 1 }], address: 'Adresse test' })
  return prisma.order.update({ where: { id: order.body.id }, data: { status: 'DELIVERED', ...overrides } })
}

describe('Order.appliedCommissionRate — figé à la création selon le plan de la boutique', () => {
  test('boutique BASIC : taux plat ; boutique CERTIFIÉE : taux réduit', async () => {
    await prisma.platformSettings.upsert({
      where: { id: 1 }, create: { id: 1, commissionRate: 0.05, certifiedCommissionRate: 0.03 },
      update: { commissionRate: 0.05, certifiedCommissionRate: 0.03 },
    })
    const buyer = await createUser('BUYER')
    const { user: basicSeller, shop: basicShop } = await createShopUser()
    const { user: certifiedSeller, shop: certifiedShop } = await createShopUser()
    await prisma.shop.update({ where: { id: certifiedShop.id }, data: { plan: 'CERTIFIED' } })

    const basicOrder = await placeOrder(buyer, basicSeller, basicShop)
    const certifiedOrder = await placeOrder(buyer, certifiedSeller, certifiedShop)

    expect(basicOrder.appliedCommissionRate).toBe(0.05)
    expect(certifiedOrder.appliedCommissionRate).toBe(0.03)
  })

  test('un changement de plan APRÈS coup ne modifie jamais le taux déjà figé sur une commande existante', async () => {
    await prisma.platformSettings.upsert({ where: { id: 1 }, update: { commissionRate: 0.05, certifiedCommissionRate: 0.03 }, create: { id: 1 } })
    const buyer = await createUser('BUYER')
    const { user: seller, shop } = await createShopUser()

    const order = await placeOrder(buyer, seller, shop)
    expect(order.appliedCommissionRate).toBe(0.05)

    await prisma.shop.update({ where: { id: shop.id }, data: { plan: 'CERTIFIED' } })
    const unchanged = await prisma.order.findUnique({ where: { id: order.id } })
    expect(unchanged.appliedCommissionRate).toBe(0.05)
  })
})

describe('GET /admin/finance — commission pondérée par commande', () => {
  test('une nouvelle commande CERTIFIÉE augmente platformCommission de exactement total * 0.03, pas total * taux plat', async () => {
    await prisma.platformSettings.upsert({
      where: { id: 1 }, create: { id: 1, commissionRate: 0.05, certifiedCommissionRate: 0.03 },
      update: { commissionRate: 0.05, certifiedCommissionRate: 0.03 },
    })
    const admin = await createUser('ADMIN')
    const before = await request(app).get('/api/admin/finance').set('Authorization', `Bearer ${signToken(admin)}`)

    const buyer = await createUser('BUYER')
    const { user: seller, shop } = await createShopUser()
    await prisma.shop.update({ where: { id: shop.id }, data: { plan: 'CERTIFIED' } })
    await placeOrder(buyer, seller, shop) // total = 10000

    const after = await request(app).get('/api/admin/finance').set('Authorization', `Bearer ${signToken(admin)}`)
    const delta = after.body.platformCommission - before.body.platformCommission
    // Avant ce lot, le delta aurait été 10000 * 0.05 = 500 (taux plat, boutique ignorée).
    expect(delta).toBe(Math.round(10000 * 0.03))
  })

  test('une commande antérieure à ce lot (appliedCommissionRate=null) retombe sur le taux plat actuel', async () => {
    await prisma.platformSettings.upsert({ where: { id: 1 }, update: { commissionRate: 0.05 }, create: { id: 1, commissionRate: 0.05 } })
    const admin = await createUser('ADMIN')
    const before = await request(app).get('/api/admin/finance').set('Authorization', `Bearer ${signToken(admin)}`)

    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    await prisma.order.create({
      data: { buyerId: buyer.id, shopId: shop.id, status: 'DELIVERED', total: 8000, deliveryFee: 0, address: 'A', appliedCommissionRate: null },
    })

    const after = await request(app).get('/api/admin/finance').set('Authorization', `Bearer ${signToken(admin)}`)
    const delta = after.body.platformCommission - before.body.platformCommission
    expect(delta).toBe(Math.round(8000 * 0.05))
  })
})
