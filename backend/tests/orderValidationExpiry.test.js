// LOT AUDIT-G11 (audit XXX RIZ) : PENDING_VALIDATION bloquait le stock
// indéfiniment si personne ne traitait la commande — aucun job d'expiration
// n'existait (contrairement à b2bExpiry.js pour le B2B). Ce lot ajoute un
// avertissement au staff commercial à 24h puis une annulation+restockage
// automatique à 48h.
const { checkPendingValidationOrders, EXPIRY_HOURS, WARNING_HOURS } = require('../src/services/orderValidationExpiry')
const { prisma, createUser, createShopUser } = require('./helpers')

async function createPendingOrder(ageHours, overrides = {}) {
  const buyer = await createUser('BUYER')
  const { shop } = await createShopUser()
  const product = await prisma.product.create({
    data: { shopId: shop.id, name: 'Riz test expiry', slug: `riz-expiry-${Date.now()}-${Math.random()}`, category: 'Riz', price: 5000, stock: 20 },
  })
  await prisma.stockPosition.create({ data: { productId: product.id, quantity: 20 } })
  await prisma.product.update({ where: { id: product.id }, data: { stock: { decrement: 3 } } })
  await prisma.stockPosition.update({ where: { productId: product.id }, data: { quantity: { decrement: 3 } } })

  const createdAt = new Date(Date.now() - ageHours * 60 * 60 * 1000)
  const order = await prisma.order.create({
    data: {
      buyerId: buyer.id, shopId: shop.id, status: 'PENDING_VALIDATION', total: 15000, address: 'Adresse test',
      createdAt,
      items: { create: [{ productId: product.id, quantity: 3, price: 5000, name: product.name }] },
      ...overrides,
    },
  })
  return { buyer, product, order }
}

describe('LOT AUDIT-G11 — expiration automatique des commandes PENDING_VALIDATION', () => {
  test('annule et restocke une commande dépassant 48h', async () => {
    const { product, order } = await createPendingOrder(EXPIRY_HOURS + 1)

    const result = await checkPendingValidationOrders()
    expect(result.expired).toBeGreaterThanOrEqual(1)

    const refreshed = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshed.status).toBe('CANCELLED')

    const position = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(position.quantity).toBe(20) // restocké

    const history = await prisma.orderStatusHistory.findFirst({ where: { orderId: order.id, status: 'CANCELLED' } })
    expect(history.note).toMatch(/automatiquement/)

    const notif = await prisma.notification.findFirst({ where: { userId: order.buyerId, type: 'ORDER_CANCELLED' } })
    expect(notif).toBeTruthy()
  })

  test('ne touche pas une commande PENDING_VALIDATION récente (< 24h)', async () => {
    const { order } = await createPendingOrder(2)

    await checkPendingValidationOrders()

    const refreshed = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshed.status).toBe('PENDING_VALIDATION')
    expect(refreshed.expiryWarnedAt).toBeNull()
  })

  test('avertit le staff commercial/admin à 24h, une seule fois', async () => {
    const admin = await createUser('ADMIN')
    const commercial = await createUser('COMMERCIAL')
    const { order } = await createPendingOrder(WARNING_HOURS + 1)

    const result = await checkPendingValidationOrders()
    expect(result.warned).toBeGreaterThanOrEqual(1)

    const notifAdmin = await prisma.notification.findFirst({ where: { userId: admin.id, type: 'ORDER_VALIDATION_EXPIRING' } })
    const notifCommercial = await prisma.notification.findFirst({ where: { userId: commercial.id, type: 'ORDER_VALIDATION_EXPIRING' } })
    expect(notifAdmin).toBeTruthy()
    expect(notifCommercial).toBeTruthy()

    const refreshed = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshed.expiryWarnedAt).toBeTruthy()
    expect(refreshed.status).toBe('PENDING_VALIDATION') // pas encore annulée

    // second passage : pas de nouvelle notification (déjà avertie)
    const countBefore = await prisma.notification.count({ where: { userId: admin.id, type: 'ORDER_VALIDATION_EXPIRING' } })
    await checkPendingValidationOrders()
    const countAfter = await prisma.notification.count({ where: { userId: admin.id, type: 'ORDER_VALIDATION_EXPIRING' } })
    expect(countAfter).toBe(countBefore)
  })

  test('une commande déjà CONFIRMED n\'est jamais touchée même vieille de 100h', async () => {
    const { order } = await createPendingOrder(100, { status: 'CONFIRMED' })
    await checkPendingValidationOrders()
    const refreshed = await prisma.order.findUnique({ where: { id: order.id } })
    expect(refreshed.status).toBe('CONFIRMED')
  })
})
