// LOT 17 : recrée une base SQLite dédiée (e2e.db, jamais dev.db ni test.db)
// avant de lancer les serveurs — même schéma que dev.db (db push, pas
// d'historique de migration à gérer, cf. tests/globalSetup.js côté backend
// qui suit exactement le même principe pour test.db).
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BACKEND_DIR = path.join(__dirname, '..', 'backend')
const DB_PATH = path.join(BACKEND_DIR, 'prisma', 'e2e.db')
const DATABASE_URL = 'file:' + DB_PATH

module.exports = async function globalSetup() {
  for (const f of [DB_PATH, `${DB_PATH}-journal`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }

  const env = { ...process.env, DATABASE_URL }

  execSync('npx prisma db push --skip-generate --schema=prisma/schema.prisma --accept-data-loss', {
    cwd: BACKEND_DIR, env, stdio: 'inherit',
  })
  execSync('node scripts/e2eSeed.js', { cwd: BACKEND_DIR, env, stdio: 'inherit' })
}
