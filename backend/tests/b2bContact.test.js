const request = require('supertest')
const app = require('../src/index')
const { createUser, createShopUser, prisma, signToken, uniqueEmail } = require('./helpers')

async function registerB2B(profileType, profile, overrides = {}) {
  const email = overrides.email || uniqueEmail(profileType.toLowerCase())
  const res = await request(app).post('/api/auth/register-b2b').send({
    profileType, email, password: 'Password123!', name: overrides.name || `${profileType} test`, profile,
  })
  return res
}

async function publishOffer(token) {
  const res = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${token}`)
    .send({ product: 'Riz paddy', quantity: 50, unit: 'tonne', region: 'Bouaké' })
  return res.body
}

async function publishRequest(token) {
  const res = await request(app).post('/api/b2b/requests').set('Authorization', `Bearer ${token}`)
    .send({ product: 'Riz paddy', quantity: 20, unit: 'tonne', region: 'Bouaké' })
  return res.body
}

describe('B2B — mise en relation', () => {
  test('un acheteur peut contacter le vendeur d\'une offre, coordonnées cachées avant acceptation', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const offer = await publishOffer(seller.body.token)

    const created = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ offerId: offer.id, message: 'Intéressé par votre offre' })
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('PENDING')

    const mineBuyer = await request(app).get('/api/b2b/contacts').set('Authorization', `Bearer ${buyer.body.token}`)
    expect(mineBuyer.body.contacts[0].counterpart.phone).toBeUndefined()
  })

  test('impossible de se contacter soi-même via sa propre offre', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const offer = await publishOffer(seller.body.token)
    const res = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${seller.body.token}`)
      .send({ offerId: offer.id })
    expect(res.status).toBe(400)
  })

  test('acceptation d\'un contact révèle les coordonnées aux deux parties', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' }, { name: 'Seller Person' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const offer = await publishOffer(seller.body.token)

    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ offerId: offer.id })

    const accept = await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`)
      .set('Authorization', `Bearer ${seller.body.token}`)
    expect(accept.status).toBe(200)
    expect(accept.body.status).toBe('ACCEPTED')

    const mineBuyer = await request(app).get('/api/b2b/contacts').set('Authorization', `Bearer ${buyer.body.token}`)
    const found = mineBuyer.body.contacts.find(c => c.id === contact.body.id)
    expect(found.counterpart.name).toBe('Seller Person')
    expect(found.counterpart.phone).toBeDefined()
  })

  test('seul le destinataire peut accepter/refuser un contact', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const offer = await publishOffer(seller.body.token)
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ offerId: offer.id })

    const res = await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`)
      .set('Authorization', `Bearer ${buyer.body.token}`) // le demandeur, pas le destinataire
    expect(res.status).toBe(404)
  })

  test('refuser un contact notifie le demandeur (cadrage §5 P1 "réponses")', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const offer = await publishOffer(seller.body.token)
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.id })

    const res = await request(app).post(`/api/b2b/contacts/${contact.body.id}/reject`)
      .set('Authorization', `Bearer ${seller.body.token}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('REJECTED')

    await new Promise((r) => setImmediate(r))
    const buyerUser = await prisma.user.findUnique({ where: { email: buyer.body.user.email } })
    const notif = await prisma.notification.findFirst({ where: { userId: buyerUser.id, type: 'B2B_CONTACT_REJECTED' } })
    expect(notif).toBeTruthy()
  })

  test('un contact déjà en cours sur la même offre n\'est pas dupliqué', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const offer = await publishOffer(seller.body.token)

    const first = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.id })
    const second = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.id })
    expect(second.body.id).toBe(first.body.id)
  })
})

describe('B2B — transaction déclarée', () => {
  test('déclaration d\'une transaction depuis un contact accepté (offre)', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const offer = await publishOffer(seller.body.token)
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${seller.body.token}`)

    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 30, amount: 3000000, notes: 'Livraison à convenir' })
    expect(tx.status).toBe(201)
    expect(tx.body.status).toBe('DECLARED')

    // Vendeur = propriétaire de l'offre, acheteur = celui qui a initié le contact
    const seller_ = await prisma.user.findUnique({ where: { email: seller.body.user.email } })
    const buyer_ = await prisma.user.findUnique({ where: { email: buyer.body.user.email } })
    expect(tx.body.sellerUserId).toBe(seller_.id)
    expect(tx.body.buyerUserId).toBe(buyer_.id)
  })

  test('déclaration impossible sans contact accepté', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const offer = await publishOffer(seller.body.token)
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.id })
    // pas d'acceptation

    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 10 })
    expect(tx.status).toBe(404)
  })

  test('une seule transaction par contact', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const offer = await publishOffer(seller.body.token)
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${seller.body.token}`)

    await request(app).post('/api/b2b/transactions').set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 10 })
    const second = await request(app).post('/api/b2b/transactions').set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 5 })
    expect(second.status).toBe(409)
  })

  test('un tiers non impliqué ne peut pas déclarer de transaction sur ce contact', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const stranger = await registerB2B('TRADER', { companyName: 'Autre' })
    const offer = await publishOffer(seller.body.token)
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${seller.body.token}`)

    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${stranger.body.token}`)
      .send({ contactId: contact.body.id, quantity: 10 })
    expect(tx.status).toBe(404)
  })

  // LOT AUDIT-G3/G12 (audit XXX RIZ)
  test('rejette une transaction sous le MOQ de l\'offre', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const offer = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${seller.body.token}`)
      .send({ product: 'Riz paddy', quantity: 50, unit: 'tonne', region: 'Bouaké', minOrderQty: 20 })
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.body.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${seller.body.token}`)

    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 10 })
    expect(tx.status).toBe(400)
    expect(tx.body.error).toMatch(/MOQ/)

    const untouchedOffer = await prisma.riceOffer.findUnique({ where: { id: offer.body.id } })
    expect(untouchedOffer.status).toBe('AVAILABLE')
  })

  test('accepte une transaction au niveau du MOQ et passe l\'offre en RESERVED', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const offer = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${seller.body.token}`)
      .send({ product: 'Riz paddy', quantity: 50, unit: 'tonne', region: 'Bouaké', minOrderQty: 20 })
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.body.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${seller.body.token}`)

    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 20 })
    expect(tx.status).toBe(201)

    const updatedOffer = await prisma.riceOffer.findUnique({ where: { id: offer.body.id } })
    expect(updatedOffer.status).toBe('RESERVED')
  })

  test('une transaction déclarée sur une demande (pas une offre) ne touche aucun RiceOffer', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const req_ = await publishRequest(buyer.body.token)
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${seller.body.token}`).send({ requestId: req_.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${buyer.body.token}`)

    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${seller.body.token}`)
      .send({ contactId: contact.body.id, quantity: 10 })
    expect(tx.status).toBe(201) // pas de MOQ sur une demande, rien à rejeter
  })

  // LOT AUDIT-OWN-02/OWN-03 (audit XXX RIZ)
  test('une transaction décrémente réellement RiceOffer.quantity et snapshot le propriétaire', async () => {
    const memberEmail = uniqueEmail('own-tx-member')
    await registerB2B('PRODUCER', { region: 'Man' }, { email: memberEmail })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop TX', responsable: 'X', region: 'Man' })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: memberEmail })
    const member = await prisma.user.findUnique({ where: { email: memberEmail }, include: { producer: true } })

    const offer = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz paddy', quantity: 100, unit: 'sac', region: 'Man', ownerProducerId: member.producer.id })

    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.body.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${coop.body.token}`)

    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 40 })
    expect(tx.status).toBe(201)
    expect(tx.body.ownerProducerId).toBe(member.producer.id)

    const refreshedOffer = await prisma.riceOffer.findUnique({ where: { id: offer.body.id } })
    expect(refreshedOffer.quantity).toBe(60)
    expect(refreshedOffer.status).toBe('RESERVED')
  })

  test('rejette une transaction dépassant le stock disponible de l\'offre', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME2' })
    const offer = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${seller.body.token}`)
      .send({ product: 'Riz paddy', quantity: 50, unit: 'sac', region: 'Bouaké' })
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.body.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${seller.body.token}`)

    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 60 })
    expect(tx.status).toBe(400)
    expect(tx.body.error).toMatch(/stock disponible/)
  })

  test('épuiser tout le stock d\'une offre la passe en SOLD', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME3' })
    const offer = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${seller.body.token}`)
      .send({ product: 'Riz paddy', quantity: 20, unit: 'sac', region: 'Bouaké' })
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.body.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${seller.body.token}`)

    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 20 })
    expect(tx.status).toBe(201)

    const refreshedOffer = await prisma.riceOffer.findUnique({ where: { id: offer.body.id } })
    expect(refreshedOffer.quantity).toBe(0)
    expect(refreshedOffer.status).toBe('SOLD')
  })

  // Section 27 du cahier de cadrage : "test multi-propriétaires" — deux lots
  // (deux offres, chacune avec un propriétaire membre différent) du même
  // produit catalogue, vendus partiellement, doivent attribuer les revenus
  // au bon membre indépendamment l'un de l'autre.
  test('multi-propriétaires : deux offres du même produit, deux membres, ventes partielles indépendantes', async () => {
    const emailA = uniqueEmail('own-multi-a')
    const emailB = uniqueEmail('own-multi-b')
    await registerB2B('PRODUCER', { region: 'Man' }, { email: emailA, name: 'Membre A' })
    await registerB2B('PRODUCER', { region: 'Man' }, { email: emailB, name: 'Membre B' })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Multi', responsable: 'X', region: 'Man' })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: emailA })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: emailB })
    const memberA = await prisma.user.findUnique({ where: { email: emailA }, include: { producer: true } })
    const memberB = await prisma.user.findUnique({ where: { email: emailB }, include: { producer: true } })

    const lotA = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz 25kg', quantity: 100, unit: 'sac', region: 'Man', ownerProducerId: memberA.producer.id })
    const lotB = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz 25kg', quantity: 100, unit: 'sac', region: 'Man', ownerProducerId: memberB.producer.id })

    const buyer = await registerB2B('TRADER', { companyName: 'ACME Multi' })
    const contactA = await request(app).post('/api/b2b/contacts').set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: lotA.body.id })
    await request(app).post(`/api/b2b/contacts/${contactA.body.id}/accept`).set('Authorization', `Bearer ${coop.body.token}`)
    const contactB = await request(app).post('/api/b2b/contacts').set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: lotB.body.id })
    await request(app).post(`/api/b2b/contacts/${contactB.body.id}/accept`).set('Authorization', `Bearer ${coop.body.token}`)

    // 50 sacs du Lot A, 30 sacs du Lot B
    const txA = await request(app).post('/api/b2b/transactions').set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contactA.body.id, quantity: 50, amount: 500000 })
    const txB = await request(app).post('/api/b2b/transactions').set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contactB.body.id, quantity: 30, amount: 300000 })

    expect(txA.body.ownerProducerId).toBe(memberA.producer.id)
    expect(txA.body.quantity).toBe(50)
    expect(txB.body.ownerProducerId).toBe(memberB.producer.id)
    expect(txB.body.quantity).toBe(30)

    const refreshedA = await prisma.riceOffer.findUnique({ where: { id: lotA.body.id } })
    const refreshedB = await prisma.riceOffer.findUnique({ where: { id: lotB.body.id } })
    expect(refreshedA.quantity).toBe(50) // 100 - 50
    expect(refreshedB.quantity).toBe(70) // 100 - 30

    // La somme attribuable à chaque membre se retrouve exclusivement via
    // ownerProducerId — jamais mélangée entre A et B.
    const salesForA = await prisma.b2BTransaction.findMany({ where: { ownerProducerId: memberA.producer.id } })
    const salesForB = await prisma.b2BTransaction.findMany({ where: { ownerProducerId: memberB.producer.id } })
    expect(salesForA).toHaveLength(1)
    expect(salesForA[0].quantity).toBe(50)
    expect(salesForB).toHaveLength(1)
    expect(salesForB[0].quantity).toBe(30)
  })

  test('modifier l\'offre après la vente ne change jamais le propriétaire déjà figé sur la transaction', async () => {
    const emailA = uniqueEmail('own-frozen-a')
    await registerB2B('PRODUCER', { region: 'Man' }, { email: emailA })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Frozen', responsable: 'X', region: 'Man' })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: emailA })
    const memberA = await prisma.user.findUnique({ where: { email: emailA }, include: { producer: true } })

    const offer = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz paddy', quantity: 100, unit: 'sac', region: 'Man', ownerProducerId: memberA.producer.id })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME Frozen' })
    const contact = await request(app).post('/api/b2b/contacts').set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.body.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${coop.body.token}`)
    const tx = await request(app).post('/api/b2b/transactions').set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 10 })

    // Le producteur repasse le propriétaire de l'offre à "coopérative" après coup.
    await request(app).put(`/api/b2b/offers/${offer.body.id}`).set('Authorization', `Bearer ${coop.body.token}`).send({ ownerProducerId: '' })

    const frozenTx = await prisma.b2BTransaction.findUnique({ where: { id: tx.body.id } })
    expect(frozenTx.ownerProducerId).toBe(memberA.producer.id) // inchangé malgré l'édition de l'offre
  })
})

describe('B2B — admin : vérification, modération, stats', () => {
  test('un profil suspendu disparaît de la recherche publique', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Man' })
    await publishOffer(seller.body.token) // publie une offre région Bouaké (cf helper)
    const admin = await createUser('ADMIN')

    const before = await request(app).get('/api/b2b/offers?region=Bouaké')
    expect(before.body.offers.length).toBeGreaterThan(0)

    const producer = await prisma.producer.findFirst({ where: { region: 'Man' }, orderBy: { id: 'desc' } })
    const suspend = await request(app).put(`/api/admin/b2b/verifications/PRODUCER/${producer.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ verification: 'SUSPENDED' })
    expect(suspend.status).toBe(200)

    const after = await request(app).get('/api/b2b/offers?region=Bouaké')
    expect(after.body.offers.some(o => o.producer?.id === producer.id)).toBe(false)
  })

  test('un profil suspendu ne peut plus publier de nouvelle offre', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Korhogo' })
    const admin = await createUser('ADMIN')
    const producer = await prisma.producer.findFirst({ where: { region: 'Korhogo' }, orderBy: { id: 'desc' } })
    await request(app).put(`/api/admin/b2b/verifications/PRODUCER/${producer.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ verification: 'SUSPENDED' })

    const res = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${seller.body.token}`)
      .send({ product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Korhogo' })
    expect(res.status).toBe(403)
  })

  test('un non-admin ne peut pas accéder aux routes admin B2B', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Daloa' })
    const res = await request(app).get('/api/admin/b2b/stats').set('Authorization', `Bearer ${seller.body.token}`)
    expect(res.status).toBe(403)
  })

  // LOT AUDIT-G13 (audit XXX RIZ) : une pièce justificative (documentUrl)
  // est désormais requise avant de pouvoir demander la vérification.
  test('demander sa vérification sans pièce justificative est refusé', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Gagnoa' })
    const res = await request(app).post('/api/b2b/my-profile/request-verification')
      .set('Authorization', `Bearer ${seller.body.token}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/pièce justificative/)
  })

  test('un utilisateur peut demander sa vérification (après ajout d\'une pièce), un admin peut l\'approuver', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Divo' })
    const admin = await createUser('ADMIN')

    await request(app).put('/api/b2b/my-profile')
      .set('Authorization', `Bearer ${seller.body.token}`)
      .send({ documentUrl: 'https://res.cloudinary.com/test/rccm.jpg' })

    const requestVerif = await request(app).post('/api/b2b/my-profile/request-verification')
      .set('Authorization', `Bearer ${seller.body.token}`)
    expect(requestVerif.status).toBe(200)
    expect(requestVerif.body.verification).toBe('PENDING')

    const producer = await prisma.producer.findFirst({ where: { region: 'Divo' }, orderBy: { id: 'desc' } })
    const approve = await request(app).put(`/api/admin/b2b/verifications/PRODUCER/${producer.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ verification: 'VERIFIED' })
    expect(approve.status).toBe(200)
    expect(approve.body.verification).toBe('VERIFIED')
  })

  // LOT AUDIT-B2B-05 (audit XXX RIZ)
  test('la soumission notifie le candidat (confirmation) et TOUS les admins', async () => {
    // Correctif test-infra (phase 2 post-audit) : cette assertion supposait
    // que "l'admin" était toujours userId=1 — vrai par coïncidence seulement
    // si aucun autre test n'avait encore créé d'utilisateur dans la même
    // base partagée. b2b.js notifie via notifyAdmins() (TOUS les admins,
    // jamais un id fixe) — un admin créé ICI, dans ce test, est la seule
    // façon fiable de vérifier ce comportement.
    const admin = await createUser('ADMIN')
    const seller = await registerB2B('PRODUCER', { region: 'Soubré' })
    const sellerUserId = seller.body.user.id
    await request(app).put('/api/b2b/my-profile')
      .set('Authorization', `Bearer ${seller.body.token}`)
      .send({ documentUrl: 'https://res.cloudinary.com/test/rccm2.jpg' })

    const res = await request(app).post('/api/b2b/my-profile/request-verification')
      .set('Authorization', `Bearer ${seller.body.token}`)
    expect(res.status).toBe(200)

    const confirmation = await prisma.notification.findFirst({ where: { userId: sellerUserId, type: 'B2B_VERIFICATION' } })
    expect(confirmation).toBeTruthy()
    expect(confirmation.message).toMatch(/transmise/)

    const adminNotif = await prisma.notification.findFirst({ where: { userId: admin.id, type: 'B2B_NEW_APPLICATION' } })
    expect(adminNotif).toBeTruthy()
    expect(adminNotif.message).toContain('PRODUCER')
  })

  test('resoumettre après un refus efface le motif de rejet précédent', async () => {
    const admin = await createUser('ADMIN')
    const seller = await registerB2B('PRODUCER', { region: 'Sinfra' })
    await request(app).put('/api/b2b/my-profile')
      .set('Authorization', `Bearer ${seller.body.token}`)
      .send({ documentUrl: 'https://res.cloudinary.com/test/rccm3.jpg' })
    await request(app).post('/api/b2b/my-profile/request-verification')
      .set('Authorization', `Bearer ${seller.body.token}`)

    const producer = await prisma.producer.findFirst({ where: { region: 'Sinfra' }, orderBy: { id: 'desc' } })
    await request(app).put(`/api/admin/b2b/verifications/PRODUCER/${producer.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ verification: 'REJECTED', reason: 'Document flou' })

    const afterReject = await request(app).get('/api/b2b/my-profile').set('Authorization', `Bearer ${seller.body.token}`)
    expect(afterReject.body.rejectionReason).toBe('Document flou')

    const resubmit = await request(app).post('/api/b2b/my-profile/request-verification')
      .set('Authorization', `Bearer ${seller.body.token}`)
    expect(resubmit.status).toBe(200)
    expect(resubmit.body.rejectionReason).toBeNull()
  })

  // LOT AUDIT-B2B-04 (audit XXX RIZ)
  test('GET /admin/b2b/verifications/:type/:id renvoie la fiche complète (shop, historique)', async () => {
    const { user: sellerUser, shop } = await createShopUser({ shopName: 'Boutique du Producteur' })
    const admin = await createUser('ADMIN')

    const capRes = await request(app).post('/api/auth/capabilities')
      .set('Authorization', `Bearer ${signToken(sellerUser)}`)
      .send({ profileType: 'PRODUCER', profile: { region: 'Daloa' } })
    expect(capRes.status).toBe(201)
    const producerId = capRes.body.profile.id

    // Une décision passée doit apparaître dans l'historique de la fiche.
    await request(app).put(`/api/admin/b2b/verifications/PRODUCER/${producerId}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ verification: 'SUSPENDED' })

    const detail = await request(app).get(`/api/admin/b2b/verifications/PRODUCER/${producerId}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(detail.status).toBe(200)
    expect(detail.body.profile.region).toBe('Daloa')
    expect(detail.body.shop.name).toBe('Boutique du Producteur')
    expect(detail.body.shop._count).toHaveProperty('products')
    expect(detail.body.history.length).toBeGreaterThanOrEqual(1)
    expect(detail.body.history[0].adminName).toBe(admin.name)
  })

  test('un profil sans boutique (pas SELLER) renvoie shop: null', async () => {
    const admin = await createUser('ADMIN')
    const reg = await registerB2B('TRADER', { companyName: 'Sans Boutique SARL' })
    const traderId = reg.body.user.trader.id

    const detail = await request(app).get(`/api/admin/b2b/verifications/TRADER/${traderId}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(detail.status).toBe(200)
    expect(detail.body.shop).toBeNull()
  })

  test('les stats admin B2B reflètent l\'activité créée', async () => {
    const admin = await createUser('ADMIN')
    const stats = await request(app).get('/api/admin/b2b/stats').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(stats.status).toBe(200)
    expect(stats.body.usersByCategory.producers).toBeGreaterThan(0)
    expect(typeof stats.body.transactionsDeclared).toBe('number')
  })

  test('l\'admin peut désactiver n\'importe quelle annonce', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Gagnoa' })
    const admin = await createUser('ADMIN')
    const offer = await publishOffer(seller.body.token)

    const res = await request(app).put(`/api/admin/b2b/listings/offers/${offer.id}/moderate`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ status: 'DISABLED' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('DISABLED')
  })
})

// LOT AUDIT-ACC-01 (audit XXX RIZ) — factures coopérative
describe('B2B — factures coopérative', () => {
  async function setupCoopSaleTx() {
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Facture', responsable: 'X', region: 'Man' })
    const offer = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz paddy', quantity: 100, unit: 'sac', region: 'Man' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME Facture' })
    const contact = await request(app).post('/api/b2b/contacts').set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.body.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${coop.body.token}`)
    const tx = await request(app).post('/api/b2b/transactions').set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 40, amount: 400000 })
    return { coop, buyer, tx }
  }

  test('le vendeur (coopérative) peut générer une facture pour sa transaction', async () => {
    const { coop, tx } = await setupCoopSaleTx()
    const res = await request(app).post(`/api/b2b/transactions/${tx.body.id}/invoice`)
      .set('Authorization', `Bearer ${coop.body.token}`)
    expect(res.status).toBe(201)
    expect(res.body.invoiceNumber).toContain('FACT-COOP')
    expect(res.body.content).toContain('Riz paddy')
    expect(res.body.content).toMatch(/400.000/)
  })

  test('une seconde génération pour la même transaction est refusée', async () => {
    const { coop, tx } = await setupCoopSaleTx()
    await request(app).post(`/api/b2b/transactions/${tx.body.id}/invoice`).set('Authorization', `Bearer ${coop.body.token}`)
    const second = await request(app).post(`/api/b2b/transactions/${tx.body.id}/invoice`).set('Authorization', `Bearer ${coop.body.token}`)
    expect(second.status).toBe(409)
  })

  test('l\'acheteur peut consulter la facture (GET), mais pas en générer une nouvelle', async () => {
    const { coop, buyer, tx } = await setupCoopSaleTx()
    await request(app).post(`/api/b2b/transactions/${tx.body.id}/invoice`).set('Authorization', `Bearer ${coop.body.token}`)

    const asBuyer = await request(app).get(`/api/b2b/transactions/${tx.body.id}/invoice`).set('Authorization', `Bearer ${buyer.body.token}`)
    expect(asBuyer.status).toBe(200)

    const genAsBuyer = await request(app).post(`/api/b2b/transactions/${tx.body.id}/invoice`).set('Authorization', `Bearer ${buyer.body.token}`)
    expect(genAsBuyer.status).toBe(404) // sellerUserId ne correspond pas à l'acheteur
  })

  test('un vendeur qui n\'est pas une coopérative ne peut pas facturer', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const offer = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${seller.body.token}`)
      .send({ product: 'Riz paddy', quantity: 50, unit: 'sac', region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME NoCoop' })
    const contact = await request(app).post('/api/b2b/contacts').set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.body.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${seller.body.token}`)
    const tx = await request(app).post('/api/b2b/transactions').set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 10, amount: 50000 })

    const res = await request(app).post(`/api/b2b/transactions/${tx.body.id}/invoice`).set('Authorization', `Bearer ${seller.body.token}`)
    expect(res.status).toBe(403)
  })

  test('GET /cooperative/invoices liste et permet la recherche par numéro', async () => {
    const { coop, tx } = await setupCoopSaleTx()
    const created = await request(app).post(`/api/b2b/transactions/${tx.body.id}/invoice`).set('Authorization', `Bearer ${coop.body.token}`)

    const list = await request(app).get('/api/b2b/cooperative/invoices').set('Authorization', `Bearer ${coop.body.token}`)
    expect(list.status).toBe(200)
    expect(list.body.invoices).toHaveLength(1)
    expect(list.body.invoices[0].transaction.product).toBe('Riz paddy')

    const searched = await request(app).get(`/api/b2b/cooperative/invoices?search=${created.body.invoiceNumber}`)
      .set('Authorization', `Bearer ${coop.body.token}`)
    expect(searched.body.invoices).toHaveLength(1)

    const notFound = await request(app).get('/api/b2b/cooperative/invoices?search=INEXISTANT')
      .set('Authorization', `Bearer ${coop.body.token}`)
    expect(notFound.body.invoices).toHaveLength(0)
  })

  test('sécurité : une coopérative ne voit pas les factures d\'une autre coopérative', async () => {
    const { coop: coopA, tx: txA } = await setupCoopSaleTx()
    await request(app).post(`/api/b2b/transactions/${txA.body.id}/invoice`).set('Authorization', `Bearer ${coopA.body.token}`)
    const { coop: coopB } = await setupCoopSaleTx()

    const list = await request(app).get('/api/b2b/cooperative/invoices').set('Authorization', `Bearer ${coopB.body.token}`)
    expect(list.body.invoices).toHaveLength(0)
  })
})
