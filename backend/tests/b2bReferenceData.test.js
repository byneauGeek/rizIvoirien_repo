const request = require('supertest')
const app = require('../src/index')
const { createUser, prisma, signToken } = require('./helpers')

describe('B2B — listes de référence', () => {
  test('GET /api/b2b/reference-data est public et ne renvoie que les valeurs actives', async () => {
    await prisma.b2BReferenceItem.create({ data: { type: 'REGION', value: 'ZoneTestActive' } })
    await prisma.b2BReferenceItem.create({ data: { type: 'REGION', value: 'ZoneTestInactive', active: false } })

    const res = await request(app).get('/api/b2b/reference-data')
    expect(res.status).toBe(200)
    expect(res.body.regions).toContain('ZoneTestActive')
    expect(res.body.regions).not.toContain('ZoneTestInactive')
  })

  test('un non-admin ne peut pas gérer les listes de référence', async () => {
    const user = await createUser('BUYER')
    const res = await request(app).post('/api/admin/b2b/reference-data')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ type: 'REGION', value: 'Nouvelle zone' })
    expect(res.status).toBe(403)
  })

  test('un admin peut ajouter, désactiver puis supprimer une valeur', async () => {
    const admin = await createUser('ADMIN')

    const created = await request(app).post('/api/admin/b2b/reference-data')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ type: 'PRODUCT', value: 'Riz étuvé test' })
    expect(created.status).toBe(201)

    const deactivated = await request(app).put(`/api/admin/b2b/reference-data/${created.body.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ active: false })
    expect(deactivated.status).toBe(200)
    expect(deactivated.body.active).toBe(false)

    const publicList = await request(app).get('/api/b2b/reference-data')
    expect(publicList.body.products).not.toContain('Riz étuvé test')

    const removed = await request(app).delete(`/api/admin/b2b/reference-data/${created.body.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(removed.status).toBe(200)
  })

  test('une valeur en double pour le même type est rejetée', async () => {
    const admin = await createUser('ADMIN')
    await request(app).post('/api/admin/b2b/reference-data')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ type: 'UNIT', value: 'litre-test' })
    const dup = await request(app).post('/api/admin/b2b/reference-data')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ type: 'UNIT', value: 'litre-test' })
    expect(dup.status).toBe(409)
  })
})
