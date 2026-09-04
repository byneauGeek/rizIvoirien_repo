const request = require('supertest')
const app = require('../src/index')
const { createUser, createShopUser, createDriverUser, signToken, prisma } = require('./helpers')

describe('Concurrence — acceptation d\'offre de livraison', () => {
  test('deux acceptations simultanées de la même offre → une seule réussit (fix transaction atomique)', async () => {
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const { user: driverUser, driver } = await createDriverUser()

    const product = await prisma.product.create({
      data: { shopId: shop.id, name: 'Riz concurrence', slug: `riz-conc-${Date.now()}`, category: 'Riz', price: 5000, stock: 50 },
    })

    const order = await prisma.order.create({
      data: {
        buyerId: buyer.id,
        shopId: shop.id,
        total: 5000,
        address: '123 rue Test, Abidjan',
        items: { create: [{ productId: product.id, quantity: 1, price: 5000, name: product.name }] },
      },
    })

    const offer = await prisma.driverOffer.create({
      data: {
        orderId: order.id,
        driverId: driver.id,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
      },
    })

    const token = signToken(driverUser)
    const [res1, res2] = await Promise.all([
      request(app).post(`/api/drivers/offers/${offer.id}/accept`).set('Authorization', `Bearer ${token}`),
      request(app).post(`/api/drivers/offers/${offer.id}/accept`).set('Authorization', `Bearer ${token}`),
    ])

    const statuses = [res1.status, res2.status].sort()
    // L'un des deux doit réussir (200), l'autre doit être rejeté (409 conflit, ou 404 si déjà
    // repassé PENDING→ACCEPTED avant son propre findFirst) — jamais les deux à 200.
    const successCount = [res1.status, res2.status].filter((s) => s === 200).length
    expect(successCount).toBe(1)
    expect(statuses.every((s) => [200, 404, 409].includes(s))).toBe(true)

    const finalOffer = await prisma.driverOffer.findUnique({ where: { id: offer.id } })
    expect(finalOffer.status).toBe('ACCEPTED')

    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(finalOrder.driverId).toBe(driver.id)
  })
})
