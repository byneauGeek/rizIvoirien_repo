const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { DATABASE_URL } = require('./testEnv')

// Recrée une base de test SQLite vierge à partir du schema.prisma actuel,
// via `prisma db push` (pas de connexion réseau requise, pas d'historique de
// migration à gérer — adapté à une base de test jetable).
module.exports = async function globalSetup() {
  const dbPath = path.join(__dirname, '..', 'prisma', 'test.db')
  for (const f of [dbPath, `${dbPath}-journal`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }

  execSync('npx prisma db push --skip-generate --schema=prisma/schema.prisma --accept-data-loss', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL },
    stdio: 'inherit',
  })
}
