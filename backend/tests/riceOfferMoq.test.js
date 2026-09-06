// LOT B2B-7 (audit XXX RIZ) : MOQ (quantité minimale de commande) sur
// RiceOffer — absente jusqu'ici, `quantity` ne représentait que le stock
// total offert, jamais un seuil minimum d'achat par commande.
const request = require('supertest')
const app = require('../src/index')
const { uniqueEmail } = require('./helpers')

async function registerB2B(profileType, profile) {
  const res = await request(app).post('/api/auth/register-b2b').send({
    profileType, email: uniqueEmail(profileType.toLowerCase()), password: 'Password123!',
    name: `${profileType} test`, phone: '0700000000', profile,
  })
  return res
}

describe('LOT B2B-7 — MOQ à la création d\'une offre', () => {
  test('MOQ valide (≤ quantité) est accepté et renvoyé', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const res = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 1000, unit: 'kg', region: 'Bouaké', minOrderQty: 500 })
    expect(res.status).toBe(201)
    expect(res.body.minOrderQty).toBe(500)
  })

  test('MOQ absent reste null (rétro-compatible, pas de valeur inventée)', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const res = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 1000, unit: 'kg', region: 'Bouaké' })
    expect(res.status).toBe(201)
    expect(res.body.minOrderQty).toBeNull()
  })

  test('MOQ supérieur à la quantité disponible est rejeté', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const res = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 200, unit: 'kg', region: 'Bouaké', minOrderQty: 500 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/MOQ/)
  })

  test('MOQ négatif ou nul est rejeté', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const res = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ product: 'Riz paddy', quantity: 1000, unit: 'kg', region: 'Bouaké', minOrderQty: 0 })
    expect(res.status).toBe(400)
  })
})

describe('LOT B2B-7 — MOQ à la modification d\'une offre', () => {
  async function createOffer(token, overrides = {}) {
    const res = await request(app).post('/api/b2b/offers')
      .set('Authorization', `Bearer ${token}`)
      .send({ product: 'Riz paddy', quantity: 1000, unit: 'kg', region: 'Bouaké', ...overrides })
    return res.body
  }

  test('ajouter un MOQ valide via PUT fonctionne', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const offer = await createOffer(reg.body.token)
    const res = await request(app).put(`/api/b2b/offers/${offer.id}`)
      .set('Authorization', `Bearer ${reg.body.token}`).send({ minOrderQty: 300 })
    expect(res.status).toBe(200)
    expect(res.body.minOrderQty).toBe(300)
  })

  test('MOQ > quantité (même sans toucher à la quantité) est rejeté', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const offer = await createOffer(reg.body.token, { quantity: 500 })
    const res = await request(app).put(`/api/b2b/offers/${offer.id}`)
      .set('Authorization', `Bearer ${reg.body.token}`).send({ minOrderQty: 800 })
    expect(res.status).toBe(400)
  })

  test('réduire la quantité sous le MOQ existant (sans mettre à jour le MOQ) est rejeté', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const offer = await createOffer(reg.body.token, { quantity: 1000, minOrderQty: 500 })
    const res = await request(app).put(`/api/b2b/offers/${offer.id}`)
      .set('Authorization', `Bearer ${reg.body.token}`).send({ quantity: 300 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/MOQ/)
  })

  test('réduire la quantité ET le MOQ ensemble, de façon cohérente, fonctionne', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const offer = await createOffer(reg.body.token, { quantity: 1000, minOrderQty: 500 })
    const res = await request(app).put(`/api/b2b/offers/${offer.id}`)
      .set('Authorization', `Bearer ${reg.body.token}`).send({ quantity: 300, minOrderQty: 200 })
    expect(res.status).toBe(200)
    expect(res.body.quantity).toBe(300)
    expect(res.body.minOrderQty).toBe(200)
  })

  test('retirer un MOQ existant (null) est autorisé', async () => {
    const reg = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const offer = await createOffer(reg.body.token, { minOrderQty: 500 })
    const res = await request(app).put(`/api/b2b/offers/${offer.id}`)
      .set('Authorization', `Bearer ${reg.body.token}`).send({ minOrderQty: null })
    expect(res.status).toBe(200)
    expect(res.body.minOrderQty).toBeNull()
  })
})
