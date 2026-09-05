// Stock Engine — LOT 1 : bascule initiale.
//
// Crée, pour chaque Product existant sans StockPosition, une StockPosition
// dont la quantité = Product.stock (valeur actuelle, jamais modifiée par ce
// script), et un StockMovement fondateur de type INITIAL_STOCK qui trace
// cette valeur de départ (plan de migration de l'audit LOT 0, §0.11).
//
// Purement additif : ne modifie ni ne supprime aucune ligne de Product.
// Idempotent : un produit qui a déjà une StockPosition est ignoré (skip),
// donc ré-exécuter ce script après un ajout de nouveaux produits ne
// duplique rien.
//
// Usage : node scripts/backfillStockPositions.js
const prisma = require('../src/lib/prisma')

async function main() {
  const products = await prisma.product.findMany({
    where: { stockPosition: null },
    select: { id: true, name: true, stock: true },
  })

  console.log(`${products.length} produit(s) sans StockPosition à initialiser.`)

  let created = 0
  for (const product of products) {
    await prisma.$transaction(async (tx) => {
      const position = await tx.stockPosition.create({
        data: { productId: product.id, quantity: product.stock },
      })
      await tx.stockMovement.create({
        data: {
          stockPositionId: position.id,
          productId: product.id,
          type: 'INITIAL_STOCK',
          quantity: product.stock,
          quantityBefore: 0,
          quantityAfter: product.stock,
          sourceType: 'MIGRATION',
          reason: 'Bascule initiale LOT 1 — valeur reprise de Product.stock',
        },
      })
    })
    created++
  }

  console.log(`${created} StockPosition créée(s).`)

  // Vérification post-migration (§0.11 point 8 de l'audit) : StockPosition.quantity
  // doit être strictement égal à Product.stock pour chaque produit, puisqu'aucun
  // mouvement autre que INITIAL_STOCK n'a encore eu lieu.
  const mismatches = await prisma.$queryRaw`
    SELECT p.id, p.name, p.stock AS productStock, sp.quantity AS positionQuantity
    FROM "Product" p
    JOIN "StockPosition" sp ON sp."productId" = p.id
    WHERE p.stock != sp.quantity
  `
  if (mismatches.length > 0) {
    console.error(`⚠ ${mismatches.length} écart(s) détecté(s) entre Product.stock et StockPosition.quantity :`)
    console.error(mismatches)
    process.exitCode = 1
  } else {
    console.log('✅ Vérification OK : StockPosition.quantity = Product.stock pour tous les produits.')
  }
}

if (require.main === module) {
  main()
    .catch((e) => { console.error(e); process.exitCode = 1 })
    .finally(() => prisma.$disconnect())
}

module.exports = { main }
