const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, signToken } = require('./helpers')

describe('LOT 4 — VehicleType', () => {
  test('le premier GET amorce 5 catégories par défaut', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/admin/logistics/vehicle-types').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.vehicleTypes.length).toBeGreaterThanOrEqual(5)
    expect(res.body.vehicleTypes.map(v => v.code)).toEqual(expect.arrayContaining(['MOTO', 'VELO', 'TRICYCLE', 'VOITURE', 'CAMIONNETTE']))
  })

  test('amorçage idempotent : un second GET ne duplique pas', async () => {
    const admin = await createUser('ADMIN')
    await request(app).get('/api/admin/logistics/vehicle-types').set('Authorization', `Bearer ${signToken(admin)}`)
    const res = await request(app).get('/api/admin/logistics/vehicle-types').set('Authorization', `Bearer ${signToken(admin)}`)
    const codes = res.body.vehicleTypes.map(v => v.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  test('création rejette un code dupliqué (409)', async () => {
    const admin = await createUser('ADMIN')
    await request(app).post('/api/admin/logistics/vehicle-types').set('Authorization', `Bearer ${signToken(admin)}`).send({ code: 'DRONE', label: 'Drone', capacityKg: 5 })
    const res = await request(app).post('/api/admin/logistics/vehicle-types').set('Authorization', `Bearer ${signToken(admin)}`).send({ code: 'drone', label: 'Drone bis', capacityKg: 3 })
    expect(res.status).toBe(409)
  })

  test('un non-admin ne peut pas accéder aux référentiels logistiques', async () => {
    const seller = await createUser('SELLER')
    const res = await request(app).get('/api/admin/logistics/vehicle-types').set('Authorization', `Bearer ${signToken(seller)}`)
    expect(res.status).toBe(403)
  })

  test('update et delete fonctionnent', async () => {
    const admin = await createUser('ADMIN')
    const created = await request(app).post('/api/admin/logistics/vehicle-types').set('Authorization', `Bearer ${signToken(admin)}`).send({ code: 'BATEAU', label: 'Bateau', capacityKg: 2000 })
    const id = created.body.vehicleType.id

    const updated = await request(app).put(`/api/admin/logistics/vehicle-types/${id}`).set('Authorization', `Bearer ${signToken(admin)}`).send({ capacityKg: 2500, active: false })
    expect(updated.status).toBe(200)
    expect(updated.body.vehicleType.capacityKg).toBe(2500)
    expect(updated.body.vehicleType.active).toBe(false)

    const deleted = await request(app).delete(`/api/admin/logistics/vehicle-types/${id}`).set('Authorization', `Bearer ${signToken(admin)}`)
    expect(deleted.status).toBe(204)
  })
})

describe('LOT 4 — Zone & Hub', () => {
  test('CRUD zone complet', async () => {
    const admin = await createUser('ADMIN')
    const created = await request(app).post('/api/admin/logistics/zones').set('Authorization', `Bearer ${signToken(admin)}`).send({ name: 'Abidjan Nord', city: 'Abidjan' })
    expect(created.status).toBe(201)
    const zoneId = created.body.zone.id

    const list = await request(app).get('/api/admin/logistics/zones').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(list.body.zones.some(z => z.id === zoneId)).toBe(true)

    const updated = await request(app).put(`/api/admin/logistics/zones/${zoneId}`).set('Authorization', `Bearer ${signToken(admin)}`).send({ name: 'Abidjan Nord-Est' })
    expect(updated.body.zone.name).toBe('Abidjan Nord-Est')
  })

  test('un hub peut être rattaché à une zone puis la zone supprimée sans supprimer le hub', async () => {
    const admin = await createUser('ADMIN')
    const zone = await prisma.zone.create({ data: { name: 'Yopougon', city: 'Abidjan' } })
    const hubRes = await request(app).post('/api/admin/logistics/hubs').set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ name: 'Hub Yopougon', address: 'Rue 12', zoneId: zone.id, latitude: 5.34, longitude: -4.09 })
    expect(hubRes.status).toBe(201)
    const hubId = hubRes.body.hub.id

    await request(app).delete(`/api/admin/logistics/zones/${zone.id}`).set('Authorization', `Bearer ${signToken(admin)}`)

    const hub = await prisma.hub.findUnique({ where: { id: hubId } })
    expect(hub).toBeTruthy()
    expect(hub.zoneId).toBeNull()
  })

  test('création hub sans address rejetée (400)', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).post('/api/admin/logistics/hubs').set('Authorization', `Bearer ${signToken(admin)}`).send({ name: 'Hub sans adresse' })
    expect(res.status).toBe(400)
  })
})
