const { prisma, createShopUser } = require('./helpers')
const { main: backfillStockPositions } = require('../scripts/backfillStockPositions')

async function createProduct(shopId, overrides = {}) {
  return prisma.product.create({
    data: {
      shopId, name: 'Riz test LOT1', slug: `riz-lot1-${Date.now()}-${Math.random()}`,
      category: 'Riz', price: 5000, stock: 20, ...overrides,
    },
  })
}

describe('LOT 1 — modèles fondation (StockPosition/StockMovement)', () => {
  test('StockPosition.productId est unique — une seule position par produit', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id)
    await prisma.stockPosition.create({ data: { productId: product.id, quantity: product.stock } })

    await expect(
      prisma.stockPosition.create({ data: { productId: product.id, quantity: 0 } })
    ).rejects.toThrow()
  })

  test('un StockMovement se rattache à sa StockPosition et porte les champs de traçabilité', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, { stock: 100 })
    const position = await prisma.stockPosition.create({ data: { productId: product.id, quantity: 100 } })

    const movement = await prisma.stockMovement.create({
      data: {
        stockPositionId: position.id, productId: product.id, type: 'RECEPTION',
        quantity: 50, quantityBefore: 100, quantityAfter: 150, sourceType: 'MANUAL', reason: 'Test',
      },
    })

    expect(movement.stockPositionId).toBe(position.id)
    expect(movement.quantityAfter - movement.quantityBefore).toBe(movement.quantity)
  })

  test('la suppression d\'un produit supprime en cascade sa StockPosition et ses mouvements', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id)
    const position = await prisma.stockPosition.create({ data: { productId: product.id, quantity: product.stock } })
    await prisma.stockMovement.create({
      data: { stockPositionId: position.id, productId: product.id, type: 'INITIAL_STOCK', quantity: product.stock, quantityBefore: 0, quantityAfter: product.stock },
    })

    await prisma.product.delete({ where: { id: product.id } })

    expect(await prisma.stockPosition.findUnique({ where: { id: position.id } })).toBeNull()
    expect(await prisma.stockMovement.findMany({ where: { productId: product.id } })).toHaveLength(0)
  })
})

describe('LOT 1 — script de bascule (backfillStockPositions)', () => {
  test('initialise StockPosition = Product.stock et trace un mouvement INITIAL_STOCK, sans toucher Product', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, { stock: 77 })

    await backfillStockPositions()

    const position = await prisma.stockPosition.findUnique({ where: { productId: product.id } })
    expect(position.quantity).toBe(77)

    const movement = await prisma.stockMovement.findFirst({ where: { productId: product.id, type: 'INITIAL_STOCK' } })
    expect(movement).toBeTruthy()
    expect(movement.quantityAfter).toBe(77)
    expect(movement.sourceType).toBe('MIGRATION')

    const unchangedProduct = await prisma.product.findUnique({ where: { id: product.id } })
    expect(unchangedProduct.stock).toBe(77) // le script n'a jamais écrit sur Product
  })

  test('est idempotent — une seconde exécution ne duplique rien', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, { stock: 30 })

    await backfillStockPositions()
    await backfillStockPositions()

    const positions = await prisma.stockPosition.findMany({ where: { productId: product.id } })
    expect(positions).toHaveLength(1)
    const movements = await prisma.stockMovement.findMany({ where: { productId: product.id } })
    expect(movements).toHaveLength(1)
  })

  test('un produit créé après une première bascule est repris à la bascule suivante', async () => {
    const { shop } = await createShopUser()
    await backfillStockPositions() // aucun produit encore
    const lateProduct = await createProduct(shop.id, { stock: 12 })

    await backfillStockPositions()

    const position = await prisma.stockPosition.findUnique({ where: { productId: lateProduct.id } })
    expect(position.quantity).toBe(12)
  })
})
