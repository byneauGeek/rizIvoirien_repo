const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, signToken } = require('./helpers')

async function createDeliveredOrderWithDispute(reason = 'PRODUCT_DAMAGED') {
  const buyer = await createUser('BUYER')
  const { shop } = await createShopUser()
  const product = await prisma.product.create({
    data: { shopId: shop.id, name: 'Riz litige', slug: `riz-litige-${Date.now()}-${Math.random()}`, category: 'Riz', price: 5000, stock: 20 },
  })
  await prisma.stockPosition.create({ data: { productId: product.id, quantity: 20 } })
  // Simule la vente déjà décrémentée à la commande (comme le ferait POST /api/orders)
  await prisma.product.update({ where: { id: product.id }, data: { stock: { decrement: 3 } } })
  await prisma.stockPosition.update({ where: { productId: product.id }, data: { quantity: { decrement: 3 } } })

  const order = await prisma.order.create({
    data: {
      buyerId: buyer.id, shopId: shop.id, status: 'DELIVERED', total: 15000, address: 'Adresse test',
      items: { create: [{ productId: product.id, quantity: 3, price: 5000, name: product.name }] },
    },
  })
  const dispute = await prisma.dispute.create({
    data: { orderId: order.id, buyerId: buyer.id, reason, description: 'Test', status: 'OPEN' },
  })
  return { buyer, product, order, dispute }
}

describe('LOT 7 — résolution de litige avec décision de restockage explicite', () => {
  test('restock=true remet l\'article en stock, trace RESTOCK/DISPUTE', async () => {
    const admin = await createUser('ADMIN')
    const { product, dispute } = await createDeliveredOrderWithDispute('WRONG_PRODUCT')

    const before = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(before.quantity).toBe(17)

    const res = await request(app).put(`/api/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'RESOLVED_REFUND', refundAmount: 15000, restock: true })
    expect(res.status).toBe(200)

    const after = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(after.quantity).toBe(20)
    const refreshedProduct = await prisma.product.findUnique({ where: { id: product.id } })
    expect(refreshedProduct.stock).toBe(20)

    const movement = await prisma.stockMovement.findFirst({ where: { productId: product.id, type: 'RESTOCK', sourceType: 'DISPUTE' } })
    expect(movement).toBeTruthy()
    expect(movement.sourceId).toBe(dispute.id)
    expect(movement.quantity).toBe(3)
  })

  test('restock=false (produit endommagé) ne touche pas le stock — la vente reste la trace correcte', async () => {
    const admin = await createUser('ADMIN')
    const { product, dispute } = await createDeliveredOrderWithDispute('PRODUCT_DAMAGED')

    const before = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(before.quantity).toBe(17)

    const res = await request(app).put(`/api/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'RESOLVED_REFUND', refundAmount: 15000, restock: false })
    expect(res.status).toBe(200)

    const after = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(after.quantity).toBe(17) // inchangé

    const movements = await prisma.stockMovement.findMany({ where: { productId: product.id, sourceType: 'DISPUTE' } })
    expect(movements).toHaveLength(0) // aucun mouvement créé, pas même un "LOSS"
  })

  test('restock manquant sur un premier passage en RESOLVED_REFUND est rejeté', async () => {
    const admin = await createUser('ADMIN')
    const { dispute } = await createDeliveredOrderWithDispute()

    const res = await request(app).put(`/api/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'RESOLVED_REFUND', refundAmount: 15000 })
    expect(res.status).toBe(400)
  })

  test('restock n\'est pas requis pour UNDER_REVIEW/REJECTED/CLOSED', async () => {
    const admin = await createUser('ADMIN')
    const { dispute } = await createDeliveredOrderWithDispute()

    const res = await request(app).put(`/api/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'UNDER_REVIEW' })
    expect(res.status).toBe(200)
  })

  test('modifier une décision déjà résolue ne rejoue jamais le stock', async () => {
    const admin = await createUser('ADMIN')
    const { product, dispute } = await createDeliveredOrderWithDispute()

    const first = await request(app).put(`/api/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'RESOLVED_REFUND', refundAmount: 10000, restock: true })
    expect(first.status).toBe(200)

    const afterFirst = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(afterFirst.quantity).toBe(20)

    // Edite le montant/la note (bouton "Modifier la décision") — même en
    // repassant restock=true, aucun second mouvement ne doit être créé.
    const edit = await request(app).put(`/api/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'RESOLVED_REFUND', refundAmount: 15000, resolution: 'Montant corrigé', restock: true })
    expect(edit.status).toBe(200)
    expect(edit.body.refundAmount).toBe(15000)

    const afterEdit = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(afterEdit.quantity).toBe(20) // toujours 20, pas 23

    const movements = await prisma.stockMovement.findMany({ where: { productId: product.id, sourceType: 'DISPUTE' } })
    expect(movements).toHaveLength(1) // un seul mouvement, jamais dupliqué
  })

  test('commande multi-articles : chaque article est traité', async () => {
    const admin = await createUser('ADMIN')
    const buyer = await createUser('BUYER')
    const { shop } = await createShopUser()
    const productA = await prisma.product.create({ data: { shopId: shop.id, name: 'A', slug: `a-${Date.now()}`, category: 'Riz', price: 1000, stock: 10 } })
    const productB = await prisma.product.create({ data: { shopId: shop.id, name: 'B', slug: `b-${Date.now()}`, category: 'Riz', price: 1000, stock: 10 } })
    await prisma.stockPosition.createMany({ data: [{ productId: productA.id, quantity: 8 }, { productId: productB.id, quantity: 9 }] })
    const order = await prisma.order.create({
      data: {
        buyerId: buyer.id, shopId: shop.id, status: 'DELIVERED', total: 3000, address: 'x',
        items: { create: [{ productId: productA.id, quantity: 2, price: 1000, name: 'A' }, { productId: productB.id, quantity: 1, price: 1000, name: 'B' }] },
      },
    })
    const dispute = await prisma.dispute.create({ data: { orderId: order.id, buyerId: buyer.id, reason: 'DELIVERY_ISSUE', description: 'x', status: 'OPEN' } })

    const res = await request(app).put(`/api/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'RESOLVED_REFUND', refundAmount: 3000, restock: true })
    expect(res.status).toBe(200)

    const posA = await prisma.stockPosition.findUnique({ where: { productId: productA.id } })
    const posB = await prisma.stockPosition.findUnique({ where: { productId: productB.id } })
    expect(posA.quantity).toBe(10)
    expect(posB.quantity).toBe(10)
  })
})

describe('LOT AUDIT-G2 — remboursement de litige crée une créance réelle contre la boutique', () => {
  test('RESOLVED_REFUND crée un Receivable, débiteur = propriétaire de la boutique', async () => {
    const admin = await createUser('ADMIN')
    const { dispute, order } = await createDeliveredOrderWithDispute()
    const shop = await prisma.shop.findUnique({ where: { id: order.shopId } })

    const res = await request(app).put(`/api/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'RESOLVED_REFUND', refundAmount: 15000, restock: true })
    expect(res.status).toBe(200)

    const receivable = await prisma.receivable.findFirst({ where: { sourceType: 'DISPUTE_REFUND', sourceId: dispute.id } })
    expect(receivable).toBeTruthy()
    expect(receivable.debtorUserId).toBe(shop.userId)
    expect(receivable.amount).toBe(15000)
    expect(receivable.status).toBe('OPEN')
  })

  test('modifier une décision déjà résolue ne crée pas de second Receivable', async () => {
    const admin = await createUser('ADMIN')
    const { dispute } = await createDeliveredOrderWithDispute()

    await request(app).put(`/api/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'RESOLVED_REFUND', refundAmount: 10000, restock: true })
    await request(app).put(`/api/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'RESOLVED_REFUND', refundAmount: 15000, resolution: 'Montant corrigé', restock: true })

    const receivables = await prisma.receivable.findMany({ where: { sourceType: 'DISPUTE_REFUND', sourceId: dispute.id } })
    expect(receivables).toHaveLength(1)
    expect(receivables[0].amount).toBe(10000) // montant de la PREMIÈRE résolution, pas rejoué
  })

  test('RESOLVED_REJECTED ne crée aucun Receivable', async () => {
    const admin = await createUser('ADMIN')
    const { dispute } = await createDeliveredOrderWithDispute()

    const res = await request(app).put(`/api/disputes/${dispute.id}/resolve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'RESOLVED_REJECTED' })
    expect(res.status).toBe(200)

    const receivable = await prisma.receivable.findFirst({ where: { sourceType: 'DISPUTE_REFUND', sourceId: dispute.id } })
    expect(receivable).toBeNull()
  })
})
