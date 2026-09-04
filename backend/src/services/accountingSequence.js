// Génération sûre, côté serveur, des références uniques des documents
// comptables (§32) : PAY-2026-000001, REM-2026-000001, etc. — jamais côté
// frontend. Une ligne AccountingSequence par préfixe+année, incrémentée par
// un upsert atomique unique (safe même sous requêtes concurrentes : c'est une
// seule instruction SQL, pas de lecture puis écriture séparées).
const prisma = require('../lib/prisma')

async function nextReference(prefix) {
  const year = new Date().getFullYear()
  const key = `${prefix}-${year}`
  const seq = await prisma.accountingSequence.upsert({
    where: { key },
    update: { counter: { increment: 1 } },
    create: { key, counter: 1 },
  })
  return `${key}-${String(seq.counter).padStart(6, '0')}`
}

module.exports = { nextReference }
