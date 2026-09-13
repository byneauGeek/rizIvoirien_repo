const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { DATABASE_URL } = require('./testEnv')

// schema.prisma déclare provider = "postgresql" (requis en production,
// Railway) — mais les tests tournent contre une base SQLite jetable, sans
// dépendance à un service Postgres externe pour lancer `npm test` en local.
// Plutôt que de maintenir une DEUXIÈME copie du schéma à la main (risque de
// divergence garanti au premier modèle ajouté et oublié d'un côté), on
// génère cette variante à la volée à partir du VRAI schema.prisma, en ne
// touchant que la ligne du provider — un seul fichier source de vérité.
const REAL_SCHEMA = path.join(__dirname, '..', 'prisma', 'schema.prisma')
const TEST_SCHEMA = path.join(__dirname, '..', 'prisma', 'schema.test.prisma')

function writeTestSchema() {
  const real = fs.readFileSync(REAL_SCHEMA, 'utf8')
  const test = real.replace('provider = "postgresql"', 'provider = "sqlite"')
  if (test === real) {
    throw new Error('schema.test.prisma : provider "postgresql" introuvable dans schema.prisma — le générateur de schéma de test (tests/globalSetup.js) est à revoir.')
  }
  fs.writeFileSync(TEST_SCHEMA, test)
}

module.exports = async function globalSetup() {
  const dbPath = path.join(__dirname, '..', 'prisma', 'test.db')
  for (const f of [dbPath, `${dbPath}-journal`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }

  writeTestSchema()

  const cwd = path.join(__dirname, '..')
  const env = { ...process.env, DATABASE_URL }

  // Régénère @prisma/client contre le schéma SQLite pour la durée des tests
  // — lib/prisma.js (l'app) ET tests/helpers.js importent tous les deux
  // `@prisma/client` par défaut, sans savoir lequel des deux schémas l'a
  // généré ; c'est justement ce qui permet de ne modifier AUCUN des deux.
  // globalTeardown.js régénère le client réel (postgresql) une fois les
  // tests terminés, pour que `npm run dev`/`npm start` en local retrouvent
  // un client cohérent avec schema.prisma.
  execSync(`npx prisma generate --schema=${TEST_SCHEMA}`, { cwd, env, stdio: 'inherit' })
  execSync(`npx prisma db push --skip-generate --schema=${TEST_SCHEMA} --accept-data-loss`, { cwd, env, stdio: 'inherit' })
}
