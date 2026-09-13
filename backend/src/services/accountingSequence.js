// Génération sûre, côté serveur, des références uniques des documents
// comptables (§32) : PAY-2026-000001, REM-2026-000001, etc. — jamais côté
// frontend. Une ligne AccountingSequence par préfixe+année, incrémentée par
// un upsert atomique unique (safe même sous requêtes concurrentes : c'est une
// seule instruction SQL, pas de lecture puis écriture séparées).
const prisma = require('../lib/prisma')

// `client` : le client Prisma à utiliser pour l'upsert — le global par
// défaut, ou le `tx` d'une transaction interactive en cours si l'appelant en
// a une ouverte (ex. orders.js crée la commande ET sa référence dans la même
// transaction). Sans ce paramètre, un appel depuis l'intérieur d'un
// `prisma.$transaction(async (tx) => …)` ouvrirait une DEUXIÈME connexion en
// parallèle de celle qui tient déjà un verrou d'écriture — inoffensif sous
// Postgres (MVCC), mais un deadlock garanti sous SQLite (un seul writer à la
// fois) : c'est exactement ce qui empêchait POST /orders de fonctionner
// contre la base de test SQLite avant ce correctif. Au-delà du blocage
// SQLite, séparer les deux connexions cassait aussi l'atomicité réelle :
// un rollback de la transaction appelante ne défaisait pas l'incrément du
// compteur, qui restait donc "brûlé" même si la commande n'était jamais créée.
async function nextReference(prefix, client = prisma) {
  const year = new Date().getFullYear()
  const key = `${prefix}-${year}`
  const seq = await client.accountingSequence.upsert({
    where: { key },
    update: { counter: { increment: 1 } },
    create: { key, counter: 1 },
  })
  return `${key}-${String(seq.counter).padStart(6, '0')}`
}

// LOT NUMEROTATION (retour utilisateur — v2) : le format CMD-2026-000001
// jugé "trop générique" ; remplacé par des initiales de boutique + un
// compteur PROPRE À CETTE BOUTIQUE (ex. RDB-0001, RDB-0002...), plus
// parlant pour identifier le vendeur concerné. Réutilise la même table
// AccountingSequence (upsert atomique déjà éprouvé) avec une clé par
// boutique plutôt que par préfixe+année — pas un nouveau mécanisme.
function shopInitials(name) {
  const clean = (name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
    .replace(/[^a-zA-Z\s]/g, '') // ne garde que les lettres
  const words = clean.trim().split(/\s+/).filter(Boolean)
  const initials = words.length >= 2
    ? words.slice(0, 3).map(w => w[0]).join('')
    : (words[0] || 'BTQ').slice(0, 3)
  return (initials || 'BTQ').toUpperCase()
}

async function nextShopOrderNumber(shopId, shopName, client = prisma) {
  const key = `ORDER-SHOP-${shopId}`
  const seq = await client.accountingSequence.upsert({
    where: { key },
    update: { counter: { increment: 1 } },
    create: { key, counter: 1 },
  })
  return `${shopInitials(shopName)}-${String(seq.counter).padStart(4, '0')}`
}

module.exports = { nextReference, nextShopOrderNumber, shopInitials }
