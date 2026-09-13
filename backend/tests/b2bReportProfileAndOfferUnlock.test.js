// Phase 1 (post-audit) — deux fixes B2B :
// 1. Signalement de profil (targetType=PROFILE) : déjà accepté côté backend,
//    jamais envoyé par l'interface. Aucun changement backend n'était requis
//    — ce test prouve simplement que le chemin existant fonctionne de bout
//    en bout pour ce type de cible, comme pour OFFER/REQUEST.
// 2. Déblocage d'offre RESERVED : PUT /offers/:id acceptait déjà status=
//    AVAILABLE, mais rien ne le proposait au vendeur. Une offre RESERVED
//    (déclaration partielle, stock restant > 0) est invisible dans
//    GET /b2b/offers (filtré sur status=AVAILABLE) tant qu'elle n'est pas
//    explicitement remise à AVAILABLE.
const request = require('supertest')
const app = require('../src/index')
const { createUser, prisma, uniqueEmail } = require('./helpers')

async function registerB2B(profileType, profile, overrides = {}) {
  const email = overrides.email || uniqueEmail(profileType.toLowerCase())
  const res = await request(app).post('/api/auth/register-b2b').send({
    profileType, email, password: 'Password123!', name: overrides.name || `${profileType} test`, profile,
  })
  return res
}

describe('Signalement de profil B2B (targetType=PROFILE)', () => {
  test('un acheteur peut signaler le profil d\'un producteur', async () => {
    const seller = await registerB2B('PRODUCER', { region: 'Man' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME' })
    const producer = await prisma.producer.findUnique({ where: { userId: seller.body.user.id } })

    const res = await request(app).post('/api/b2b/reports')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({ targetType: 'PROFILE', targetId: producer.id, reason: 'Documents suspects' })
    expect(res.status).toBe(201)
    expect(res.body.targetType).toBe('PROFILE')
    expect(res.body.targetId).toBe(producer.id)

    const admin = await createUser('ADMIN')
    const list = await request(app).get('/api/admin/b2b/reports')
      .set('Authorization', `Bearer ${require('./helpers').signToken(admin)}`)
    expect(list.body.reports.some(r => r.id === res.body.id)).toBe(true)
  })
})

describe('Déblocage d\'une offre RESERVED', () => {
  test('une offre RESERVED avec stock restant est invisible du marketplace tant qu\'elle n\'est pas remise AVAILABLE', async () => {
    const { signToken } = require('./helpers')
    const seller = await registerB2B('PRODUCER', { region: 'Bouaké' })
    const buyer = await registerB2B('TRADER', { companyName: 'ACME2' })
    const offer = await request(app).post('/api/b2b/offers').set('Authorization', `Bearer ${seller.body.token}`)
      .send({ product: `Riz reserve test ${Date.now()}`, quantity: 50, unit: 'tonne', region: 'Bouaké' })
    const contact = await request(app).post('/api/b2b/contacts')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ offerId: offer.body.id })
    await request(app).post(`/api/b2b/contacts/${contact.body.id}/accept`).set('Authorization', `Bearer ${seller.body.token}`)
    await request(app).post('/api/b2b/transactions')
      .set('Authorization', `Bearer ${buyer.body.token}`).send({ contactId: contact.body.id, quantity: 20 })

    const reserved = await prisma.riceOffer.findUnique({ where: { id: offer.body.id } })
    expect(reserved.status).toBe('RESERVED')
    expect(reserved.quantity).toBe(30) // 50 - 20, encore vendable

    const hiddenListing = await request(app).get(`/api/b2b/offers?product=${encodeURIComponent(offer.body.product)}`)
    expect(hiddenListing.body.offers.some(o => o.id === offer.body.id)).toBe(false)

    // Un autre vendeur ne peut pas débloquer l'offre d'autrui.
    const stranger = await registerB2B('PRODUCER', { region: 'Daloa' })
    const forbidden = await request(app).put(`/api/b2b/offers/${offer.body.id}`)
      .set('Authorization', `Bearer ${stranger.body.token}`).send({ status: 'AVAILABLE' })
    expect(forbidden.status).toBe(404)

    const unlock = await request(app).put(`/api/b2b/offers/${offer.body.id}`)
      .set('Authorization', `Bearer ${seller.body.token}`).send({ status: 'AVAILABLE' })
    expect(unlock.status).toBe(200)
    expect(unlock.body.status).toBe('AVAILABLE')

    const visibleAgain = await request(app).get(`/api/b2b/offers?product=${encodeURIComponent(offer.body.product)}`)
    expect(visibleAgain.body.offers.some(o => o.id === offer.body.id)).toBe(true)
  })
})
