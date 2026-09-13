const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Les tests tournent contre SQLite (tests/globalSetup.js), sensiblement
  // plus lent que Postgres sur une transaction interactive qui enchaîne
  // plusieurs requêtes séquentielles (ex. POST /orders : vérif stock +
  // décrément par article) — largement sous les 5s par défaut en
  // production, mais dépasse régulièrement ce seuil en environnement de
  // test. Ne s'applique jamais en production (NODE_ENV !== 'test' là-bas).
  ...(process.env.NODE_ENV === 'test' ? { transactionOptions: { timeout: 20000 } } : {}),
})

module.exports = prisma
