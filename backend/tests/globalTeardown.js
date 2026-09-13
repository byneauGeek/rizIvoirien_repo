const { spawn } = require('child_process')
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

  const testSchema = path.join(__dirname, '..', 'prisma', 'schema.test.prisma')
  try { if (fs.existsSync(testSchema)) fs.unlinkSync(testSchema) } catch { /* ignore */ }

  // Remet @prisma/client dans l'état attendu par le reste du projet (schéma
  // réel, provider postgresql) — sans ça, `npm run dev`/`npm start` en local
  // resteraient câblés sur le client SQLite généré pour les tests jusqu'à ce
  // que quelqu'un pense à relancer `npx prisma generate` à la main. Délégué à
  // un process détaché (regenerateRealClient.js) : le moteur natif Prisma
  // reste verrouillé tant que CE process Jest n'a pas complètement terminé,
  // donc réessayer ici, dans globalTeardown, échouerait toujours.
  const child = spawn(process.execPath, [path.join(__dirname, 'regenerateRealClient.js')], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}
