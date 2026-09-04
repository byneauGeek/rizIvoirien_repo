// LOT 2 : uniquement les modèles + migrations, pas encore de routes (elles
// arrivent aux lots suivants) — ces tests vérifient donc directement via
// Prisma que le schéma se comporte comme prévu (contraintes, valeurs par
// défaut, relations), et que la génération de références est fiable.
const { prisma, createUser } = require('./helpers')
const { nextReference } = require('../src/services/accountingSequence')

describe('Comptabilité — génération de références (§32)', () => {
  test('produit des références séquentielles au format PREFIX-ANNÉE-00000N', async () => {
    const r1 = await nextReference('TEST_SEQ_A')
    const r2 = await nextReference('TEST_SEQ_A')
    const year = new Date().getFullYear()
    expect(r1).toMatch(new RegExp(`^TEST_SEQ_A-${year}-\\d{6}$`))
    const n1 = Number(r1.split('-').pop())
    const n2 = Number(r2.split('-').pop())
    expect(n2).toBe(n1 + 1)
  })

  test('deux préfixes différents ont des compteurs indépendants', async () => {
    const a = await nextReference('TEST_SEQ_B')
    const b = await nextReference('TEST_SEQ_C')
    expect(a.split('-')[2]).toBe('000001')
    expect(b.split('-')[2]).toBe('000001')
  })

  test('résiste à des appels concurrents sans collision (upsert atomique)', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => nextReference('TEST_SEQ_CONCURRENT'))
    )
    const unique = new Set(results)
    expect(unique.size).toBe(20)
  })
})

describe('Comptabilité — modèles financiers (LOT 2)', () => {
  test('TreasuryAccount : valeurs par défaut', async () => {
    const account = await prisma.treasuryAccount.create({ data: { name: 'Caisse principale', type: 'CAISSE' } })
    expect(account.balance).toBe(0)
    expect(account.currency).toBe('XOF')
    expect(account.active).toBe(true)
  })

  test('FinancialTransaction : référence unique obligatoire', async () => {
    const admin = await createUser('ADMIN')
    await prisma.financialTransaction.create({
      data: {
        reference: 'TXN-TEST-0001', type: 'ADJUSTMENT', direction: 'IN', amount: 1000,
        createdBy: admin.id,
      },
    })
    await expect(prisma.financialTransaction.create({
      data: {
        reference: 'TXN-TEST-0001', type: 'ADJUSTMENT', direction: 'IN', amount: 500,
        createdBy: admin.id,
      },
    })).rejects.toThrow()
  })

  test('Debt : statut par défaut OPEN, solde dérivable de initialAmount - paidAmount', async () => {
    const driver = await createUser('DRIVER')
    const debt = await prisma.debt.create({
      data: { beneficiaryUserId: driver.id, sourceType: 'DELIVERY', initialAmount: 5000 },
    })
    expect(debt.status).toBe('OPEN')
    expect(debt.paidAmount).toBe(0)
    expect(debt.initialAmount - debt.paidAmount).toBe(5000)
  })

  test('Receivable : bénéficiaire externe via debtorName quand pas de compte plateforme', async () => {
    const receivable = await prisma.receivable.create({
      data: { debtorName: 'Partenaire externe SARL', sourceType: 'MANUAL', amount: 25000 },
    })
    expect(receivable.debtorUserId).toBeNull()
    expect(receivable.status).toBe('OPEN')
  })

  test('CommissionRule : une règle désactivée ne doit jamais être relue pour un calcul déjà snapshotté', async () => {
    const admin = await createUser('ADMIN')
    const rule = await prisma.commissionRule.create({
      data: { type: 'DELIVERY', rate: 0.15, createdBy: admin.id },
    })
    const driver = await createUser('DRIVER')
    const rem = await prisma.remuneration.create({
      data: {
        reference: await nextReference('REM'),
        beneficiaryUserId: driver.id, beneficiaryType: 'DRIVER',
        periodStart: new Date('2026-09-01'), periodEnd: new Date('2026-09-30'),
        sourceType: 'DELIVERIES', grossAmount: 10000, netAmount: 8500,
        appliedCommissionRate: rule.rate, createdBy: admin.id,
      },
    })
    // La règle change après coup — la rémunération déjà calculée doit garder SA valeur
    await prisma.commissionRule.update({ where: { id: rule.id }, data: { rate: 0.25, status: 'INACTIVE' } })
    const reloaded = await prisma.remuneration.findUnique({ where: { id: rem.id } })
    expect(reloaded.appliedCommissionRate).toBe(0.15)
  })

  test('Remuneration → PaymentOrder → Payment : les 3 objets restent distincts et reliés', async () => {
    const admin = await createUser('ADMIN')
    const driver = await createUser('DRIVER')

    const rem = await prisma.remuneration.create({
      data: {
        reference: await nextReference('REM'),
        beneficiaryUserId: driver.id, beneficiaryType: 'DRIVER',
        periodStart: new Date('2026-09-01'), periodEnd: new Date('2026-09-07'),
        sourceType: 'DELIVERIES', grossAmount: 20000, netAmount: 18000,
        status: 'VALIDATED', createdBy: admin.id, validatedBy: admin.id, validatedAt: new Date(),
      },
    })

    const order = await prisma.paymentOrder.create({
      data: {
        reference: await nextReference('ORD'),
        beneficiaryUserId: driver.id, amount: rem.netAmount, reason: 'Rémunération livreur',
        sourceType: 'REMUNERATION', sourceId: rem.id, remunerationId: rem.id,
        createdBy: admin.id,
      },
    })
    expect(order.status).toBe('PENDING_CONTROL')

    // Un ordre déjà lié à cette rémunération -> deuxième lien impossible (unique)
    await expect(prisma.paymentOrder.create({
      data: {
        reference: await nextReference('ORD'),
        amount: rem.netAmount, reason: 'Doublon', sourceType: 'REMUNERATION',
        remunerationId: rem.id, createdBy: admin.id,
      },
    })).rejects.toThrow()

    const payment = await prisma.payment.create({
      data: {
        reference: await nextReference('PAY'),
        paymentOrderId: order.id, amount: order.amount, method: 'MOBILE_MONEY',
        beneficiaryUserId: driver.id,
      },
    })
    expect(payment.status).toBe('PENDING')

    const fetchedOrder = await prisma.paymentOrder.findUnique({
      where: { id: order.id }, include: { payments: true, remuneration: true },
    })
    expect(fetchedOrder.payments).toHaveLength(1)
    expect(fetchedOrder.remuneration.id).toBe(rem.id)
  })

  test('Expense : workflow de statut par défaut DRAFT', async () => {
    const admin = await createUser('ADMIN')
    const expense = await prisma.expense.create({
      data: { reference: await nextReference('EXP'), category: 'Fournitures', amount: 15000, createdBy: admin.id },
    })
    expect(expense.status).toBe('DRAFT')
  })

  test('AccountingDocument : justificatif attachable à n\'importe quelle cible via targetType/targetId', async () => {
    const admin = await createUser('ADMIN')
    const expense = await prisma.expense.create({
      data: { reference: await nextReference('EXP'), category: 'Test', amount: 1000, createdBy: admin.id },
    })
    const doc = await prisma.accountingDocument.create({
      data: { targetType: 'EXPENSE', targetId: expense.id, docType: 'RECEIPT', url: 'https://example.test/receipt.pdf', uploadedBy: admin.id },
    })
    expect(doc.targetId).toBe(expense.id)

    const docs = await prisma.accountingDocument.findMany({ where: { targetType: 'EXPENSE', targetId: expense.id } })
    expect(docs).toHaveLength(1)
  })
})
