const request = require('supertest')
const express = require('express')
const app = require('../src/index')
const { createUser, prisma, signToken, uniqueEmail } = require('./helpers')
const { authenticate } = require('../src/middleware/auth')
const { requirePermission } = require('../src/middleware/accounting')

describe('Comptabilité — accès à /api/accounting/me', () => {
  test('un utilisateur sans rôle comptable est refusé', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(app).get('/api/accounting/me').set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(403)
  })

  test('sans aucun token → 401', async () => {
    const res = await request(app).get('/api/accounting/me')
    expect(res.status).toBe(401)
  })

  test('un ADMIN reçoit implicitement toutes les permissions comptables', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).get('/api/accounting/me').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('ADMIN')
    expect(res.body.permissions).toContain('accounting.payments.execute')
    expect(res.body.permissions.length).toBeGreaterThan(15)
  })

  test('un ACCOUNTANT sans permission attribuée reçoit une liste vide (jamais tout par défaut)', async () => {
    const accountant = await createUser('ACCOUNTANT')
    const res = await request(app).get('/api/accounting/me').set('Authorization', `Bearer ${signToken(accountant)}`)
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('ACCOUNTANT')
    expect(res.body.permissions).toEqual([])
  })
})

describe('Comptabilité — gestion admin du rôle', () => {
  test('un non-admin ne peut pas accéder aux routes de gestion comptable', async () => {
    const accountant = await createUser('ACCOUNTANT')
    const res = await request(app).get('/api/admin/accounting/accountants').set('Authorization', `Bearer ${signToken(accountant)}`)
    expect(res.status).toBe(403)
  })

  test('un admin peut créer un compte comptable dédié', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(app).post('/api/admin/accounting/accountants/create')
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ name: 'Comptable Test', email: uniqueEmail('accountant'), password: 'Password123!' })
    expect(res.status).toBe(201)
    expect(res.body.role).toBe('ACCOUNTANT')
  })

  test('un admin peut promouvoir un utilisateur existant', async () => {
    const admin = await createUser('ADMIN')
    const buyer = await createUser('BUYER')
    const res = await request(app).post(`/api/admin/accounting/accountants/${buyer.id}/promote`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('ACCOUNTANT')

    const log = await prisma.adminLog.findFirst({ where: { action: 'ACCOUNTANT_PROMOTE', targetId: buyer.id } })
    expect(log).toBeTruthy()
  })

  test('impossible de promouvoir un admin', async () => {
    const admin = await createUser('ADMIN')
    const otherAdmin = await createUser('ADMIN')
    const res = await request(app).post(`/api/admin/accounting/accountants/${otherAdmin.id}/promote`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(400)
  })

  test('impossible de promouvoir deux fois le même utilisateur', async () => {
    const admin = await createUser('ADMIN')
    const buyer = await createUser('BUYER')
    await request(app).post(`/api/admin/accounting/accountants/${buyer.id}/promote`).set('Authorization', `Bearer ${signToken(admin)}`)
    const second = await request(app).post(`/api/admin/accounting/accountants/${buyer.id}/promote`).set('Authorization', `Bearer ${signToken(admin)}`)
    expect(second.status).toBe(400)
  })

  test('attribution de permissions : rejette une valeur inconnue', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await createUser('ACCOUNTANT')
    const res = await request(app).put(`/api/admin/accounting/accountants/${accountant.id}/permissions`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ permissions: ['accounting.view', 'not_a_real_permission'] })
    expect(res.status).toBe(400)
  })

  test('attribution de permissions : remplace l\'ensemble et journalise avant/après', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await createUser('ACCOUNTANT')

    await request(app).put(`/api/admin/accounting/accountants/${accountant.id}/permissions`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ permissions: ['accounting.view', 'accounting.transactions.view'] })

    const replaced = await request(app).put(`/api/admin/accounting/accountants/${accountant.id}/permissions`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ permissions: ['accounting.payments.execute'] })
    expect(replaced.status).toBe(200)

    const me = await request(app).get('/api/accounting/me').set('Authorization', `Bearer ${signToken(accountant)}`)
    expect(me.body.permissions).toEqual(['accounting.payments.execute'])

    const log = await prisma.adminLog.findFirst({
      where: { action: 'ACCOUNTANT_PERMISSIONS_UPDATE', targetId: accountant.id },
      orderBy: { id: 'desc' },
    })
    const details = JSON.parse(log.details)
    expect([...details.before].sort()).toEqual(['accounting.transactions.view', 'accounting.view'])
    expect(details.after).toEqual(['accounting.payments.execute'])
  })

  test('rétrograder un comptable retire le rôle et efface ses permissions', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await createUser('ACCOUNTANT')
    await request(app).put(`/api/admin/accounting/accountants/${accountant.id}/permissions`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ permissions: ['accounting.view'] })

    const demote = await request(app).post(`/api/admin/accounting/accountants/${accountant.id}/demote`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(demote.status).toBe(200)

    const remaining = await prisma.accountingPermission.findMany({ where: { userId: accountant.id } })
    expect(remaining.length).toBe(0)

    const after = await request(app).get('/api/accounting/me').set('Authorization', `Bearer ${signToken(accountant)}`)
    // Le token porte encore role=ACCOUNTANT (JWT non révocable immédiatement),
    // mais authenticate() recharge l'utilisateur depuis la DB à chaque requête —
    // donc req.user.role reflète bien le nouveau rôle BUYER, plus d'accès.
    expect(after.status).toBe(403)
  })
})

describe('Comptabilité — middleware requirePermission (isolé)', () => {
  // Aucune route métier n'utilise encore requirePermission (arrive au LOT 2) —
  // on vérifie le comportement de la fonction elle-même sur une mini-app de test.
  const testApp = express()
  testApp.use(express.json())
  testApp.get('/probe', authenticate, requirePermission('accounting.payments.execute'), (req, res) => res.json({ ok: true }))

  test('ADMIN passe toujours, sans permission attribuée', async () => {
    const admin = await createUser('ADMIN')
    const res = await request(testApp).get('/probe').set('Authorization', `Bearer ${signToken(admin)}`)
    expect(res.status).toBe(200)
  })

  test('ACCOUNTANT sans la permission précise est bloqué', async () => {
    const accountant = await createUser('ACCOUNTANT')
    const res = await request(testApp).get('/probe').set('Authorization', `Bearer ${signToken(accountant)}`)
    expect(res.status).toBe(403)
  })

  test('ACCOUNTANT avec la permission précise passe', async () => {
    const admin = await createUser('ADMIN')
    const accountant = await createUser('ACCOUNTANT')
    await request(app).put(`/api/admin/accounting/accountants/${accountant.id}/permissions`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ permissions: ['accounting.payments.execute'] })

    const res = await request(testApp).get('/probe').set('Authorization', `Bearer ${signToken(accountant)}`)
    expect(res.status).toBe(200)
  })

  test('un rôle non-comptable est bloqué même avec un token valide', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(testApp).get('/probe').set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(403)
  })
})
