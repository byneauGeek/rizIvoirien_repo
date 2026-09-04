const fs = require('fs')
const path = require('path')

module.exports = async function globalTeardown() {
  // Best-effort : sur Windows, les PrismaClient créés par chaque fichier de
  // test (module registry séparé par fichier) peuvent garder le fichier
  // SQLite verrouillé un instant après la fin des tests. Le fichier est de
  // toute façon supprimé et recréé au prochain `globalSetup`, donc un échec
  // ici n'est pas bloquant.
  const dbPath = path.join(__dirname, '..', 'prisma', 'test.db')
  for (const f of [dbPath, `${dbPath}-journal`]) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch { /* ignore */ }
  }
}
