// LOT PLANS (retour utilisateur) — jamais testé depuis sa livraison. Couvre
// les 3 restrictions BASIC/CERTIFIÉ ajoutées à ce lot (limite de produits,
// zone de livraison unique, boost de recherche certifié) ainsi que la
// restriction analytics préexistante (configurable via PlatformSettings).
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, signToken } = require('./helpers')

async function createProduct(seller, overrides = {}) {
  return request(app).post('/api/products')
    .set('Authorization', `Bearer ${signToken(seller)}`)
    .send({ name: `Riz ${Date.now()}-${Math.random()}`, category: 'Riz Parfumé', price: 2500, stock: 10, ...overrides })
}

describe('Limite de produits actifs (plan BASIC)', () => {
  test('un vendeur BASIC est bloqué à basicMaxProducts, un CERTIFIÉ ne l\'est jamais', async () => {
    await prisma.platformSettings.upsert({ where: { id: 1 }, update: { basicMaxProducts: 2 }, create: { id: 1, basicMaxProducts: 2 } })
    const { user: seller, shop } = await createShopUser()
    expect(shop.plan).toBe('BASIC')

    const first = await createProduct(seller)
    const second = await createProduct(seller)
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)

    const third = await createProduct(seller)
    expect(third.status).toBe(403)
    expect(third.body.code).toBe('PRODUCT_LIMIT_REACHED')

    await prisma.shop.update({ where: { id: shop.id }, data: { plan: 'CERTIFIED' } })
    const fourth = await createProduct(seller)
    expect(fourth.status).toBe(201)
  })

  test('basicMaxProducts = 0 désactive la limite (pas de blocage)', async () => {
    await prisma.platformSettings.upsert({ where: { id: 1 }, update: { basicMaxProducts: 0 }, create: { id: 1, basicMaxProducts: 0 } })
    const { user: seller } = await createShopUser()
    const res = await createProduct(seller)
    expect(res.status).toBe(201)
  })
})

describe('Zones de livraison (plan BASIC = 1 seule, CERTIFIÉ = plusieurs)', () => {
  test('un BASIC ne peut pas déclarer plus d\'une zone', async () => {
    const { user: seller } = await createShopUser()
    const single = await request(app).put('/api/shops/my').set('Authorization', `Bearer ${signToken(seller)}`)
      .send({ deliveryZones: 'Cocody' })
    expect(single.status).toBe(200)

    const multiple = await request(app).put('/api/shops/my').set('Authorization', `Bearer ${signToken(seller)}`)
      .send({ deliveryZones: 'Cocody, Yopougon' })
    expect(multiple.status).toBe(403)
    expect(multiple.body.code).toBe('PLAN_RESTRICTION')
  })

  test('un CERTIFIÉ peut déclarer plusieurs zones', async () => {
    const { user: seller, shop } = await createShopUser()
    await prisma.shop.update({ where: { id: shop.id }, data: { plan: 'CERTIFIED' } })

    const res = await request(app).put('/api/shops/my').set('Authorization', `Bearer ${signToken(seller)}`)
      .send({ deliveryZones: 'Cocody, Yopougon, Marcory' })
    expect(res.status).toBe(200)
    expect(res.body.deliveryZones).toBe('Cocody, Yopougon, Marcory')
  })
})

describe('Boost de recherche produit pour les boutiques certifiées', () => {
  test('les produits d\'une boutique certifiée passent toujours devant, quel que soit le tri secondaire', async () => {
    const { user: basicSeller } = await createShopUser({ shopName: 'Boutique Basique' })
    const { user: certifiedSeller, shop: certifiedShop } = await createShopUser({ shopName: 'Boutique Certifiee' })
    await prisma.shop.update({ where: { id: certifiedShop.id }, data: { plan: 'CERTIFIED', certified: true } })

    // Prix délibérément défavorable au tri "price_asc" pour la boutique
    // certifiée — si le boost ne fonctionnait pas, elle apparaîtrait après.
    await createProduct(basicSeller, { name: 'Riz Basique', price: 1000 })
    await createProduct(certifiedSeller, { name: 'Riz Certifie', price: 9000 })

    // limit élevé : la base de test est partagée par tout le fichier de tests
    // (aucune réinitialisation entre fichiers) — d'autres tests peuvent avoir
    // créé des dizaines de produits avant celui-ci, le défaut take=20
    // pourrait exclure nos deux produits de la première page.
    const res = await request(app).get('/api/products?sort=price_asc&limit=200')
    expect(res.status).toBe(200)
    const names = res.body.products.map(p => p.name)
    expect(names.indexOf('Riz Certifie')).toBeLessThan(names.indexOf('Riz Basique'))
  })
})

describe('Analytiques vendeur réservées (configurable, basicCanAnalytics)', () => {
  test('basicCanAnalytics=false bloque un vendeur BASIC, jamais un CERTIFIÉ', async () => {
    await prisma.platformSettings.upsert({ where: { id: 1 }, update: { basicCanAnalytics: false }, create: { id: 1, basicCanAnalytics: false } })
    const { user: basicSeller } = await createShopUser()
    const blocked = await request(app).get('/api/shops/my/analytics').set('Authorization', `Bearer ${signToken(basicSeller)}`)
    expect(blocked.status).toBe(403)
    expect(blocked.body.code).toBe('PLAN_RESTRICTION')

    const { user: certifiedSeller, shop: certifiedShop } = await createShopUser()
    await prisma.shop.update({ where: { id: certifiedShop.id }, data: { plan: 'CERTIFIED' } })
    const allowed = await request(app).get('/api/shops/my/analytics').set('Authorization', `Bearer ${signToken(certifiedSeller)}`)
    expect(allowed.status).toBe(200)
  })

  test('basicCanAnalytics=true (défaut) : un BASIC y a accès aussi', async () => {
    await prisma.platformSettings.upsert({ where: { id: 1 }, update: { basicCanAnalytics: true }, create: { id: 1, basicCanAnalytics: true } })
    const { user: seller } = await createShopUser()
    const res = await request(app).get('/api/shops/my/analytics').set('Authorization', `Bearer ${signToken(seller)}`)
    expect(res.status).toBe(200)
  })
})
