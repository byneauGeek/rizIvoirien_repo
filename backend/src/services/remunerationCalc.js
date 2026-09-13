// Calcul PARTAGÉ des gains livreur/vendeur sur une période donnée.
//
// Avant ce fichier, GET /admin/drivers/:id/payslip et GET /admin/shops/:id/payslip
// (vue Commercial, estimation affichée à un agent) et
// calculateDriverRemuneration/calculateSellerRemuneration dans remuneration.js
// (LOT 3, le calcul RÉEL qui produit un Remuneration payé) étaient deux
// implémentations séparées censées faire "exactement la même chose" (cf.
// commentaire d'origine dans remuneration.js), mais avaient divergé sur deux
// points concrets :
//   1. Le payslip vendeur utilisait le taux plat settings.commissionRate,
//      jamais sellerRate(settings, shop.plan) — une boutique CERTIFIÉE
//      voyait un chiffre "Commercial" faux (5% au lieu du 3% réellement
//      appliqué par la Comptabilité).
//   2. Le calcul RÉEL de rémunération livreur (remuneration.js) ne comptait
//      que les commandes B2C (Order) — jamais les livraisons B2B (Shipment),
//      pourtant déjà incluses dans le payslip Commercial. Un livreur ayant
//      fait des livraisons B2B pendant la période était sous-payé par le
//      calcul réel par rapport à ce que sa fiche affichait.
// Un seul calcul, utilisé par les deux écrans, ferme définitivement ces deux
// écarts plutôt que de les corriger séparément et risquer qu'ils redivergent.
const prisma = require('../lib/prisma')
const { getSettings, driverRate, sellerRate } = require('../lib/settings')

async function computeDriverEarnings(driverId, startDate, endDate) {
  const [settings, driver] = await Promise.all([
    getSettings(),
    prisma.driver.findUnique({ where: { id: driverId }, include: { user: { select: { name: true, email: true, phone: true } } } }),
  ])
  if (!driver) return { error: 'Livreur introuvable' }

  const driverShare = driverRate(settings, driver.plan)
  const platformShare = 1 - driverShare

  const [orders, b2bShipments] = await Promise.all([
    prisma.order.findMany({
      where: { driverId, status: 'DELIVERED', updatedAt: { gte: startDate, lte: endDate } },
      include: {
        buyer: { select: { name: true } },
        shop: { select: { name: true } },
        statusHistory: { where: { status: 'DELIVERED' }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shipment.findMany({
      where: { driverId, status: 'DELIVERED', b2bTransactionId: { not: null }, updatedAt: { gte: startDate, lte: endDate } },
      include: { b2bTransaction: { include: { buyer: { select: { name: true } }, seller: { select: { name: true } } } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  const grossDeliveryFeesB2C = orders.reduce((s, o) => s + (o.deliveryFee || 0), 0)
  const grossDeliveryFeesB2B = b2bShipments.reduce((s, sh) => s + (sh.b2bTransaction?.deliveryFee || 0), 0)
  const grossDeliveryFees = grossDeliveryFeesB2C + grossDeliveryFeesB2B
  const driverEarnings = Math.round(grossDeliveryFees * driverShare)
  const platformEarnings = Math.round(grossDeliveryFees * platformShare)

  return {
    driver, driverShare, platformShare,
    totalDeliveries: orders.length + b2bShipments.length,
    grossDeliveryFees, driverEarnings, platformEarnings,
    orders, b2bShipments,
  }
}

async function computeSellerEarnings(shopId, startDate, endDate) {
  const [settings, shop] = await Promise.all([
    getSettings(),
    prisma.shop.findUnique({ where: { id: shopId }, include: { user: { select: { name: true, email: true, phone: true } } } }),
  ])
  if (!shop) return { error: 'Boutique introuvable' }

  const rate = sellerRate(settings, shop.plan)

  const orders = await prisma.order.findMany({
    where: { shopId, status: 'DELIVERED', updatedAt: { gte: startDate, lte: endDate } },
    include: {
      buyer: { select: { name: true } },
      statusHistory: { where: { status: 'DELIVERED' }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })

  const grossRevenue = orders.reduce((s, o) => s + (o.total || 0), 0)
  const platformFees = Math.round(grossRevenue * rate)
  const vendorEarnings = grossRevenue - platformFees

  return { shop, commissionRate: rate, totalOrders: orders.length, grossRevenue, platformFees, vendorEarnings, orders }
}

module.exports = { computeDriverEarnings, computeSellerEarnings }
