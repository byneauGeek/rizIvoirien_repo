// LOT SUPPORT (retour utilisateur) — jamais testé depuis sa livraison.
// Couvre le gel de priorité à l'ouverture (resolveTicketPriority), le fil de
// discussion utilisateur, et la file d'attente triée priorité-d'abord côté
// admin/commercial.
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

async function openTicket(user, overrides = {}) {
  return request(app).post('/api/support/tickets')
    .set('Authorization', `Bearer ${signToken(user)}`)
    .send({ subject: 'Problème de test', message: 'Un message de test suffisamment long.', ...overrides })
}

describe('Ouverture de ticket — priorité gelée selon le plan RÉEL au moment de l\'ouverture', () => {
  test('un acheteur est toujours NORMAL', async () => {
    const buyer = await createUser('BUYER')
    const res = await openTicket(buyer)
    expect(res.status).toBe(201)
    expect(res.body.priority).toBe('NORMAL')
  })

  test('un vendeur BASIC est NORMAL, un vendeur CERTIFIÉ est PRIORITY', async () => {
    const { user: basicSeller } = await createShopUser()
    const basic = await openTicket(basicSeller)
    expect(basic.body.priority).toBe('NORMAL')

    const { user: certifiedSeller, shop } = await createShopUser()
    await prisma.shop.update({ where: { id: shop.id }, data: { plan: 'CERTIFIED' } })
    const certified = await openTicket(certifiedSeller)
    expect(certified.body.priority).toBe('PRIORITY')
  })

  test('un livreur BASIC est NORMAL, un livreur PREMIUM est PRIORITY', async () => {
    const { user: basicDriver } = await createDriverUser({ driverData: { plan: 'BASIC' } })
    const basic = await openTicket(basicDriver)
    expect(basic.body.priority).toBe('NORMAL')

    const { user: premiumDriver } = await createDriverUser({ driverData: { plan: 'PREMIUM' } })
    const premium = await openTicket(premiumDriver)
    expect(premium.body.priority).toBe('PRIORITY')
  })

  test('un vendeur qui passe CERTIFIÉ après coup ne change jamais la priorité d\'un ticket déjà ouvert', async () => {
    const { user: seller, shop } = await createShopUser()
    const ticket = await openTicket(seller)
    expect(ticket.body.priority).toBe('NORMAL')

    await prisma.shop.update({ where: { id: shop.id }, data: { plan: 'CERTIFIED' } })
    const refreshed = await prisma.supportTicket.findUnique({ where: { id: ticket.body.id } })
    expect(refreshed.priority).toBe('NORMAL')
  })

  test('sujet ou message manquant rejeté ; message trop long rejeté', async () => {
    const buyer = await createUser('BUYER')
    const noSubject = await openTicket(buyer, { subject: '' })
    expect(noSubject.status).toBe(400)
    const tooLong = await openTicket(buyer, { message: 'x'.repeat(4001) })
    expect(tooLong.status).toBe(400)
  })
})

describe('Fil de discussion utilisateur', () => {
  test('liste ses propres tickets, pas ceux des autres', async () => {
    const buyer = await createUser('BUYER')
    const other = await createUser('BUYER')
    await openTicket(buyer)
    await openTicket(other)

    const res = await request(app).get('/api/support/tickets').set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
  })

  test('ne peut pas lire ou répondre au ticket d\'un autre utilisateur', async () => {
    const buyer = await createUser('BUYER')
    const other = await createUser('BUYER')
    const ticket = await openTicket(buyer)

    const read = await request(app).get(`/api/support/tickets/${ticket.body.id}/messages`)
      .set('Authorization', `Bearer ${signToken(other)}`)
    expect(read.status).toBe(404)

    const reply = await request(app).post(`/api/support/tickets/${ticket.body.id}/messages`)
      .set('Authorization', `Bearer ${signToken(other)}`).send({ content: 'Intrusion' })
    expect(reply.status).toBe(404)
  })

  test('peut répondre à son propre ticket, la réponse apparaît dans le fil', async () => {
    const buyer = await createUser('BUYER')
    const ticket = await openTicket(buyer)

    const reply = await request(app).post(`/api/support/tickets/${ticket.body.id}/messages`)
      .set('Authorization', `Bearer ${signToken(buyer)}`).send({ content: 'Une précision.' })
    expect(reply.status).toBe(201)

    const thread = await request(app).get(`/api/support/tickets/${ticket.body.id}/messages`)
      .set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(thread.body.messages).toHaveLength(2)
    expect(thread.body.messages[1].content).toBe('Une précision.')
  })

  test('impossible de répondre à un ticket CLOSED', async () => {
    const buyer = await createUser('BUYER')
    const ticket = await openTicket(buyer)
    await prisma.supportTicket.update({ where: { id: ticket.body.id }, data: { status: 'CLOSED' } })

    const reply = await request(app).post(`/api/support/tickets/${ticket.body.id}/messages`)
      .set('Authorization', `Bearer ${signToken(buyer)}`).send({ content: 'Encore là ?' })
    expect(reply.status).toBe(400)
  })
})

describe('File d\'attente admin/commercial', () => {
  test('un vendeur ne peut pas accéder à la file admin', async () => {
    const { user: seller } = await createShopUser()
    const res = await request(app).get('/api/admin/support/tickets').set('Authorization', `Bearer ${signToken(seller)}`)
    expect(res.status).toBe(403)
  })

  test('trie les tickets PRIORITY avant les NORMAL, quelle que soit leur ancienneté', async () => {
    const admin = await createUser('ADMIN')
    const buyer = await createUser('BUYER')
    await openTicket(buyer, { subject: 'Normal ancien' })

    const { user: certifiedSeller, shop } = await createShopUser()
    await prisma.shop.update({ where: { id: shop.id }, data: { plan: 'CERTIFIED' } })
    await openTicket(certifiedSeller, { subject: 'Prioritaire récent' })

    const res = await request(app).get('/api/admin/support/tickets').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body[0].priority).toBe('PRIORITY')
  })

  test('COMMERCIAL peut assigner et répondre, notifie l\'auteur du ticket', async () => {
    const commercial = await createUser('COMMERCIAL')
    const buyer = await createUser('BUYER')
    const ticket = await openTicket(buyer)

    const assigned = await request(app).put(`/api/admin/support/tickets/${ticket.body.id}`)
      .set('Authorization', `Bearer ${signToken(commercial)}`).send({ assignedToId: commercial.id })
    expect(assigned.status).toBe(200)
    expect(assigned.body.assignedToId).toBe(commercial.id)

    const reply = await request(app).post(`/api/admin/support/tickets/${ticket.body.id}/messages`)
      .set('Authorization', `Bearer ${signToken(commercial)}`).send({ content: 'Nous regardons ça.' })
    expect(reply.status).toBe(201)

    const updated = await prisma.supportTicket.findUnique({ where: { id: ticket.body.id } })
    expect(updated.status).toBe('IN_PROGRESS')

    const notif = await prisma.notification.findFirst({ where: { userId: buyer.id, type: 'SUPPORT_TICKET_REPLY' } })
    expect(notif).toBeTruthy()
  })

  test('filtre par statut', async () => {
    const admin = await createUser('ADMIN')
    const buyer = await createUser('BUYER')
    const ticket = await openTicket(buyer)
    await request(app).put(`/api/admin/support/tickets/${ticket.body.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ status: 'CLOSED' })

    const closedOnly = await request(app).get('/api/admin/support/tickets?status=CLOSED')
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(closedOnly.body.every(t => t.status === 'CLOSED')).toBe(true)
    expect(closedOnly.body.some(t => t.id === ticket.body.id)).toBe(true)
  })
})
