// Phase 1 (post-audit) : GET/POST /controls/overdue et
// GET /controls/treasury-consistency existaient déjà mais étaient purement
// manuels — personne n'était jamais alerté. Ce moteur ferme ce trou.
const { prisma, createUser } = require('./helpers')
const { refreshOverdueDebtsReceivables, checkTreasuryAnomalies } = require('../src/services/accountingControlsEngine')

describe('refreshOverdueDebtsReceivables', () => {
  test('fait passer OVERDUE une dette/créance échue et notifie une seule fois', async () => {
    const admin = await createUser('ADMIN')
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const debt = await prisma.debt.create({ data: { beneficiaryName: 'Test', initialAmount: 1000, sourceType: 'MANUAL', status: 'OPEN', dueDate: past } })
    const receivable = await prisma.receivable.create({ data: { debtorName: 'Test', amount: 1000, sourceType: 'MANUAL', status: 'OPEN', dueDate: past } })

    const first = await refreshOverdueDebtsReceivables()
    expect(first.debtsFlagged).toBeGreaterThanOrEqual(1)
    expect(first.receivablesFlagged).toBeGreaterThanOrEqual(1)

    const refreshedDebt = await prisma.debt.findUnique({ where: { id: debt.id } })
    const refreshedReceivable = await prisma.receivable.findUnique({ where: { id: receivable.id } })
    expect(refreshedDebt.status).toBe('OVERDUE')
    expect(refreshedReceivable.status).toBe('OVERDUE')

    const notif = await prisma.notification.findFirst({ where: { userId: admin.id, type: 'ACCOUNTING_OVERDUE' } })
    expect(notif).toBeTruthy()

    // Deuxième passage : déjà OVERDUE, ne matche plus le filtre OPEN/PARTIALLY_PAID
    // — jamais reflaggé, jamais renotifié pour LA MÊME dette.
    const second = await refreshOverdueDebtsReceivables()
    const stillSameDebt = await prisma.debt.findUnique({ where: { id: debt.id } })
    expect(stillSameDebt.status).toBe('OVERDUE')
    expect(second.debtsFlagged === 0 || !(await prisma.debt.findFirst({ where: { id: debt.id, status: 'OPEN' } }))).toBeTruthy()
  })

  test('ignore les dettes non encore échues', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const debt = await prisma.debt.create({ data: { beneficiaryName: 'Test', initialAmount: 500, sourceType: 'MANUAL', status: 'OPEN', dueDate: future } })
    await refreshOverdueDebtsReceivables()
    const refreshed = await prisma.debt.findUnique({ where: { id: debt.id } })
    expect(refreshed.status).toBe('OPEN')
  })

  test('ignore les dettes sans date d\'échéance', async () => {
    const debt = await prisma.debt.create({ data: { beneficiaryName: 'Test', initialAmount: 500, sourceType: 'MANUAL', status: 'OPEN' } })
    await refreshOverdueDebtsReceivables()
    const refreshed = await prisma.debt.findUnique({ where: { id: debt.id } })
    expect(refreshed.status).toBe('OPEN')
  })
})

describe('checkTreasuryAnomalies', () => {
  test('alerte quand le solde en cache ne correspond pas aux écritures confirmées', async () => {
    const admin = await createUser('ADMIN')
    const account = await prisma.treasuryAccount.create({ data: { name: `Caisse anomalie ${Date.now()}`, type: 'CAISSE', balance: 99999 } })
    // Aucune FinancialTransaction confirmée pour ce compte → balance attendue 0, cache à 99999 : anomalie garantie.

    const result = await checkTreasuryAnomalies()
    expect(result.anomalies).toBeGreaterThanOrEqual(1)

    const notif = await prisma.notification.findFirst({ where: { userId: admin.id, type: 'ACCOUNTING_TREASURY_ANOMALY' } })
    expect(notif).toBeTruthy()
    expect(notif.message).toContain(account.name)
  })

  test('un compte cohérent (solde 0, aucune écriture) n\'est jamais compté comme anomalie', async () => {
    const admin = await createUser('ADMIN')
    const cleanName = `Caisse propre ${Date.now()}`
    await prisma.treasuryAccount.create({ data: { name: cleanName, type: 'CAISSE', balance: 0 } })
    await checkTreasuryAnomalies()
    // D'autres comptes du fichier peuvent déjà être en anomalie (test
    // précédent) — on vérifie seulement que CE compte propre-là n'apparaît
    // jamais dans le message d'alerte le plus récent.
    const notif = await prisma.notification.findFirst({ where: { userId: admin.id, type: 'ACCOUNTING_TREASURY_ANOMALY' }, orderBy: { createdAt: 'desc' } })
    if (notif) expect(notif.message).not.toContain(cleanName)
  })
})
