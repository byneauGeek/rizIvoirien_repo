const { prisma, createShopUser, createUser } = require('./helpers')
const stockEngine = require('../src/services/stockEngine')

async function createProduct(shopId, stock = 20) {
  return prisma.product.create({
    data: { shopId, name: 'Riz test LOT2', slug: `riz-lot2-${Date.now()}-${Math.random()}`, category: 'Riz', price: 5000, stock },
  })
}

describe('LOT 2 — Stock Engine, primitives de base', () => {
  test('ensurePosition crée la position si absente, à partir de Product.stock', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 42)
    const position = await stockEngine.ensurePosition(prisma, product.id)
    expect(position.quantity).toBe(42)

    const again = await stockEngine.ensurePosition(prisma, product.id)
    expect(again.id).toBe(position.id) // pas de doublon
  })

  test('applyMovement rejette un type inconnu ou une quantité nulle/non entière', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 10)
    await expect(stockEngine.applyMovement(prisma, { productId: product.id, type: 'NOPE', quantity: 1 }))
      .rejects.toThrow(stockEngine.StockEngineError)
    await expect(stockEngine.applyMovement(prisma, { productId: product.id, type: 'RECEPTION', quantity: 0 }))
      .rejects.toThrow(stockEngine.StockEngineError)
    await expect(stockEngine.applyMovement(prisma, { productId: product.id, type: 'RECEPTION', quantity: 1.5 }))
      .rejects.toThrow(stockEngine.StockEngineError)
  })

  test('applyMovement synchronise StockPosition ET Product.stock', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 10)
    await stockEngine.applyMovement(prisma, { productId: product.id, type: 'RECEPTION', quantity: 5, sourceType: 'MANUAL' })

    const position = await stockEngine.getPosition(prisma, product.id)
    const refreshed = await prisma.product.findUnique({ where: { id: product.id } })
    expect(position.quantity).toBe(15)
    expect(refreshed.stock).toBe(15)
  })

  test('produit introuvable → ProductNotFoundError', async () => {
    await expect(stockEngine.applyMovement(prisma, { productId: 999999, type: 'RECEPTION', quantity: 1 }))
      .rejects.toThrow(stockEngine.ProductNotFoundError)
  })
})

describe('LOT 2 — scénarios du plan de test (audit LOT 0, §0.12), en isolation', () => {
  test('Réception 500', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 0)
    const admin = await createUser('ADMIN')

    const { position, movement } = await stockEngine.receiveStock(prisma, { productId: product.id, quantity: 500, actorId: admin.id, reason: 'Livraison initiale' })
    expect(position.quantity).toBe(500)
    expect(movement.type).toBe('RECEPTION')
    expect(movement.quantityBefore).toBe(0)
    expect(movement.quantityAfter).toBe(500)
  })

  test('Commande 50 puis annulation puis nouvelle commande', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 500)
    await stockEngine.ensurePosition(prisma, product.id)

    const sale = await stockEngine.recordSale(prisma, { productId: product.id, quantity: 50, orderId: 1 })
    expect(sale.position.quantity).toBe(450)
    expect(sale.movement.type).toBe('SALE')
    expect(sale.movement.sourceType).toBe('ORDER')
    expect(sale.movement.sourceId).toBe(1)

    const restock = await stockEngine.restockFromCancellation(prisma, { productId: product.id, quantity: 50, orderId: 1, reason: 'Annulée par l\'acheteur' })
    expect(restock.position.quantity).toBe(500)
    expect(restock.movement.type).toBe('RESTOCK')

    const secondSale = await stockEngine.recordSale(prisma, { productId: product.id, quantity: 50, orderId: 2 })
    expect(secondSale.position.quantity).toBe(450)
  })

  test('Expédition / Transit / Livraison ne modifient jamais le stock (aucun appel au moteur)', async () => {
    // Le Stock Engine n'a aucune fonction pour ces étapes — la seule façon de
    // "tester" cette invariance est de constater qu'aucune fonction publique
    // ne correspond à ces transitions de statut de commande.
    const publicApi = Object.keys(stockEngine).filter(k => typeof stockEngine[k] === 'function')
    expect(publicApi.some(name => /transit|shipping|deliver/i.test(name))).toBe(false)
  })

  test('Produit endommagé (perte)', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 100)
    await stockEngine.ensurePosition(prisma, product.id)
    const admin = await createUser('ADMIN')

    const { position, movement } = await stockEngine.recordLoss(prisma, { productId: product.id, quantity: 3, actorId: admin.id, reason: 'Sacs endommagés en entrepôt' })
    expect(position.quantity).toBe(97)
    expect(movement.type).toBe('LOSS')
    expect(movement.quantity).toBe(-3)
  })

  test('recordLoss et adjustStock exigent un motif non vide', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 10)
    const admin = await createUser('ADMIN')
    await expect(stockEngine.recordLoss(prisma, { productId: product.id, quantity: 1, actorId: admin.id, reason: '  ' }))
      .rejects.toThrow(stockEngine.StockEngineError)
    await expect(stockEngine.adjustStock(prisma, { productId: product.id, delta: -1, actorId: admin.id, reason: '' }))
      .rejects.toThrow(stockEngine.StockEngineError)
  })

  test('Inventaire / Écart d\'inventaire', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 450)
    await stockEngine.ensurePosition(prisma, product.id)
    const admin = await createUser('ADMIN')

    const result = await stockEngine.applyInventoryCount(prisma, { productId: product.id, countedQuantity: 440, actorId: admin.id })
    expect(result.delta).toBe(-10)
    expect(result.position.quantity).toBe(440)
    expect(result.movement.type).toBe('INVENTORY_ADJUSTMENT')

    // Compte identique au système : aucun mouvement créé (rien à tracer).
    const noOp = await stockEngine.applyInventoryCount(prisma, { productId: product.id, countedQuantity: 440, actorId: admin.id })
    expect(noOp.delta).toBe(0)
    expect(noOp.movement).toBeNull()
  })

  test('Deux "commandes" simultanées sur un stock limité — une seule doit réussir', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 10)
    await stockEngine.ensurePosition(prisma, product.id)

    const results = await Promise.allSettled([
      stockEngine.recordSale(prisma, { productId: product.id, quantity: 8, orderId: 10 }),
      stockEngine.recordSale(prisma, { productId: product.id, quantity: 8, orderId: 11 }),
    ])

    const fulfilled = results.filter(r => r.status === 'fulfilled')
    const rejected = results.filter(r => r.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toBeInstanceOf(stockEngine.InsufficientStockError)

    const finalPosition = await stockEngine.getPosition(prisma, product.id)
    expect(finalPosition.quantity).toBe(2)
  })

  test('Stock insuffisant — rejeté, aucune écriture', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 5)
    await stockEngine.ensurePosition(prisma, product.id)

    await expect(stockEngine.recordSale(prisma, { productId: product.id, quantity: 10, orderId: 99 }))
      .rejects.toThrow(stockEngine.InsufficientStockError)

    const position = await stockEngine.getPosition(prisma, product.id)
    expect(position.quantity).toBe(5)
    const movements = await stockEngine.listMovements(prisma, { productId: product.id })
    expect(movements).toHaveLength(0)
  })

  test('Composition dans la transaction d\'un appelant (comme le fera LOT 3)', async () => {
    const { shop } = await createShopUser()
    const product = await createProduct(shop.id, 20)
    await stockEngine.ensurePosition(prisma, product.id)

    // Simule ce que LOT 3 fera : le moteur est appelé AVEC le tx de la
    // transaction d'un appelant, pas avec `prisma` directement — puis un
    // échec plus loin dans cette même transaction doit tout annuler.
    await expect(prisma.$transaction(async (tx) => {
      await stockEngine.recordSale(tx, { productId: product.id, quantity: 5, orderId: 42 })
      throw new Error('Échec simulé après le mouvement de stock')
    })).rejects.toThrow('Échec simulé')

    const position = await stockEngine.getPosition(prisma, product.id)
    expect(position.quantity).toBe(20) // rollback complet, y compris le mouvement de stock
  })
})
