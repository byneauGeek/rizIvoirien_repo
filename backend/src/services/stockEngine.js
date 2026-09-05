// Stock Engine — LOT 2 : service centralisé, pas encore branché sur les
// routes existantes (orders.js/products.js/commercial.js continuent d'écrire
// directement sur Product.stock jusqu'au LOT 3/5).
//
// Contrat : chaque fonction prend un CLIENT PRISMA explicite en premier
// argument — soit `prisma` directement, soit un `tx` obtenu d'un
// `prisma.$transaction(async (tx) => ...)` appelant. Cela permet de composer
// un mouvement de stock DANS la transaction d'un appelant (ex. LOT 3 :
// décrémenter le stock dans la même transaction que la création de commande)
// sans jamais ouvrir de transaction imbriquée.
//
// Chaque mouvement met à jour StockPosition.quantity ET Product.stock dans
// le même appel (double écriture transitoire, cf. audit LOT 0 §0.11) — tant
// que du code existant lit encore Product.stock directement, les deux
// doivent rester synchronisés à chaque écriture.
const MOVEMENT_TYPES = ['INITIAL_STOCK', 'RECEPTION', 'SALE', 'RESTOCK', 'ADJUSTMENT', 'LOSS', 'INVENTORY_ADJUSTMENT']

class StockEngineError extends Error {}

class InsufficientStockError extends StockEngineError {
  constructor(productId, available, requested) {
    super(`Stock insuffisant pour le produit #${productId} (disponible : ${available}, demandé : ${requested})`)
    this.productId = productId
    this.available = available
    this.requested = requested
  }
}

class ProductNotFoundError extends StockEngineError {
  constructor(productId) {
    super(`Produit #${productId} introuvable`)
    this.productId = productId
  }
}

// Récupère la StockPosition d'un produit, la crée si elle n'existe pas
// encore (produit créé après le backfill du LOT 1) — jamais un échec silencieux.
async function ensurePosition(client, productId) {
  const existing = await client.stockPosition.findUnique({ where: { productId } })
  if (existing) return existing

  const product = await client.product.findUnique({ where: { id: productId }, select: { stock: true } })
  if (!product) throw new ProductNotFoundError(productId)

  return client.stockPosition.create({ data: { productId, quantity: product.stock } })
}

// Primitive commune à tous les mouvements. `quantity` est signé : positif
// pour une entrée, négatif pour une sortie. Rejette tout mouvement qui
// ferait passer la position sous zéro (aucun stock négatif possible par ce
// chemin, quel que soit l'appelant).
//
// `client` peut être le PrismaClient de base OU un client de transaction déjà
// ouvert (`tx`, ex. LOT 3 composant ce mouvement dans la transaction de
// création de commande). Si c'est le client de base (il expose `$transaction`),
// applyMovement ouvre SA PROPRE transaction pour garantir l'atomicité —
// nécessaire ici car l'écriture se fait en increment/decrement atomique côté
// SQL (jamais un read-modify-write applicatif, seule façon d'éviter la course
// que corrige ce commit) puis vérifiée après coup ; si le résultat est
// négatif, il faut pouvoir annuler l'écriture déjà appliquée — d'où la
// transaction. Si `client` est déjà un `tx`, on l'utilise directement : le
// throw en cas de solde négatif remonte alors et fait échouer la transaction
// de l'appelant dans son ensemble, sans transaction imbriquée (non supporté
// par Prisma).
async function applyMovement(client, params) {
  if (typeof client.$transaction === 'function') {
    return client.$transaction((tx) => applyMovementInTransaction(tx, params))
  }
  return applyMovementInTransaction(client, params)
}

async function applyMovementInTransaction(tx, { productId, type, quantity, sourceType = null, sourceId = null, reason = null, actorId = null }) {
  if (!MOVEMENT_TYPES.includes(type)) throw new StockEngineError(`type de mouvement invalide : ${type}`)
  if (!Number.isInteger(quantity) || quantity === 0) throw new StockEngineError('quantity doit être un entier non nul')

  await ensurePosition(tx, productId)

  // Increment/decrement atomique côté SQL — jamais de lecture préalable de la
  // quantité suivie d'un calcul applicatif : c'est exactement ce qui causait
  // la perte de mise à jour sous accès concurrent (deux appels lisant la même
  // valeur de départ avant que l'un des deux n'écrive).
  const updatedPosition = await tx.stockPosition.update({
    where: { productId },
    data: { quantity: { increment: quantity } },
  })

  if (updatedPosition.quantity < 0) throw new InsufficientStockError(productId, updatedPosition.quantity - quantity, -quantity)

  const quantityBefore = updatedPosition.quantity - quantity
  const movement = await tx.stockMovement.create({
    data: { stockPositionId: updatedPosition.id, productId, type, quantity, quantityBefore, quantityAfter: updatedPosition.quantity, sourceType, sourceId, reason, actorId },
  })
  await tx.product.update({ where: { id: productId }, data: { stock: updatedPosition.quantity } })

  return { position: updatedPosition, movement }
}

// ─── Mouvements nommés — un type figé par fonction, jamais laissé au choix
// de l'appelant, pour qu'un `git grep` sur un type retrouve tous ses usages. ───

// Stock de départ d'un produit à sa création (LOT 5) — le produit DOIT être
// créé avec stock=0 avant cet appel : c'est ce mouvement qui l'amène à sa
// quantité initiale, jamais une écriture directe sur Product.stock. Si
// quantity=0, rien à tracer (juste la position, créée par ensurePosition).
async function initializeStock(client, { productId, quantity, actorId = null }) {
  if (!Number.isInteger(quantity) || quantity < 0) throw new StockEngineError('quantity doit être un entier ≥ 0')
  if (quantity === 0) return { position: await ensurePosition(client, productId), movement: null }
  return applyMovement(client, { productId, type: 'INITIAL_STOCK', quantity, sourceType: 'MANUAL', actorId })
}

// Vente : sortie liée à une commande. quantity > 0 en entrée (magnitude),
// converti en sortie négative.
async function recordSale(client, { productId, quantity, orderId, actorId = null }) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new StockEngineError('quantity doit être un entier positif')
  return applyMovement(client, { productId, type: 'SALE', quantity: -quantity, sourceType: 'ORDER', sourceId: orderId, actorId })
}

// Restockage suite à une annulation de commande (quel que soit l'acteur —
// buyer, commercial, admin : LOT 4 fera converger les 3 chemins existants
// vers cette unique fonction).
async function restockFromCancellation(client, { productId, quantity, orderId, actorId = null, reason = null }) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new StockEngineError('quantity doit être un entier positif')
  return applyMovement(client, { productId, type: 'RESTOCK', quantity, sourceType: 'ORDER', sourceId: orderId, reason, actorId })
}

// Réception de marchandise (achat/livraison fournisseur). Motif optionnel
// mais recommandé — devient obligatoire au LOT 5 quand ce chemin remplace
// l'écriture directe du formulaire vendeur.
async function receiveStock(client, { productId, quantity, actorId, reason = null }) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new StockEngineError('quantity doit être un entier positif')
  if (!actorId) throw new StockEngineError('actorId requis pour une réception de stock')
  return applyMovement(client, { productId, type: 'RECEPTION', quantity, sourceType: 'MANUAL', reason, actorId })
}

// Correction manuelle (erreur de saisie, casse non liée à une commande...).
// `delta` est signé (positif ou négatif). Motif OBLIGATOIRE — c'est
// précisément le mouvement qui remplace l'écrasement direct de
// Product.stock identifié comme risque par l'audit LOT 0.
async function adjustStock(client, { productId, delta, actorId, reason }) {
  if (!Number.isInteger(delta) || delta === 0) throw new StockEngineError('delta doit être un entier non nul')
  if (!actorId) throw new StockEngineError('actorId requis pour un ajustement de stock')
  if (!reason || !reason.trim()) throw new StockEngineError('reason requis pour un ajustement de stock')
  return applyMovement(client, { productId, type: 'ADJUSTMENT', quantity: delta, sourceType: 'MANUAL', reason: reason.trim(), actorId })
}

// Perte constatée (produit endommagé, périmé...) — toujours une sortie.
// sourceType/sourceId permet de relier la perte à un Dispute si applicable.
async function recordLoss(client, { productId, quantity, actorId, reason, sourceType = 'MANUAL', sourceId = null }) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new StockEngineError('quantity doit être un entier positif')
  if (!actorId) throw new StockEngineError('actorId requis pour une perte de stock')
  if (!reason || !reason.trim()) throw new StockEngineError('reason requis pour une perte de stock')
  return applyMovement(client, { productId, type: 'LOSS', quantity: -quantity, sourceType, sourceId, reason: reason.trim(), actorId })
}

// Inventaire physique : `countedQuantity` est la quantité comptée sur le
// terrain, l'écart avec la position système est calculé et tracé — jamais
// une réécriture directe de la quantité.
async function applyInventoryCount(client, { productId, countedQuantity, actorId, reason = null }) {
  if (!Number.isInteger(countedQuantity) || countedQuantity < 0) throw new StockEngineError('countedQuantity doit être un entier ≥ 0')
  if (!actorId) throw new StockEngineError('actorId requis pour un inventaire')

  const position = await ensurePosition(client, productId)
  const delta = countedQuantity - position.quantity
  if (delta === 0) return { position, movement: null, delta: 0 } // aucun écart, rien à tracer

  return {
    ...(await applyMovement(client, {
      productId, type: 'INVENTORY_ADJUSTMENT', quantity: delta, sourceType: 'INVENTORY',
      reason: reason?.trim() || `Écart d'inventaire (compté : ${countedQuantity}, système : ${position.quantity})`, actorId,
    })),
    delta,
  }
}

// ─── Lecture ────────────────────────────────────────────────────────────────

function getPosition(client, productId) {
  return client.stockPosition.findUnique({ where: { productId } })
}

function listMovements(client, { productId, type, sourceType, limit = 50, offset = 0 } = {}) {
  const where = {}
  if (productId) where.productId = Number(productId)
  if (type) where.type = type
  if (sourceType) where.sourceType = sourceType
  return client.stockMovement.findMany({
    where, orderBy: { createdAt: 'desc' }, take: Math.min(Number(limit) || 50, 200), skip: Number(offset) || 0,
  })
}

module.exports = {
  MOVEMENT_TYPES,
  StockEngineError,
  InsufficientStockError,
  ProductNotFoundError,
  ensurePosition,
  applyMovement,
  initializeStock,
  recordSale,
  restockFromCancellation,
  receiveStock,
  adjustStock,
  recordLoss,
  applyInventoryCount,
  getPosition,
  listMovements,
}
