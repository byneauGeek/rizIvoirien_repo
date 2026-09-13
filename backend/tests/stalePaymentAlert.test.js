// Phase 2 (post-audit) : GET /controls/stale-payments était purement
// diagnostique — personne n'était jamais alerté. checkStalePayments() ferme
// ce trou (relance uniquement, jamais d'auto-décision PAID/FAILED — cf.
// commentaire du service).
const { prisma, createUser } = require('./helpers')
const { checkStalePayments, STALE_HOURS } = require('../src/services/stalePaymentAlert')

async function createStuckPayment(createdAt, overrides = {}) {
  const creator = await createUser('ADMIN')
  const order = await prisma.paymentOrder.create({
    data: { reference: `ORD-TEST-${Date.now()}-${Math.random()}`, beneficiaryName: 'Test', amount: 1000, reason: 'Test', sourceType: 'MANUAL', status: 'PROCESSING', createdBy: creator.id },
  })
  return prisma.payment.create({
    data: {
      reference: `PAY-TEST-${Date.now()}-${Math.random()}`, paymentOrderId: order.id, amount: 1000,
      beneficiaryName: 'Test', method: 'BANK_TRANSFER', status: 'PROCESSING', createdAt, ...overrides,
    },
  })
}

describe('checkStalePayments', () => {
  test('alerte un paiement PROCESSING au-delà du seuil, une seule fois', async () => {
    // NB : les tests tournent tous contre la même base SQLite partagée sur
    // toute la durée de `npm test` (aucune réinitialisation entre fichiers) —
    // un autre fichier (ex. accountingControls.test.js) peut déjà avoir créé
    // son propre paiement PROCESSING ancien avant que ce test ne s'exécute.
    // On vérifie donc le comportement sur NOTRE paiement précisément, jamais
    // un compte global exact.
    const admin = await createUser('ADMIN')
    const old = new Date(Date.now() - (STALE_HOURS + 1) * 60 * 60 * 1000)
    const payment = await createStuckPayment(old)

    const first = await checkStalePayments()
    expect(first.alerted).toBeGreaterThanOrEqual(1)

    const refreshed = await prisma.payment.findUnique({ where: { id: payment.id } })
    expect(refreshed.staleAlertedAt).toBeTruthy()

    // D'autres paiements bloqués (créés par un autre fichier de test partageant
    // la même base) peuvent aussi générer une notification STALE_PAYMENT pour
    // ce même admin — on cible précisément celle de NOTRE paiement via sa
    // référence, jamais "la première notification STALE_PAYMENT trouvée".
    const notif = await prisma.notification.findFirst({ where: { userId: admin.id, type: 'STALE_PAYMENT', message: { contains: payment.reference } } })
    expect(notif).toBeTruthy()

    // Deuxième passage : déjà alerté, pas de deuxième notification pour CE paiement.
    await checkStalePayments()
    const notifCount = await prisma.notification.count({ where: { userId: admin.id, type: 'STALE_PAYMENT', message: { contains: payment.reference } } })
    expect(notifCount).toBe(1)
  })

  test('ignore les paiements PROCESSING encore récents', async () => {
    const recent = new Date()
    await createStuckPayment(recent)
    const result = await checkStalePayments()
    expect(result.alerted).toBe(0)
  })

  test('ignore les paiements déjà PAID/FAILED même anciens', async () => {
    const old = new Date(Date.now() - (STALE_HOURS + 1) * 60 * 60 * 1000)
    await createStuckPayment(old, { status: 'PAID' })
    const result = await checkStalePayments()
    expect(result.alerted).toBe(0)
  })
})
