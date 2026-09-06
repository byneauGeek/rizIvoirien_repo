const request = require('supertest')
const app = require('../src/index')
const { uniqueEmail, prisma } = require('./helpers')

async function registerB2B(profileType, profile, overrides = {}) {
  const email = overrides.email || uniqueEmail(profileType.toLowerCase())
  const res = await request(app).post('/api/auth/register-b2b').send({
    profileType,
    email,
    password: 'Password123!',
    name: overrides.name || `${profileType} test`,
    phone: '0700000000',
    profile,
  })
  return res
}

describe('B2B — inscription & profils', () => {
  test('inscription producteur crée le User + le profil Producer lié', async () => {
    const res = await registerB2B('PRODUCER', { region: 'Bouaké', surfaceHa: 5 })
    expect(res.status).toBe(201)
    expect(res.body.user.role).toBe('PRODUCER')
    expect(res.body.user.producer.region).toBe('Bouaké')
    expect(res.body.token).toBeTruthy()
  })

  test('inscription coopérative refuse si un champ requis manque', async () => {
    const res = await registerB2B('COOPERATIVE', { region: 'Korhogo' }) // manque name + responsable
    expect(res.status).toBe(400)
  })

  test('inscription avec un profileType invalide → 400', async () => {
    const res = await registerB2B('SOMETHING_ELSE', {})
    expect(res.status).toBe(400)
  })

  test('GET /api/b2b/my-profile renvoie le profil du producteur connecté', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Man' })
    const res = await request(app).get('/api/b2b/my-profile').set('Authorization', `Bearer ${reg.body.token}`)
    expect(res.status).toBe(200)
    expect(res.body.region).toBe('Man')
  })

  test('un BUYER ne peut pas accéder à /api/b2b/my-profile (rôle non B2B)', async () => {
    const buyerReg = await request(app).post('/api/auth/register').send({
      email: uniqueEmail('buyer'), password: 'Password123!', name: 'Buyer test',
    })
    const res = await request(app).get('/api/b2b/my-profile').set('Authorization', `Bearer ${buyerReg.body.token}`)
    expect(res.status).toBe(403)
  })

  test('PUT /api/b2b/my-profile met à jour uniquement les champs autorisés', async () => {
    const reg = await registerB2B('TRADER', { companyName: 'Riz Export SARL' })
    const res = await request(app)
      .put('/api/b2b/my-profile')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ companyName: 'Nouveau nom', verification: 'VERIFIED' }) // verification doit être ignoré
    expect(res.status).toBe(200)
    expect(res.body.companyName).toBe('Nouveau nom')
    expect(res.body.verification).toBe('UNVERIFIED')
  })

  // LOT AUDIT-G13 (audit XXX RIZ)
  test('PUT /api/b2b/my-profile accepte documentUrl (pièce justificative)', async () => {
    const reg = await registerB2B('COOPERATIVE', { name: 'Coop Test', responsable: 'Kouassi', region: 'Man' })
    const res = await request(app)
      .put('/api/b2b/my-profile')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ documentUrl: 'https://res.cloudinary.com/test/rccm-coop.jpg' })
    expect(res.status).toBe(200)
    expect(res.body.documentUrl).toBe('https://res.cloudinary.com/test/rccm-coop.jpg')

    const getRes = await request(app).get('/api/b2b/my-profile').set('Authorization', `Bearer ${reg.body.token}`)
    expect(getRes.body.documentUrl).toBe('https://res.cloudinary.com/test/rccm-coop.jpg')
  })
})

describe('B2B — offres', () => {
  test('un producteur peut publier une offre, elle apparaît dans la recherche publique', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const created = await request(app)
      .post('/api/b2b/offers')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 50, unit: 'tonne', region: 'Bouaké' })
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('AVAILABLE')

    const search = await request(app).get('/api/b2b/offers?region=Bouaké')
    expect(search.status).toBe(200)
    expect(search.body.offers.some((o) => o.id === created.body.id)).toBe(true)
  })

  test('une quantité invalide est rejetée', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const res = await request(app)
      .post('/api/b2b/offers')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: -5, unit: 'tonne', region: 'Bouaké' })
    expect(res.status).toBe(400)
  })

  test('un TRADER ne peut pas publier d\'offre (réservé PRODUCER/COOPERATIVE)', async () => {
    const reg = await registerB2B('TRADER', { companyName: 'ACME' })
    const res = await request(app)
      .post('/api/b2b/offers')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Bouaké' })
    expect(res.status).toBe(403)
  })

  test('un producteur ne peut pas modifier l\'offre d\'un autre producteur (IDOR)', async () => {
    const seller1 = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const seller2 = await registerB2B('PRODUCER', { region: 'Man' })
    const offer = await request(app)
      .post('/api/b2b/offers')
      .set('Authorization', `Bearer ${seller1.body.token}`)
      .send({ product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Bouaké' })

    const attempt = await request(app)
      .put(`/api/b2b/offers/${offer.body.id}`)
      .set('Authorization', `Bearer ${seller2.body.token}`)
      .send({ quantity: 999 })
    expect(attempt.status).toBe(404)
  })

  test('une coopérative peut publier une offre en son nom propre', async () => {
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Riz Nord', responsable: 'Awa Koné', region: 'Korhogo' })
    const created = await request(app)
      .post('/api/b2b/offers')
      .set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz blanchi', quantity: 100, unit: 'tonne', region: 'Korhogo' })
    expect(created.status).toBe(201)
    expect(created.body.cooperativeId).toBeTruthy()
    expect(created.body.producerId).toBeNull()
  })

  test('désactiver une offre publiée passe par un changement de statut, pas une suppression', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const offer = await request(app)
      .post('/api/b2b/offers')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Bouaké' })

    const del = await request(app)
      .delete(`/api/b2b/offers/${offer.body.id}`)
      .set('Authorization', `Bearer ${reg.body.token}`)
    expect(del.status).toBe(200)

    const check = await request(app).get(`/api/b2b/offers/${offer.body.id}`)
    expect(check.body.status).toBe('DISABLED')
  })

  test('recherche : filtre par quantité minimale', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Séguéla' })
    await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 5, unit: 'tonne', region: 'Séguéla' })
    const big = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 80, unit: 'tonne', region: 'Séguéla' })

    const res = await request(app).get('/api/b2b/offers?region=Séguéla&minQuantity=50')
    expect(res.body.offers.every(o => o.quantity >= 50)).toBe(true)
    expect(res.body.offers.some(o => o.id === big.body.id)).toBe(true)
  })

  test('recherche : filtre par type de vendeur (sellerType)', async () => {
    const producer = await registerB2B('PRODUCER', { region: 'Odienné' })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Odienné', responsable: 'X', region: 'Odienné' })
    await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${producer.body.token}`)
      .send({ product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Odienné' })
    await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Odienné' })

    const res = await request(app).get('/api/b2b/offers?region=Odienné&sellerType=COOPERATIVE')
    expect(res.body.offers.length).toBeGreaterThan(0)
    expect(res.body.offers.every(o => o.cooperativeId != null)).toBe(true)
  })

  test('recherche : filtre par disponibilité (availableBy)', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bondoukou' })
    const soon = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Bondoukou', availableFrom: '2026-09-01' })
    const later = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Bondoukou', availableFrom: '2027-06-01' })

    const res = await request(app).get('/api/b2b/offers?region=Bondoukou&availableBy=2026-12-31')
    expect(res.body.offers.some(o => o.id === soon.body.id)).toBe(true)
    expect(res.body.offers.some(o => o.id === later.body.id)).toBe(false)
  })

  // LOT AUDIT-OWN-01 (audit XXX RIZ)
  test('une coopérative peut attribuer une offre à un membre actif', async () => {
    const memberEmail = uniqueEmail('own-member')
    await registerB2B('PRODUCER', { region: 'Man' }, { email: memberEmail })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Own', responsable: 'X', region: 'Man' })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: memberEmail })
    const member = await prisma.user.findUnique({ where: { email: memberEmail }, include: { producer: true } })

    const created = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz paddy', quantity: 100, unit: 'sac', region: 'Man', ownerProducerId: member.producer.id })
    expect(created.status).toBe(201)
    expect(created.body.ownerProducerId).toBe(member.producer.id)
  })

  test('ownerProducerId absent = propriété de la coopérative (jamais ambigu)', async () => {
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Own2', responsable: 'X', region: 'Man' })
    const created = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz paddy', quantity: 100, unit: 'sac', region: 'Man' })
    expect(created.status).toBe(201)
    expect(created.body.ownerProducerId).toBeNull()
  })

  test('rejette un ownerProducerId qui n\'est pas membre de la coopérative', async () => {
    const outsiderEmail = uniqueEmail('own-outsider')
    await registerB2B('PRODUCER', { region: 'Man' }, { email: outsiderEmail })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Own3', responsable: 'X', region: 'Man' })
    const outsider = await prisma.user.findUnique({ where: { email: outsiderEmail }, include: { producer: true } })

    const res = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz paddy', quantity: 100, unit: 'sac', region: 'Man', ownerProducerId: outsider.producer.id })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/membre actif/)
  })

  test('rejette un ownerProducerId d\'un membre désactivé', async () => {
    const memberEmail = uniqueEmail('own-inactive')
    await registerB2B('PRODUCER', { region: 'Man' }, { email: memberEmail })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Own4', responsable: 'X', region: 'Man' })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: memberEmail })
    const member = await prisma.user.findUnique({ where: { email: memberEmail }, include: { producer: true } })
    await request(app).put(`/api/b2b/cooperative/members/${member.producer.id}`)
      .set('Authorization', `Bearer ${coop.body.token}`).send({ active: false })

    const res = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz paddy', quantity: 100, unit: 'sac', region: 'Man', ownerProducerId: member.producer.id })
    expect(res.status).toBe(400)
  })

  test('un PRODUCER individuel ne peut pas fixer ownerProducerId (ignoré silencieusement)', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const other = await registerB2B('PRODUCER', { region: 'Man' })
    const res = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Bouaké', ownerProducerId: other.body.user.producer.id })
    expect(res.status).toBe(201)
    expect(res.body.ownerProducerId).toBeNull()
  })

  test('PUT /offers/:id peut réattribuer le propriétaire ou revenir à la coopérative', async () => {
    const memberEmail = uniqueEmail('own-reassign')
    await registerB2B('PRODUCER', { region: 'Man' }, { email: memberEmail })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Own5', responsable: 'X', region: 'Man' })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: memberEmail })
    const member = await prisma.user.findUnique({ where: { email: memberEmail }, include: { producer: true } })

    const created = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz paddy', quantity: 100, unit: 'sac', region: 'Man' })
    expect(created.body.ownerProducerId).toBeNull()

    const assigned = await request(app).put(`/api/b2b/offers/${created.body.id}`)
      .set('Authorization', `Bearer ${coop.body.token}`).send({ ownerProducerId: member.producer.id })
    expect(assigned.body.ownerProducerId).toBe(member.producer.id)

    const reverted = await request(app).put(`/api/b2b/offers/${created.body.id}`)
      .set('Authorization', `Bearer ${coop.body.token}`).send({ ownerProducerId: '' })
    expect(reverted.body.ownerProducerId).toBeNull()
  })
})

describe('B2B — demandes d\'achat', () => {
  test('un transformateur peut publier une demande, visible en recherche', async () => {
    const reg = await registerB2B('PROCESSOR', { companyName: 'Rizerie du Nord' })
    const created = await request(app)
      .post('/api/b2b/requests')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 200, unit: 'tonne', region: 'Bouaké' })
    expect(created.status).toBe(201)

    const search = await request(app).get('/api/b2b/requests?product=Riz paddy')
    expect(search.status).toBe(200)
    expect(search.body.requests.some((r) => r.id === created.body.id)).toBe(true)
  })

  test('un producteur ne peut pas publier de demande (réservé TRADER/PROCESSOR/EXPORTER)', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const res = await request(app)
      .post('/api/b2b/requests')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 10, unit: 'tonne', region: 'Bouaké' })
    expect(res.status).toBe(403)
  })

  test('recherche : filtre par quantité minimale et par type d\'acheteur (actorType)', async () => {
    const processor = await registerB2B('PROCESSOR', { companyName: 'Rizerie Test' })
    const exporter = await registerB2B('EXPORTER', { companyName: 'Export Test' })
    const small = await request(app).post('/api/b2b/requests').set('Authorization', `Bearer ${processor.body.token}`)
      .send({ product: 'Riz paddy', quantity: 5, unit: 'tonne', region: 'Divo' })
    const big = await request(app).post('/api/b2b/requests').set('Authorization', `Bearer ${exporter.body.token}`)
      .send({ product: 'Riz paddy', quantity: 300, unit: 'tonne', region: 'Divo' })

    const byQuantity = await request(app).get('/api/b2b/requests?region=Divo&minQuantity=100')
    expect(byQuantity.body.requests.some(r => r.id === big.body.id)).toBe(true)
    expect(byQuantity.body.requests.some(r => r.id === small.body.id)).toBe(false)

    const byActor = await request(app).get('/api/b2b/requests?region=Divo&actorType=EXPORTER')
    expect(byActor.body.requests.every(r => r.exporterId != null)).toBe(true)
    expect(byActor.body.requests.some(r => r.id === small.body.id)).toBe(false)
  })
})

describe('B2B — membres de coopérative', () => {
  test('une coopérative peut associer un producteur existant par email', async () => {
    const producerEmail = uniqueEmail('member-producer')
    const producer = await registerB2B('PRODUCER', { region: 'Daloa' }, { email: producerEmail })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Test', responsable: 'X', region: 'Daloa' })

    const res = await request(app)
      .post('/api/b2b/cooperative/members')
      .set('Authorization', `Bearer ${coop.body.token}`)
      .send({ producerEmail })
    expect(res.status).toBe(201)

    const list = await request(app)
      .get('/api/b2b/cooperative/members')
      .set('Authorization', `Bearer ${coop.body.token}`)
    expect(list.status).toBe(200)
    expect(list.body.members.length).toBe(1)
    expect(list.body.members[0].producer.user.name).toBeTruthy()
  })

  test('associer un email qui n\'est pas un producteur → 404', async () => {
    const buyerReg = await request(app).post('/api/auth/register').send({
      email: uniqueEmail('not-a-producer'), password: 'Password123!', name: 'Not producer',
    })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Test 2', responsable: 'Y', region: 'Daloa' })

    const res = await request(app)
      .post('/api/b2b/cooperative/members')
      .set('Authorization', `Bearer ${coop.body.token}`)
      .send({ producerEmail: buyerReg.body.user.email })
    expect(res.status).toBe(404)
  })

  // LOT AUDIT-ORG-02 (audit XXX RIZ)
  test('recherche et filtre par statut actif', async () => {
    const emailA = uniqueEmail('member-a')
    const emailB = uniqueEmail('member-b')
    await registerB2B('PRODUCER', { region: 'Man' }, { email: emailA, name: 'Kouassi Alpha' })
    await registerB2B('PRODUCER', { region: 'Gagnoa' }, { email: emailB, name: 'Bamba Beta' })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Recherche', responsable: 'Z', region: 'Man' })

    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: emailA })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: emailB })

    const bySearch = await request(app).get('/api/b2b/cooperative/members?search=Alpha').set('Authorization', `Bearer ${coop.body.token}`)
    expect(bySearch.body.members.length).toBe(1)
    expect(bySearch.body.members[0].producer.user.name).toBe('Kouassi Alpha')

    const byRegion = await request(app).get('/api/b2b/cooperative/members?search=Gagnoa').set('Authorization', `Bearer ${coop.body.token}`)
    expect(byRegion.body.members.length).toBe(1)

    const producerA = await prisma.user.findUnique({ where: { email: emailA }, include: { producer: true } })
    await request(app).put(`/api/b2b/cooperative/members/${producerA.producer.id}`)
      .set('Authorization', `Bearer ${coop.body.token}`).send({ active: false })

    const onlyActive = await request(app).get('/api/b2b/cooperative/members?active=true').set('Authorization', `Bearer ${coop.body.token}`)
    expect(onlyActive.body.members.length).toBe(1)
    const onlyInactive = await request(app).get('/api/b2b/cooperative/members?active=false').set('Authorization', `Bearer ${coop.body.token}`)
    expect(onlyInactive.body.members.length).toBe(1)
    expect(onlyInactive.body.members[0].producer.user.name).toBe('Kouassi Alpha')
  })

  test('GET /cooperative/members/:producerId renvoie la fiche détail, PUT met à jour la note', async () => {
    const email = uniqueEmail('member-detail')
    await registerB2B('PRODUCER', { region: 'Bouaké', farmType: 'Riziculture irriguée', surfaceHa: 3 }, { email })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Détail', responsable: 'W', region: 'Bouaké' })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: email })

    const producer = await prisma.user.findUnique({ where: { email }, include: { producer: true } })
    const detail = await request(app).get(`/api/b2b/cooperative/members/${producer.producer.id}`)
      .set('Authorization', `Bearer ${coop.body.token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.producer.farmType).toBe('Riziculture irriguée')

    const updated = await request(app).put(`/api/b2b/cooperative/members/${producer.producer.id}`)
      .set('Authorization', `Bearer ${coop.body.token}`).send({ note: 'Fournisseur fiable' })
    expect(updated.status).toBe(200)
    expect(updated.body.note).toBe('Fournisseur fiable')
  })

  test('une autre coopérative ne peut pas voir/modifier un membre qui n\'est pas le sien', async () => {
    const email = uniqueEmail('member-isolated')
    await registerB2B('PRODUCER', { region: 'Korhogo' }, { email })
    const coopOwner = await registerB2B('COOPERATIVE', { name: 'Coop Proprio', responsable: 'A', region: 'Korhogo' })
    const coopStranger = await registerB2B('COOPERATIVE', { name: 'Coop Etrangere', responsable: 'B', region: 'Korhogo' })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coopOwner.body.token}`).send({ producerEmail: email })

    const producer = await prisma.user.findUnique({ where: { email }, include: { producer: true } })
    const res = await request(app).get(`/api/b2b/cooperative/members/${producer.producer.id}`)
      .set('Authorization', `Bearer ${coopStranger.body.token}`)
    expect(res.status).toBe(404)
  })
})

// LOT AUDIT-ACC-05 (audit XXX RIZ) — ledger membre coopérative
describe('B2B — ledger membre coopérative', () => {
  async function setupMemberOfferContact({ commissionRate } = {}) {
    const memberEmail = uniqueEmail('ledger-member')
    const memberReg = await registerB2B('PRODUCER', { region: 'Man' }, { email: memberEmail })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Ledger', responsable: 'X', region: 'Man' })
    if (commissionRate != null) {
      await request(app).put('/api/b2b/my-profile').set('Authorization', `Bearer ${coop.body.token}`).send({ commissionRate })
    }
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: memberEmail })
    const member = await prisma.user.findUnique({ where: { email: memberEmail }, include: { producer: true } })

    const offer = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${coop.body.token}`)
      .send({ product: 'Riz paddy', quantity: 100, unit: 'sac', region: 'Man', ownerProducerId: member.producer.id })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME Ledger' })
    const contact = await request(app).post('/api/b2b/contacts').set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.body.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${coop.body.token}`)

    return { coop, member, memberToken: memberReg.body.token, offer, buyer, contact }
  }

  test('une vente avec montant crédite automatiquement le membre (SALE_CREDIT), sans commission par défaut', async () => {
    const { coop, member, buyer, contact } = await setupMemberOfferContact()
    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 40, amount: 400000 })
    expect(tx.status).toBe(201)

    const ledger = await request(app).get(`/api/b2b/cooperative/members/${member.producer.id}/ledger`)
      .set('Authorization', `Bearer ${coop.body.token}`)
    expect(ledger.status).toBe(200)
    expect(ledger.body.entries).toHaveLength(1)
    expect(ledger.body.entries[0].type).toBe('SALE_CREDIT')
    expect(ledger.body.entries[0].amount).toBe(400000)
    expect(ledger.body.entries[0].sourceId).toBe(tx.body.id)
    expect(ledger.body.balance).toBe(400000)
  })

  test('un taux de commission configuré génère une écriture COMMISSION négative', async () => {
    const { coop, member, buyer, contact } = await setupMemberOfferContact({ commissionRate: 10 })
    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 40, amount: 400000 })
    expect(tx.status).toBe(201)

    const ledger = await request(app).get(`/api/b2b/cooperative/members/${member.producer.id}/ledger`)
      .set('Authorization', `Bearer ${coop.body.token}`)
    expect(ledger.body.entries).toHaveLength(2)
    const commission = ledger.body.entries.find(e => e.type === 'COMMISSION')
    expect(commission.amount).toBe(-40000) // 10% de 400000
    expect(ledger.body.balance).toBe(360000) // 400000 - 40000
  })

  test('une transaction sans montant déclaré ne crédite rien', async () => {
    const { coop, member, buyer, contact } = await setupMemberOfferContact()
    const tx = await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 40 })
    expect(tx.status).toBe(201)

    const ledger = await request(app).get(`/api/b2b/cooperative/members/${member.producer.id}/ledger`)
      .set('Authorization', `Bearer ${coop.body.token}`)
    expect(ledger.body.entries).toHaveLength(0)
    expect(ledger.body.balance).toBe(0)
  })

  test('la coopérative peut enregistrer un paiement, qui réduit le solde', async () => {
    const { coop, member, buyer, contact } = await setupMemberOfferContact()
    await request(app).post('/api/b2b/transactions').set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 40, amount: 400000 })

    const payment = await request(app).post(`/api/b2b/cooperative/members/${member.producer.id}/payments`)
      .set('Authorization', `Bearer ${coop.body.token}`)
      .send({ amount: 150000, reference: 'MTN-XYZ-001' })
    expect(payment.status).toBe(201)
    expect(payment.body.amount).toBe(-150000)

    const ledger = await request(app).get(`/api/b2b/cooperative/members/${member.producer.id}/ledger`)
      .set('Authorization', `Bearer ${coop.body.token}`)
    expect(ledger.body.balance).toBe(250000) // 400000 - 150000
  })

  test('un ajustement manuel requiert un motif', async () => {
    const { coop, member } = await setupMemberOfferContact()
    const res = await request(app).post(`/api/b2b/cooperative/members/${member.producer.id}/adjustments`)
      .set('Authorization', `Bearer ${coop.body.token}`)
      .send({ amount: 5000 })
    expect(res.status).toBe(400)

    const withReason = await request(app).post(`/api/b2b/cooperative/members/${member.producer.id}/adjustments`)
      .set('Authorization', `Bearer ${coop.body.token}`)
      .send({ amount: 5000, description: 'Bonus qualité exceptionnelle' })
    expect(withReason.status).toBe(201)
    expect(withReason.body.amount).toBe(5000)
  })

  test('un membre (PRODUCER) voit son propre solde via /my-ledger', async () => {
    const { memberToken, buyer, contact } = await setupMemberOfferContact()
    await request(app).post('/api/b2b/transactions').set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 40, amount: 400000 })

    const myLedger = await request(app).get('/api/b2b/my-ledger').set('Authorization', `Bearer ${memberToken}`)
    expect(myLedger.status).toBe(200)
    expect(myLedger.body.balance).toBe(400000)
    expect(myLedger.body.entries).toHaveLength(1)
  })

  // LOT AUDIT-ACC-04/ACC-05 (audit XXX RIZ)
  test('GET /cooperative/accounting agrège tous les membres, jamais mélangé avec une autre coopérative', async () => {
    const { coop, member, buyer, contact } = await setupMemberOfferContact({ commissionRate: 10 })
    await request(app).post('/api/b2b/transactions').set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ contactId: contact.body.id, quantity: 40, amount: 400000 })
    await request(app).post(`/api/b2b/cooperative/members/${member.producer.id}/payments`)
      .set('Authorization', `Bearer ${coop.body.token}`).send({ amount: 100000 })

    // Une autre coopérative, avec sa propre activité — ne doit jamais fuiter ici.
    const other = await setupMemberOfferContact({ commissionRate: 20 })
    await request(app).post('/api/b2b/transactions').set('Authorization', `Bearer ${other.buyer.body.token}`)
      .send({ contactId: other.contact.body.id, quantity: 40, amount: 999999 })

    const accounting = await request(app).get('/api/b2b/cooperative/accounting')
      .set('Authorization', `Bearer ${coop.body.token}`)
    expect(accounting.status).toBe(200)
    expect(accounting.body.totalSales).toBe(400000)
    expect(accounting.body.totalCommissions).toBe(-40000)
    expect(accounting.body.totalPayments).toBe(-100000)
    expect(accounting.body.totalDue).toBe(260000) // 400000 - 40000 - 100000
    expect(accounting.body.byMember).toHaveLength(1)
    expect(accounting.body.byMember[0].producerId).toBe(member.producer.id)
    expect(accounting.body.byMember[0].balance).toBe(260000)
  })

  test('un TRADER (pas COOPERATIVE) ne peut pas accéder à /cooperative/accounting', async () => {
    const trader = await registerB2B('TRADER', { companyName: 'Not A Coop' })
    const res = await request(app).get('/api/b2b/cooperative/accounting').set('Authorization', `Bearer ${trader.body.token}`)
    expect(res.status).toBe(403)
  })

  test('sécurité : un membre ne peut pas voir le ledger d\'un autre membre', async () => {
    const emailA = uniqueEmail('ledger-sec-a')
    const emailB = uniqueEmail('ledger-sec-b')
    const regA = await registerB2B('PRODUCER', { region: 'Man' }, { email: emailA })
    await registerB2B('PRODUCER', { region: 'Man' }, { email: emailB })
    const coop = await registerB2B('COOPERATIVE', { name: 'Coop Sec', responsable: 'X', region: 'Man' })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: emailA })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coop.body.token}`).send({ producerEmail: emailB })
    const memberB = await prisma.user.findUnique({ where: { email: emailB }, include: { producer: true } })

    // regA (membre A, rôle PRODUCER) tente de consulter le ledger via la
    // route coopérative — refusé par requireRole('COOPERATIVE'), pas par
    // ownership : un PRODUCER n'a structurellement pas accès à cette route.
    const res = await request(app).get(`/api/b2b/cooperative/members/${memberB.producer.id}/ledger`)
      .set('Authorization', `Bearer ${regA.body.token}`)
    expect(res.status).toBe(403)
  })

  test('sécurité : une coopérative ne peut pas accéder au ledger d\'un membre d\'une autre coopérative', async () => {
    const email = uniqueEmail('ledger-sec-cross')
    await registerB2B('PRODUCER', { region: 'Man' }, { email })
    const coopOwner = await registerB2B('COOPERATIVE', { name: 'Coop Sec Owner', responsable: 'X', region: 'Man' })
    const coopStranger = await registerB2B('COOPERATIVE', { name: 'Coop Sec Stranger', responsable: 'Y', region: 'Man' })
    await request(app).post('/api/b2b/cooperative/members').set('Authorization', `Bearer ${coopOwner.body.token}`).send({ producerEmail: email })
    const member = await prisma.user.findUnique({ where: { email }, include: { producer: true } })

    const res = await request(app).get(`/api/b2b/cooperative/members/${member.producer.id}/ledger`)
      .set('Authorization', `Bearer ${coopStranger.body.token}`)
    expect(res.status).toBe(404)
  })
})
