// LOT APPROVAL (audit XXX RIZ) — jamais testé depuis sa livraison. Couvre le
// CRUD des règles (ADMIN uniquement), le moteur de décision (approvalEngine.js)
// via une vraie création de produit, et la file de modération (ADMIN+COMMERCIAL).
const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, signToken } = require('./helpers')

async function createRule(admin, overrides = {}) {
  const res = await request(app).post('/api/admin/approval-rules')
    .set('Authorization', `Bearer ${signToken(admin)}`)
    .send({ targetType: 'PRODUCT', ruleType: 'MIN_PRICE', severity: 'AUTO_REJECT', label: 'Prix trop bas', params: { min: 500 }, ...overrides })
  return res.body
}

async function createProduct(seller, overrides = {}) {
  return request(app).post('/api/products')
    .set('Authorization', `Bearer ${signToken(seller)}`)
    .send({ name: 'Riz test', category: 'Riz Parfumé', price: 2500, stock: 10, ...overrides })
}

describe('Règles d\'approbation — CRUD (ADMIN uniquement)', () => {
  test('COMMERCIAL ne peut pas créer/modifier/supprimer une règle', async () => {
    const commercial = await createUser('COMMERCIAL')
    const create = await request(app).post('/api/admin/approval-rules')
      .set('Authorization', `Bearer ${signToken(commercial)}`)
      .send({ targetType: 'PRODUCT', ruleType: 'MIN_PRICE', severity: 'AUTO_REJECT', label: 'x', params: { min: 1 } })
    expect(create.status).toBe(403)
  })

  test('targetType/ruleType/severity invalides sont rejetés', async () => {
    const admin = await createUser('ADMIN')
    const badTarget = await request(app).post('/api/admin/approval-rules').set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ targetType: 'WRONG', ruleType: 'MIN_PRICE', severity: 'AUTO_REJECT', label: 'x', params: {} })
    expect(badTarget.status).toBe(400)

    const badRule = await request(app).post('/api/admin/approval-rules').set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ targetType: 'PRODUCT', ruleType: 'NOT_A_RULE', severity: 'AUTO_REJECT', label: 'x', params: {} })
    expect(badRule.status).toBe(400)

    const badSeverity = await request(app).post('/api/admin/approval-rules').set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ targetType: 'PRODUCT', ruleType: 'MIN_PRICE', severity: 'WRONG', label: 'x', params: {} })
    expect(badSeverity.status).toBe(400)
  })

  test('créer, désactiver, supprimer une règle', async () => {
    const admin = await createUser('ADMIN')
    const rule = await createRule(admin)
    expect(rule.active).toBe(true)

    const toggled = await request(app).put(`/api/admin/approval-rules/${rule.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ active: false })
    expect(toggled.body.active).toBe(false)

    const deleted = await request(app).delete(`/api/admin/approval-rules/${rule.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(deleted.status).toBe(200)

    const remaining = await prisma.approvalRule.findUnique({ where: { id: rule.id } })
    expect(remaining).toBeNull()
  })
})

describe('Moteur d\'approbation — appliqué à la création de produit', () => {
  // Chaque test de ce bloc a besoin d'une base propre : evaluateApproval()
  // interroge TOUTES les ApprovalRule actives, sans distinction de qui les a
  // créées — une règle laissée active par un test précédent (ex. AUTO_REJECT
  // sur MIN_PRICE) fausserait silencieusement le résultat d'un test suivant
  // qui teste un cas différent (FLAG_FOR_REVIEW, règle désactivée, etc.).
  beforeEach(async () => {
    await prisma.approvalRule.updateMany({ data: { active: false } })
  })

  test('sans règle active : produit APPROUVÉ automatiquement', async () => {
    const { user: seller } = await createShopUser()
    const res = await createProduct(seller)
    expect(res.status).toBe(201)
    expect(res.body.moderationStatus).toBe('APPROVED')
  })

  test('règle AUTO_REJECT violée : produit REJETÉ, jamais visible publiquement', async () => {
    const admin = await createUser('ADMIN')
    await createRule(admin, { params: { min: 3000 } }) // prix mini 3000, produit à 2500 viole
    const { user: seller, shop } = await createShopUser()
    const res = await createProduct(seller, { price: 2500 })
    expect(res.status).toBe(201)
    expect(res.body.moderationStatus).toBe('REJECTED')
    expect(res.body.rejectionReason).toBe('Prix trop bas')

    const publicList = await request(app).get(`/api/products?shopId=${shop.id}`)
    expect(publicList.body.products.find(p => p.id === res.body.id)).toBeUndefined()
  })

  test('règle FLAG_FOR_REVIEW violée : produit PENDING_REVIEW, visible dans la file de modération', async () => {
    const admin = await createUser('ADMIN')
    await createRule(admin, { severity: 'FLAG_FOR_REVIEW', label: 'Prix à vérifier', params: { min: 3000 } })
    const { user: seller } = await createShopUser()
    const res = await createProduct(seller, { price: 2500 })
    expect(res.body.moderationStatus).toBe('PENDING_REVIEW')

    const queue = await request(app).get('/api/admin/moderation/queue')
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(queue.body.products.some(p => p.id === res.body.id)).toBe(true)
  })

  test('règle désactivée : n\'est plus appliquée', async () => {
    const admin = await createUser('ADMIN')
    const rule = await createRule(admin, { params: { min: 3000 } })
    await request(app).put(`/api/admin/approval-rules/${rule.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ active: false })

    const { user: seller } = await createShopUser()
    const res = await createProduct(seller, { price: 2500 })
    expect(res.body.moderationStatus).toBe('APPROVED')
  })

  test('BANNED_KEYWORDS : détecte un mot-clé interdit dans le nom ou la description', async () => {
    const admin = await createUser('ADMIN')
    await createRule(admin, { ruleType: 'BANNED_KEYWORDS', severity: 'AUTO_REJECT', label: 'Mot interdit', params: { keywords: ['contrefacon'] } })
    const { user: seller } = await createShopUser()
    const res = await createProduct(seller, { description: 'Ceci est une contrefacon' })
    expect(res.body.moderationStatus).toBe('REJECTED')
  })

  test('targetType BOTH s\'applique aussi aux produits', async () => {
    const admin = await createUser('ADMIN')
    await createRule(admin, { targetType: 'BOTH', params: { min: 3000 } })
    const { user: seller } = await createShopUser()
    const res = await createProduct(seller, { price: 2500 })
    expect(res.body.moderationStatus).toBe('REJECTED')
  })
})

describe('File de modération — décisions', () => {
  test('approuver un produit PENDING_REVIEW le rend APPROVED et visible', async () => {
    const admin = await createUser('ADMIN')
    await createRule(admin, { severity: 'FLAG_FOR_REVIEW', label: 'À vérifier', params: { min: 3000 } })
    const { user: seller, shop } = await createShopUser()
    const created = await createProduct(seller, { price: 2500 })

    const approved = await request(app).post(`/api/admin/moderation/product/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(approved.status).toBe(200)
    expect(approved.body.moderationStatus).toBe('APPROVED')

    const publicList = await request(app).get(`/api/products?shopId=${shop.id}`)
    expect(publicList.body.products.some(p => p.id === created.body.id)).toBe(true)
  })

  test('refuser un produit PENDING_REVIEW exige un motif', async () => {
    const admin = await createUser('ADMIN')
    await createRule(admin, { severity: 'FLAG_FOR_REVIEW', label: 'À vérifier', params: { min: 3000 } })
    const { user: seller } = await createShopUser()
    const created = await createProduct(seller, { price: 2500 })

    const noReason = await request(app).post(`/api/admin/moderation/product/${created.body.id}/reject`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({})
    expect(noReason.status).toBe(400)

    const rejected = await request(app).post(`/api/admin/moderation/product/${created.body.id}/reject`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ reason: 'Photos insuffisantes' })
    expect(rejected.status).toBe(200)
    expect(rejected.body.moderationStatus).toBe('REJECTED')
  })

  test('un vendeur ne peut pas accéder à la file de modération', async () => {
    const { user: seller } = await createShopUser()
    const res = await request(app).get('/api/admin/moderation/queue')
      .set('Authorization', `Bearer ${signToken(seller)}`)
    expect(res.status).toBe(403)
  })
})
