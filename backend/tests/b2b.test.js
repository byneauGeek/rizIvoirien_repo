const request = require('supertest')
const app = require('../src/index')
const { uniqueEmail } = require('./helpers')

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
})
