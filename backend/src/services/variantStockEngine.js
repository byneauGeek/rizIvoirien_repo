// Moteur de stock pour ProductVariant — mécanisme volontairement séparé de
// services/stockEngine.js (celui-ci reste intouché : trop central et éprouvé
// pour y injecter un variantId optionnel). Même garantie d'atomicité :
// increment/decrement signé côté SQL, jamais de lecture-puis-écriture
// applicative, rejet si le résultat passerait sous zéro.
const MOVEMENT_TYPES = ['INITIAL_STOCK', 'SALE', 'RESTOCK', 'ADJUSTMENT']

class VariantStockEngineError extends Error {}

class InsufficientVariantStockError extends VariantStockEngineError {
  constructor(variantId, available, requested) {
    super(`Stock insuffisant pour la variante #${variantId} (disponible : ${available}, demandé : ${requested})`)
    this.variantId = variantId
    this.available = available
    this.requested = requested
  }
}

async function applyMovement(client, params) {
  if (typeof client.$transaction === 'function') {
    return client.$transaction((tx) => applyMovementInTransaction(tx, params))
  }
  return applyMovementInTransaction(client, params)
}

async function applyMovementInTransaction(tx, { variantId, type, quantity, sourceType = null, sourceId = null, reason = null, actorId = null }) {
  if (!MOVEMENT_TYPES.includes(type)) throw new VariantStockEngineError(`type de mouvement invalide : ${type}`)
  if (!Number.isInteger(quantity) || quantity === 0) throw new VariantStockEngineError('quantity doit être un entier non nul')

  const updated = await tx.productVariant.update({
    where: { id: variantId },
    data: { stock: { increment: quantity } },
  })

  if (updated.stock < 0) throw new InsufficientVariantStockError(variantId, updated.stock - quantity, -quantity)

  const quantityBefore = updated.stock - quantity
  const movement = await tx.variantStockMovement.create({
    data: { variantId, type, quantity, quantityBefore, quantityAfter: updated.stock, sourceType, sourceId, reason, actorId },
  })

  return { variant: updated, movement }
}

// Stock de départ à la création de la variante (variante DOIT être créée
// avec stock=0 avant cet appel, même convention que stockEngine.initializeStock).
async function initializeVariantStock(client, { variantId, quantity, actorId = null }) {
  if (!Number.isInteger(quantity) || quantity < 0) throw new VariantStockEngineError('quantity doit être un entier ≥ 0')
  if (quantity === 0) return { movement: null }
  return applyMovement(client, { variantId, type: 'INITIAL_STOCK', quantity, sourceType: 'MANUAL', actorId })
}

async function recordVariantSale(client, { variantId, quantity, orderId, actorId = null }) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new VariantStockEngineError('quantity doit être un entier positif')
  return applyMovement(client, { variantId, type: 'SALE', quantity: -quantity, sourceType: 'ORDER', sourceId: orderId, actorId })
}

async function restockVariantFromCancellation(client, { variantId, quantity, orderId, actorId = null, reason = null }) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new VariantStockEngineError('quantity doit être un entier positif')
  return applyMovement(client, { variantId, type: 'RESTOCK', quantity, sourceType: 'ORDER', sourceId: orderId, reason, actorId })
}

async function adjustVariantStock(client, { variantId, delta, actorId, reason }) {
  if (!Number.isInteger(delta) || delta === 0) throw new VariantStockEngineError('delta doit être un entier non nul')
  if (!actorId) throw new VariantStockEngineError('actorId requis pour un ajustement de stock')
  if (!reason || !reason.trim()) throw new VariantStockEngineError('reason requis pour un ajustement de stock')
  return applyMovement(client, { variantId, type: 'ADJUSTMENT', quantity: delta, sourceType: 'MANUAL', reason: reason.trim(), actorId })
}

module.exports = {
  VariantStockEngineError,
  InsufficientVariantStockError,
  applyMovement,
  initializeVariantStock,
  recordVariantSale,
  restockVariantFromCancellation,
  adjustVariantStock,
}
