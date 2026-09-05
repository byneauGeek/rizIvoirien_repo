const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createDriverUser, signToken } = require('./helpers')

describe('LOT 12 — GET /api/drivers/vehicle-types (Espace livreur)', () => {
  test('un livreur voit le catalogue actif, amorcé s\'il est vide', async () => {
    const { user } = await createDriverUser()
    const res = await request(app).get('/api/drivers/vehicle-types').set('Authorization', `Bearer ${signToken(user)}`)
    expect(res.status).toBe(200)
    expect(res.body.vehicleTypes.length).toBeGreaterThanOrEqual(5)
    expect(res.body.vehicleTypes.map(v => v.code)).toEqual(expect.arrayContaining(['MOTO', 'VELO']))
    // Lecture seule : pas de maxDeliveryFee/capacityKg exposés, juste code+label
    expect(Object.keys(res.body.vehicleTypes[0]).sort()).toEqual(['code', 'label'])
  })

  test('reflète les catégories ajoutées par un admin, masque celles désactivées', async () => {
    // Codes dédiés à ce test, jamais les catégories par défaut partagées avec
    // les autres fichiers de test (éviter toute pollution inter-tests).
    await prisma.vehicleType.create({ data: { code: 'DRONE_T12', label: 'Drone', capacityKg: 5, active: true } })
    await prisma.vehicleType.create({ data: { code: 'BATEAU_T12', label: 'Bateau', capacityKg: 500, active: false } })

    const { user } = await createDriverUser()
    const res = await request(app).get('/api/drivers/vehicle-types').set('Authorization', `Bearer ${signToken(user)}`)
    const codes = res.body.vehicleTypes.map(v => v.code)
    expect(codes).toContain('DRONE_T12')
    expect(codes).not.toContain('BATEAU_T12')
  })

  test('un non-livreur ne peut pas y accéder', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(app).get('/api/drivers/vehicle-types').set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(403)
  })
})
