// Phase 2 (post-audit) : la fiche de paie Commercial (GET /admin/.../payslip)
// et le calcul RÉEL de rémunération (POST /accounting/remunerations/calculate)
// utilisaient deux implémentations séparées qui avaient divergé sur deux
// points précis (cf. services/remunerationCalc.js). Ces tests prouvent que
// les deux écrans donnent maintenant EXACTEMENT le même chiffre.
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

async function makeAccountant(admin, permissions) {
  const user = await createUser('ACCOUNTANT')
  await request(app).put(`/api/admin/accounting/accountants/${user.id}/permissions`)
    .set('Authorization', `Bearer ${signToken(admin)}`).send({ permissions })
  return user
}
async function makeBuyer() { return createUser('BUYER') }

// GET /admin/.../payslip?period=monthly calcule sa fenêtre par rapport à
// "maintenant" (début du mois civil en cours), contrairement à
// POST /remunerations/calculate qui prend periodStart/periodEnd explicites —
// une date de commande codée en dur (ex. '2026-08-15') ne tombe dans la
// fenêtre "monthly" du payslip que si le test tourne en août 2026. Ces deux
// fonctions calculent donc tout par rapport à la vraie date d'exécution.
function currentMonthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  // periodEnd = "maintenant" (pas fin de mois) : suffit à couvrir la commande
  // créée juste après, sans dépendre d'un jour du mois précis (fin de mois
  // civil aurait pu tomber AVANT "now" si le test tourne le dernier jour du mois).
  return { now, periodStartIso: start.toISOString(), periodEndIso: new Date(now.getTime() + 60000).toISOString() }
}

describe('Réconciliation payslip Commercial ↔ rémunération Comptabilité', () => {
  test('une boutique CERTIFIÉE : le payslip Commercial et le calcul réel appliquent le même taux réduit', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await makeAccountant(admin, ['accounting.payroll.create'])
    const buyer = await makeBuyer()
    const { user: sellerUser, shop } = await createShopUser()
    await prisma.shop.update({ where: { id: shop.id }, data: { plan: 'CERTIFIED' } })
    await prisma.platformSettings.upsert({
      where: { id: 1 }, create: { id: 1, commissionRate: 0.05, certifiedCommissionRate: 0.03 },
      update: { commissionRate: 0.05, certifiedCommissionRate: 0.03 },
    })

    const { now, periodStartIso, periodEndIso } = currentMonthBounds()
    await prisma.order.create({
      data: { buyerId: buyer.id, shopId: shop.id, status: 'DELIVERED', total: 10000, deliveryFee: 0, address: 'A', updatedAt: now },
    })

    const payslip = await request(app).get(`/api/admin/shops/${shop.id}/payslip?period=monthly`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    // Avant la réconciliation, ceci renvoyait 0.05 (taux plat) même pour une
    // boutique CERTIFIÉE.
    expect(payslip.body.commissionRate).toBe(0.03)
    expect(payslip.body.platformFees).toBe(300)
    expect(payslip.body.vendorEarnings).toBe(9700)

    const calc = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(accountant)}`)
      .send({ beneficiaryUserId: sellerUser.id, beneficiaryType: 'SELLER', periodStart: periodStartIso, periodEnd: periodEndIso })
    expect(calc.body.appliedCommissionRate).toBe(0.03)
    expect(calc.body.netAmount).toBe(9700)

    // Même chiffre des deux côtés — c'est le point de ce lot.
    expect(payslip.body.vendorEarnings).toBe(calc.body.netAmount)
  })

  test('un livreur avec des livraisons B2B : le calcul réel les inclut désormais, comme le payslip Commercial', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await makeAccountant(admin, ['accounting.payroll.create'])
    const buyer = await makeBuyer()
    const { shop } = await createShopUser()
    const { user: driverUser, driver } = await createDriverUser({ driverData: { plan: 'BASIC' } })

    const { now, periodStartIso, periodEndIso } = currentMonthBounds()
    await prisma.order.create({
      data: { buyerId: buyer.id, shopId: shop.id, driverId: driver.id, status: 'DELIVERED', total: 5000, deliveryFee: 1000, address: 'A', updatedAt: now },
    })

    const b2bBuyer = await createUser('TRADER')
    const b2bSeller = await createUser('COOPERATIVE')
    const tx = await prisma.b2BTransaction.create({
      data: {
        buyerUserId: b2bBuyer.id, sellerUserId: b2bSeller.id, product: 'Riz paddy', quantity: 1, unit: 'tonne',
        region: 'TestRegion', deliveryFee: 4000, status: 'DELIVERED',
      },
    })
    await prisma.shipment.create({
      data: { b2bTransactionId: tx.id, driverId: driver.id, status: 'DELIVERED', dropoffAddress: 'Entrepot', updatedAt: now },
    })

    const settings = await prisma.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })

    const payslip = await request(app).get(`/api/admin/drivers/${driver.id}/payslip?period=monthly`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(payslip.body.grossDeliveryFees).toBe(5000) // 1000 B2C + 4000 B2B

    const calc = await request(app).post('/api/accounting/remunerations/calculate')
      .set('Authorization', `Bearer ${signToken(accountant)}`)
      .send({ beneficiaryUserId: driverUser.id, beneficiaryType: 'DRIVER', periodStart: periodStartIso, periodEnd: periodEndIso })
    // Avant la réconciliation, ceci ne comptait que les 1000 FCFA B2C.
    expect(calc.body.grossAmount).toBe(5000)
    expect(calc.body.netAmount).toBe(Math.round(5000 * settings.driverCommission))

    expect(payslip.body.driverEarnings).toBe(calc.body.netAmount)
  })
})
