const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const signToken = (user) => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' })

let counter = 0
const uniqueEmail = (label) => `${label}-${Date.now()}-${counter++}@rizivoirien.test`

async function createUser(role, overrides = {}) {
  const email = overrides.email || uniqueEmail(role.toLowerCase())
  const password = await bcrypt.hash('Password123!', 10)
  return prisma.user.create({
    data: { email, password, name: overrides.name || `${role} test`, role, ...overrides.data },
  })
}

async function createShopUser(overrides = {}) {
  const user = await createUser('SELLER', overrides)
  const shop = await prisma.shop.create({
    data: {
      userId: user.id,
      name: overrides.shopName || `Shop ${user.id}`,
      slug: `shop-${user.id}-${Date.now()}`,
      phone: '0700000000',
      status: 'ACTIVE',
      active: true,
      contractSigned: true,
    },
  })
  return { user, shop }
}

async function createDriverUser(overrides = {}) {
  const user = await createUser('DRIVER', overrides)
  const driver = await prisma.driver.create({
    data: {
      userId: user.id,
      inviteCode: `INV-${user.id}-${Date.now()}`,
      status: 'ACTIVE',
      online: true,
      available: true,
      rating: 5,
      acceptanceRate: 1,
      ...overrides.driverData,
    },
  })
  return { user, driver }
}

// De nombreuses routes journalisent (logAction/notify) via
// `setImmediate(() => …)` — délibéré, pour ne jamais faire attendre la
// réponse HTTP sur une écriture d'audit non critique. Un test qui vérifie
// CE genre d'effet de bord juste après avoir reçu la réponse peut donc, sous
// charge (ex. la suite complète, 500+ tests), l'interroger avant qu'il ne
// soit écrit — pas une histoire de données partagées entre fichiers, un pur
// timing. `waitFor` sonde la condition au lieu de la lire une seule fois.
async function waitFor(check, { timeout = 2000, interval = 20 } = {}) {
  const deadline = Date.now() + timeout
  for (;;) {
    const result = await check()
    if (result) return result
    if (Date.now() >= deadline) return result
    await new Promise((r) => setTimeout(r, interval))
  }
}

module.exports = { prisma, signToken, createUser, createShopUser, createDriverUser, uniqueEmail, waitFor }
