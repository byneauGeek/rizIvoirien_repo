const request = require('supertest')
const https = require('https')
const app = require('../src/index')
const { prisma, createUser, createShopUser, signToken } = require('./helpers')
const pricingEngine = require('../src/services/pricingEngine')

// PricingRule n'a que 6 combinaisons possibles (segment x serviceLevel) : sans
// nettoyage entre tests, une règle créée par un test (notamment un joker,
// dont l'unicité n'est PAS garantie en base — NULL != NULL en SQL) pollue
// silencieusement tous les tests suivants qui réutilisent la même combinaison.
beforeEach(async () => {
  await prisma.pricingRule.deleteMany({})
})

describe('LOT 6 — moteur de tarification (pricingEngine.computePricing)', () => {
  let zoneA, zoneB

  beforeEach(async () => {
    zoneA = await prisma.zone.create({ data: { name: `ZoneA-${Date.now()}`, city: `Abidjan-${Date.now()}` } })
    zoneB = await prisma.zone.create({ data: { name: `ZoneB-${Date.now()}`, city: `Bouake-${Date.now()}` } })
  })

  test('aucune règle configurée pour ce segment/serviceLevel : retombe sur null (jamais une invention)', async () => {
    const result = await pricingEngine.computePricing(prisma, {
      segment: 'SMALL_MEDIUM', serviceLevel: 'EXPRESS', originZoneId: zoneA.id, destinationZoneId: zoneB.id, weightKg: 10, distanceKm: 5,
    })
    expect(result).toBeNull()
  })

  test('segment et serviceLevel ne se substituent jamais l\'un à l\'autre', async () => {
    await prisma.pricingRule.create({
      data: { segment: 'SMALL_MEDIUM', serviceLevel: 'STANDARD', basePrice: 1000, marginPct: 0.2 },
    })
    const wrongSegment = await pricingEngine.computePricing(prisma, {
      segment: 'B2B_CARGO', serviceLevel: 'STANDARD', originZoneId: null, destinationZoneId: null, weightKg: 10, distanceKm: 5,
    })
    const wrongServiceLevel = await pricingEngine.computePricing(prisma, {
      segment: 'SMALL_MEDIUM', serviceLevel: 'EXPRESS', originZoneId: null, destinationZoneId: null, weightKg: 10, distanceKm: 5,
    })
    expect(wrongSegment).toBeNull()
    expect(wrongServiceLevel).toBeNull()
  })

  test('priorité de repli : corridor exact > origine seule > destination seule > joker complet', async () => {
    const wildcard = await prisma.pricingRule.create({
      data: { segment: 'SMALL_MEDIUM', serviceLevel: 'STANDARD', basePrice: 100, marginPct: 0 },
    })
    const originOnly = await prisma.pricingRule.create({
      data: { segment: 'SMALL_MEDIUM', serviceLevel: 'STANDARD', originZoneId: zoneA.id, basePrice: 200, marginPct: 0 },
    })
    const exactCorridor = await prisma.pricingRule.create({
      data: { segment: 'SMALL_MEDIUM', serviceLevel: 'STANDARD', originZoneId: zoneA.id, destinationZoneId: zoneB.id, basePrice: 300, marginPct: 0 },
    })

    // Corridor exact A->B : la règle la plus spécifique gagne.
    const r1 = await pricingEngine.computePricing(prisma, { segment: 'SMALL_MEDIUM', serviceLevel: 'STANDARD', originZoneId: zoneA.id, destinationZoneId: zoneB.id, weightKg: 0, distanceKm: 0 })
    expect(r1.pricingRuleId).toBe(exactCorridor.id)

    // Origine A, destination inconnue : règle "origine seule" avant le joker.
    const r2 = await pricingEngine.computePricing(prisma, { segment: 'SMALL_MEDIUM', serviceLevel: 'STANDARD', originZoneId: zoneA.id, destinationZoneId: null, weightKg: 0, distanceKm: 0 })
    expect(r2.pricingRuleId).toBe(originOnly.id)

    // Ni origine ni destination connues : le joker complet.
    const r3 = await pricingEngine.computePricing(prisma, { segment: 'SMALL_MEDIUM', serviceLevel: 'STANDARD', originZoneId: null, destinationZoneId: null, weightKg: 0, distanceKm: 0 })
    expect(r3.pricingRuleId).toBe(wildcard.id)
  })

  test('sépare coût interne, prix client et marge — jamais un pourcentage direct du montant de la commande', async () => {
    await prisma.pricingRule.create({
      data: {
        segment: 'B2B_CARGO', serviceLevel: 'STANDARD', originZoneId: zoneA.id, destinationZoneId: zoneB.id,
        basePrice: 1000, pricePerKg: 10, pricePerKm: 50, marginPct: 0.25,
      },
    })
    const result = await pricingEngine.computePricing(prisma, {
      segment: 'B2B_CARGO', serviceLevel: 'STANDARD', originZoneId: zoneA.id, destinationZoneId: zoneB.id,
      weightKg: 100, distanceKm: 20,
    })
    // coût interne = 1000 + 100*10 + 20*50 = 3000
    expect(result.internalCost).toBe(3000)
    // prix client = 3000 * 1.25 = 3750
    expect(result.customerPrice).toBe(3750)
    expect(result.platformMargin).toBe(750)
  })

  test('marge négative = subvention plateforme assumée, pas une erreur', async () => {
    await prisma.pricingRule.create({
      data: { segment: 'SMALL_MEDIUM', serviceLevel: 'ECONOMIC', basePrice: 2000, marginPct: -0.5 },
    })
    const result = await pricingEngine.computePricing(prisma, {
      segment: 'SMALL_MEDIUM', serviceLevel: 'ECONOMIC', originZoneId: null, destinationZoneId: null, weightKg: 0, distanceKm: 0,
    })
    expect(result.internalCost).toBe(2000)
    expect(result.customerPrice).toBe(1000) // 2000 * 0.5
    expect(result.platformMargin).toBe(-1000)
  })

  test('maxDeliveryFee plafonne le prix client sans jamais plafonner le coût interne enregistré', async () => {
    await prisma.pricingRule.create({
      data: { segment: 'SMALL_MEDIUM', serviceLevel: 'EXPRESS', basePrice: 10000, marginPct: 0.5, maxDeliveryFee: 8000 },
    })
    const result = await pricingEngine.computePricing(prisma, {
      segment: 'SMALL_MEDIUM', serviceLevel: 'EXPRESS', originZoneId: null, destinationZoneId: null, weightKg: 0, distanceKm: 0,
    })
    expect(result.internalCost).toBe(10000) // jamais plafonné : c'est le coût réel
    expect(result.customerPrice).toBe(8000) // plafonné
    expect(result.platformMargin).toBe(-2000) // le plafond peut transformer une marge positive en subvention
  })
})

function mockGeocodeCity(cityName) {
  return jest.spyOn(https, 'get').mockImplementation((options, cb) => {
    const res = {
      on: (event, handler) => {
        if (event === 'data') handler(JSON.stringify([{ lat: '5.35', lon: '-4.02', address: { city: cityName } }]))
        if (event === 'end') handler()
      },
    }
    setImmediate(() => cb(res))
    return { on: () => {}, setTimeout: () => {}, destroy: () => {} }
  })
}

describe('LOT 6 — intégration B2C (POST /api/orders/estimate-delivery, POST /api/orders)', () => {
  test('un corridor configuré remplace le forfait legacy et la commande garde la décomposition', async () => {
    const cityTag = `VilleTest${Date.now()}`
    const originZone = await prisma.zone.create({ data: { name: `OrigineTest${Date.now()}`, city: `OrigineVille${Date.now()}` } })
    const destZone = await prisma.zone.create({ data: { name: `DestTest${Date.now()}`, city: cityTag } })

    const { user: sellerUser, shop } = await createShopUser()
    await prisma.shop.update({ where: { id: shop.id }, data: { zoneId: originZone.id, latitude: 5.3, longitude: -4.0 } })
    const product = await prisma.product.create({ data: { shopId: shop.id, name: 'Riz pricing', slug: `riz-pricing-${Date.now()}`, category: 'Riz', price: 5000, stock: 50, active: true, unit: '10kg' } })

    await prisma.pricingRule.create({
      data: {
        segment: 'SMALL_MEDIUM', serviceLevel: 'STANDARD', originZoneId: originZone.id, destinationZoneId: destZone.id,
        basePrice: 1500, pricePerKg: 5, pricePerKm: 0, marginPct: 0.1,
      },
    })

    const getSpy = mockGeocodeCity(cityTag)
    const buyer = await createUser('BUYER')
    try {
      const est = await request(app).post('/api/orders/estimate-delivery')
        .set('Authorization', `Bearer ${signToken(buyer)}`)
        .send({ items: [{ productId: product.id, quantity: 2 }], address: 'Adresse test pricing' })

      // poids = 2 * 10kg = 20kg ; coût interne = 1500 + 20*5 = 1600 ; prix client = 1600*1.1 = 1760
      expect(est.body.internalCost).toBe(1600)
      expect(est.body.platformMargin).toBe(160)
      expect(est.body.deliveryFee).toBe(1760)

      const orderRes = await request(app).post('/api/orders')
        .set('Authorization', `Bearer ${signToken(buyer)}`)
        .send({ items: [{ productId: product.id, quantity: 2 }], address: 'Adresse test pricing', serviceLevel: 'STANDARD' })
      expect(orderRes.status).toBe(201)

      const order = await prisma.order.findUnique({ where: { id: orderRes.body.id } })
      expect(order.deliveryFee).toBe(1760)
      expect(order.deliveryInternalCost).toBe(1600)
      expect(order.deliveryMargin).toBe(160)
      expect(order.serviceLevel).toBe('STANDARD')
    } finally {
      getSpy.mockRestore()
    }
  })

  test('aucune règle configurée : la commande retombe sur le forfait legacy, sans décomposition inventée', async () => {
    const { shop } = await createShopUser()
    await prisma.shop.update({ where: { id: shop.id }, data: { latitude: 5.3, longitude: -4.0 } })
    const product = await prisma.product.create({ data: { shopId: shop.id, name: 'Riz legacy', slug: `riz-legacy-${Date.now()}`, category: 'Riz', price: 5000, stock: 50, active: true, unit: '10kg' } })

    const getSpy = mockGeocodeCity(`VilleInconnue${Date.now()}`)
    const buyer = await createUser('BUYER')
    try {
      const orderRes = await request(app).post('/api/orders')
        .set('Authorization', `Bearer ${signToken(buyer)}`)
        .send({ items: [{ productId: product.id, quantity: 1 }], address: 'Adresse sans zone' })
      expect(orderRes.status).toBe(201)

      const order = await prisma.order.findUnique({ where: { id: orderRes.body.id } })
      expect(order.deliveryInternalCost).toBeNull()
      expect(order.deliveryMargin).toBeNull()
      expect(order.serviceLevel).toBe('STANDARD')
      expect(order.deliveryFee).toBeGreaterThan(0) // legacy calcDeliveryFee toujours appliqué
    } finally {
      getSpy.mockRestore()
    }
  })
})

describe('LOT 6 — intégration B2B (PUT /api/b2b/transactions/:id/request-logistics)', () => {
  test('sans deliveryFee fourni, la grille B2B_CARGO calcule automatiquement (jamais inventé, jamais bloquant)', async () => {
    const regionTag = `RegionTest${Date.now()}`
    const cityTag = `DestB2B${Date.now()}`
    const originZone = await prisma.zone.create({ data: { name: `OrigineB2B${Date.now()}`, city: regionTag } })
    const destZone = await prisma.zone.create({ data: { name: `DestB2BZone${Date.now()}`, city: cityTag } })
    await prisma.pricingRule.create({
      data: {
        segment: 'B2B_CARGO', serviceLevel: 'STANDARD', originZoneId: originZone.id, destinationZoneId: destZone.id,
        basePrice: 5000, pricePerKg: 2, marginPct: 0.15,
      },
    })

    const buyer = await createUser('TRADER')
    const seller = await createUser('COOPERATIVE')
    const tx = await prisma.b2BTransaction.create({
      data: { buyerUserId: buyer.id, sellerUserId: seller.id, product: 'Riz paddy', quantity: 2, unit: 'tonne', region: regionTag, status: 'DECLARED' },
    })

    const getSpy = mockGeocodeCity(cityTag)
    try {
      const res = await request(app).put(`/api/b2b/transactions/${tx.id}/request-logistics`)
        .set('Authorization', `Bearer ${signToken(buyer)}`)
        .send({ deliveryAddress: 'Entrepot destinataire' })
      expect(res.status).toBe(200)
      // poids = 2 tonnes = 2000kg ; coût interne = 5000 + 2000*2 = 9000 ; prix = 9000*1.15 = 10350
      expect(res.body.deliveryInternalCost).toBe(9000)
      expect(res.body.deliveryMargin).toBeCloseTo(1350, 0)
      expect(res.body.deliveryFee).toBeCloseTo(10350, 0)
    } finally {
      getSpy.mockRestore()
    }
  })

  test('un deliveryFee fourni manuellement prime toujours sur le calcul automatique', async () => {
    const buyer = await createUser('TRADER')
    const seller = await createUser('COOPERATIVE')
    const tx = await prisma.b2BTransaction.create({
      data: { buyerUserId: buyer.id, sellerUserId: seller.id, product: 'Riz paddy', quantity: 2, unit: 'tonne', region: 'RegionManuelle', status: 'DECLARED' },
    })
    const res = await request(app).put(`/api/b2b/transactions/${tx.id}/request-logistics`)
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ deliveryAddress: 'Entrepot', deliveryFee: 42000 })
    expect(res.status).toBe(200)
    expect(res.body.deliveryFee).toBe(42000)
    expect(res.body.deliveryInternalCost).toBeNull()
  })
})

describe('LOT 6 — administration de la grille tarifaire (routes admin)', () => {
  test('un admin peut créer, modifier et supprimer une PricingRule', async () => {
    const admin = await createUser('ADMIN')
    const createRes = await request(app).post('/api/admin/logistics/pricing-rules')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ segment: 'SMALL_MEDIUM', serviceLevel: 'STANDARD', basePrice: 1000 })
    expect(createRes.status).toBe(201)
    const id = createRes.body.pricingRule.id

    const updateRes = await request(app).put(`/api/admin/logistics/pricing-rules/${id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ basePrice: 1200, active: false })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.pricingRule.basePrice).toBe(1200)
    expect(updateRes.body.pricingRule.active).toBe(false)

    const deleteRes = await request(app).delete(`/api/admin/logistics/pricing-rules/${id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(deleteRes.status).toBe(204)
  })

  test('un segment ou serviceLevel invalide est rejeté (400)', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).post('/api/admin/logistics/pricing-rules')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ segment: 'INVALIDE', serviceLevel: 'STANDARD', basePrice: 1000 })
    expect(res.status).toBe(400)
  })

  test('un deuxième joker complet pour le même segment/serviceLevel est rejeté (409) — NULL n\'est pas capturé par la contrainte UNIQUE', async () => {
    const admin = await createUser('ADMIN')
    await request(app).post('/api/admin/logistics/pricing-rules')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ segment: 'B2B_CARGO', serviceLevel: 'ECONOMIC', basePrice: 500 })
    const res = await request(app).post('/api/admin/logistics/pricing-rules')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ segment: 'B2B_CARGO', serviceLevel: 'ECONOMIC', basePrice: 600 })
    expect(res.status).toBe(409)
  })

  test('un non-admin ne peut pas administrer la grille', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(app).post('/api/admin/logistics/pricing-rules')
      .set('Authorization', `Bearer ${signToken(buyer)}`)
      .send({ segment: 'SMALL_MEDIUM', serviceLevel: 'STANDARD', basePrice: 1000 })
    expect(res.status).toBe(403)
  })
})
