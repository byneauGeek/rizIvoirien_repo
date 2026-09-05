const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

async function setupShipment(status = 'PENDING_PICKUP', overrides = {}) {
  const buyer = await createUser('BUYER')
  const { shop } = await createShopUser()
  const { driver } = await createDriverUser()
  const order = await prisma.order.create({
    data: { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'PRET', total: 5000, deliveryFee: 1000, address: 'x' },
  })
  const shipment = await prisma.shipment.create({
    data: { orderId: order.id, driverId: driver.id, status, dropoffAddress: order.address, ...overrides },
  })
  return { buyer, driver, order, shipment }
}

describe('LOT 14 — GET /api/admin/logistics/shipments (centre admin logistique)', () => {
  test('liste les shipments avec les infos commande/livreur jointes', async () => {
    const { driver, order } = await setupShipment('IN_TRANSIT')
    const admin = await createUser('ADMIN')

    const res = await request(app).get('/api/admin/logistics/shipments').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    const row = res.body.shipments.find(s => s.orderId === order.id)
    expect(row).toBeTruthy()
    expect(row.driver.id).toBe(driver.id)
    expect(row.order.buyer).toBeTruthy()
  })

  test('filtre par statut', async () => {
    await setupShipment('FAILED', { failureReason: 'Client injoignable' })
    await setupShipment('DELIVERED')
    const admin = await createUser('ADMIN')

    const res = await request(app).get('/api/admin/logistics/shipments?status=FAILED').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.body.shipments.every(s => s.status === 'FAILED')).toBe(true)
    expect(res.body.shipments.some(s => s.failureReason === 'Client injoignable')).toBe(true)
  })

  test('un non-admin ne peut pas accéder au centre logistique', async () => {
    const seller = await createUser('SELLER')
    const res = await request(app).get('/api/admin/logistics/shipments').set('Authorization', `Bearer ${signToken(seller)}`)
    expect(res.status).toBe(403)
  })
})

describe('LOT 14 — GET /api/admin/logistics/dashboard', () => {
  test('agrège les shipments par statut et compte les escalades en attente', async () => {
    await setupShipment('IN_TRANSIT')
    await setupShipment('PENDING_PICKUP')
    const { order: failedOrder } = await setupShipment('FAILED', { failureReason: 'Adresse introuvable' })
    await prisma.order.update({ where: { id: failedOrder.id }, data: { status: 'ESCALATED' } })

    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/admin/logistics/dashboard').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.byStatus.IN_TRANSIT).toBeGreaterThanOrEqual(1)
    expect(res.body.byStatus.FAILED).toBeGreaterThanOrEqual(1)
    expect(res.body.failedToday).toBeGreaterThanOrEqual(1)
    expect(res.body.escalatedAwaitingReassignment).toBeGreaterThanOrEqual(1)
  })

  test('calcule un temps moyen de livraison à partir des horodatages réels', async () => {
    // D'autres fichiers de test livrent aussi des commandes "aujourd'hui" avec
    // des horodatages quasi identiques (pickedUpAt≈deliveredAt) — la base de
    // test n'est réinitialisée qu'une fois pour toute la suite. On purge donc
    // les DELIVERED existants pour isoler le calcul, plutôt que d'espérer un
    // ordre d'exécution des fichiers favorable.
    await prisma.shipment.deleteMany({ where: { status: 'DELIVERED' } })

    const now = new Date()
    const pickedUpAt = new Date(now.getTime() - 30 * 60 * 1000)
    await setupShipment('DELIVERED', { pickedUpAt, deliveredAt: now })

    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/admin/logistics/dashboard').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.body.avgDeliveryMinutes).toBeGreaterThanOrEqual(29)
    expect(res.body.avgDeliveryMinutes).toBeLessThanOrEqual(31)
  })
})
