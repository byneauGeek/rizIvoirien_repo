// LOT 17 (logistique) : fixture pour le test E2E du cycle de livraison
// complet (offre -> acceptation -> en route -> code -> livrée). Tourne
// contre une base SQLite dédiée (e2e.db, jamais dev.db ni test.db), fournie
// via DATABASE_URL par playwright.config.js — jamais lancé directement.
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()
const PASSWORD = 'Password123!'

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10)
  const ts = Date.now()

  const buyerUser = await prisma.user.create({
    data: { email: `e2e-buyer-${ts}@rizivoirien.test`, password: hash, name: 'Acheteur E2E', role: 'BUYER', emailVerified: true },
  })
  const sellerUser = await prisma.user.create({
    data: { email: `e2e-seller-${ts}@rizivoirien.test`, password: hash, name: 'Vendeur E2E', role: 'SELLER', emailVerified: true },
  })
  const shop = await prisma.shop.create({
    data: {
      userId: sellerUser.id, name: 'Boutique E2E', slug: `boutique-e2e-${ts}`,
      status: 'ACTIVE', active: true, contractSigned: true, phone: '0700000000',
    },
  })
  const product = await prisma.product.create({
    data: { shopId: shop.id, name: 'Riz E2E', slug: `riz-e2e-${ts}`, category: 'Riz', price: 5000, stock: 20, active: true },
  })
  await prisma.stockPosition.create({ data: { productId: product.id, quantity: 20 } })

  const driverUser = await prisma.user.create({
    data: { email: `e2e-driver-${ts}@rizivoirien.test`, password: hash, name: 'Livreur E2E', role: 'DRIVER', emailVerified: true },
  })
  const driver = await prisma.driver.create({
    data: { userId: driverUser.id, inviteCode: `E2E-${ts}`, status: 'ACTIVE', online: true, available: true, contractSigned: true },
  })

  const order = await prisma.order.create({
    data: {
      buyerId: buyerUser.id, shopId: shop.id, status: 'PRET', total: 10000, deliveryFee: 1200,
      address: 'Cocody, Abidjan', paymentMethod: 'CASH_ON_DELIVERY',
      items: { create: { productId: product.id, quantity: 2, price: 5000, name: product.name } },
    },
  })
  const offer = await prisma.driverOffer.create({
    data: { orderId: order.id, driverId: driver.id, status: 'PENDING', attempt: 1, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  })

  const fixtures = {
    buyer: { email: buyerUser.email, password: PASSWORD },
    driver: { email: driverUser.email, password: PASSWORD },
    orderId: order.id,
    offerId: offer.id,
  }
  fs.writeFileSync(path.join(__dirname, '..', '..', 'e2e', '.fixtures.json'), JSON.stringify(fixtures, null, 2))
  console.log('E2E fixtures:', fixtures)
}

main().finally(() => prisma.$disconnect())
