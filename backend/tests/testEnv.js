const path = require('path')

// Base SQLite de test, séparée de dev.db — recréée à chaque run via globalSetup.js.
module.exports = {
  DATABASE_URL: 'file:' + path.join(__dirname, '..', 'prisma', 'test.db'),
  JWT_SECRET: 'test-only-secret-never-use-in-production',
}
