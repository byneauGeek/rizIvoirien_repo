const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate, requireRole } = require('../middleware/auth')
const { uploadCsv } = require('../middleware/upload')
const Papa = require('papaparse')
const Anthropic = require('@anthropic-ai/sdk')
const stockEngine = require('../services/stockEngine')

const slugify = (str) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now()

// ── Générateur local (fallback sans clé API) ─────────────────────────────────
function generateLocally({ productType, origin, quality, packaging, highlight }) {
  const type = productType.trim()

  // Titre : assemblage des éléments disponibles
  const parts = [type]
  if (quality)   parts.push(quality)
  if (origin)    parts.push(`de ${origin}`)
  if (packaging) parts.push(`— ${packaging}`)
  const name = parts.join(' ')

  // Description : phrases construites selon les infos fournies
  const sentences = []

  // Phrase 1 — intro produit
  if (quality && origin) {
    sentences.push(`Découvrez notre ${type} ${quality}, soigneusement sélectionné en provenance de ${origin}.`)
  } else if (origin) {
    sentences.push(`Découvrez notre ${type} en provenance directe de ${origin}, alliant saveur authentique et qualité irréprochable.`)
  } else if (quality) {
    sentences.push(`Notre ${type} ${quality} est rigoureusement sélectionné pour vous offrir une expérience culinaire exceptionnelle.`)
  } else {
    sentences.push(`Découvrez notre ${type}, un incontournable de la cuisine ivoirienne alliant qualité et authenticité.`)
  }

  // Phrase 2 — conditionnement
  if (packaging) {
    sentences.push(`Disponible en ${packaging}, il s'adapte aussi bien aux foyers qu'aux professionnels de la restauration.`)
  } else {
    sentences.push(`Disponible en plusieurs conditionnements pour répondre à tous vos besoins, du particulier au professionnel.`)
  }

  // Phrase 3 — point fort ou accroche finale
  if (highlight) {
    sentences.push(`${highlight} — une garantie de fraîcheur et de traçabilité pour votre satisfaction totale.`)
  } else {
    sentences.push(`Commandez dès aujourd'hui et profitez d'une livraison rapide directement chez vous en Côte d'Ivoire.`)
  }

  return { name, description: sentences.join(' ') }
}

// POST /api/products/generate — génération IA de titre + description
router.post('/generate', authenticate, requireRole('SELLER'), async (req, res) => {
  const { productType, origin, quality, packaging, highlight } = req.body
  if (!productType) return res.status(400).json({ error: 'Type de produit requis' })

  // ── Fallback local si pas de clé API ──────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ ...generateLocally({ productType, origin, quality, packaging, highlight }), source: 'local' })
  }

  // ── Génération via Claude ─────────────────────────────────────────────────
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `Tu es un expert en marketing de produits alimentaires africains pour la marketplace RizIvoirien (Côte d'Ivoire).
Génère un nom de produit accrocheur et une description commerciale courte (3 phrases max) pour ce produit :
- Type : ${productType}
${origin    ? `- Origine : ${origin}`            : ''}
${quality   ? `- Qualité : ${quality}`           : ''}
${packaging ? `- Conditionnement : ${packaging}` : ''}
${highlight ? `- Point fort : ${highlight}`      : ''}

Réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaire :
{"name": "...", "description": "..."}`

    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].text.trim()
    // Extraire le JSON même si Claude ajoute du texte autour
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Format de réponse inattendu')
    const json = JSON.parse(match[0])
    if (!json.name || !json.description) throw new Error('Réponse IA incomplète')
    res.json({ ...json, source: 'ai' })
  } catch (e) {
    // Si Claude échoue, on tombe sur le générateur local plutôt que de planter
    console.warn('[generate] Claude KO, fallback local :', e.message)
    res.json({ ...generateLocally({ productType, origin, quality, packaging, highlight }), source: 'local' })
  }
})

// GET /api/products — public, filtres: category, shopId, certified, priceMax, search
router.get('/', async (req, res) => {
  const { category, shopId, certified, priceMax, search, sort = 'createdAt', limit = '20', offset = '0' } = req.query
  try {
    const where = { active: true }
    if (category) where.category = category
    if (shopId) where.shopId = Number(shopId)
    if (search) where.name = { contains: search }
    if (priceMax) where.price = { lte: Number(priceMax) }
    // Only show products from active shops that have signed their contract
    where.shop = { status: 'ACTIVE', contractSigned: true }
    if (certified === 'true') where.shop.certified = true

    const orderBy = {
      price_asc: { price: 'asc' },
      price_desc: { price: 'desc' },
      rating: { shop: { rating: 'desc' } },
    }[sort] || { createdAt: 'desc' }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { shop: { select: { id: true, name: true, certified: true, rating: true } } },
        orderBy,
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.product.count({ where }),
    ])

    res.json({ products, total, limit: Number(limit), offset: Number(offset) })
  } catch (e) {
    sendError(res, e)
  }
})

// GET /api/products/categories — catégories distinctes avec comptage
router.get('/categories', async (req, res) => {
  try {
    const raw = await prisma.product.groupBy({
      by: ['category'],
      where: { active: true },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })
    res.json(raw.map(r => ({ category: r.category, count: r._count.id })))
  } catch (e) {
    sendError(res, e)
  }
})

// GET /api/products/shop/mine — seller: ses produits (paginés)
// ⚠ Doit être AVANT /:slug sinon Express capte "shop" comme slug
router.get('/shop/mine', authenticate, requireRole('SELLER'), async (req, res) => {
  const { search, category, saleType, limit = '20', offset = '0' } = req.query
  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id } })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })

    const where = { shopId: shop.id }
    if (search)   where.name     = { contains: search }
    if (category) where.category = category
    if (saleType && ['RETAIL', 'WHOLESALE', 'BOTH'].includes(saleType)) where.saleType = saleType

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.product.count({ where }),
    ])

    res.json({ products, total, limit: Number(limit), offset: Number(offset) })
  } catch (e) {
    sendError(res, e)
  }
})

// GET /api/products/:slug — public
router.get('/:slug', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: { shop: { select: { id: true, name: true, certified: true, rating: true, reviewCount: true, location: true } } },
    })
    if (!product) return res.status(404).json({ error: 'Produit introuvable' })
    res.json(product)
  } catch (e) {
    sendError(res, e)
  }
})

// POST /api/products — seller
router.post('/', authenticate, requireRole('SELLER'), async (req, res) => {
  const { name, description, category, price, unit, stock, images, badge, origin, harvest, saleType, wholesalePrice, minWholesaleQty } = req.body
  if (!name || !category || !price) return res.status(400).json({ error: 'Champs requis manquants' })
  if (!Number.isFinite(Number(price)) || Number(price) <= 0) return res.status(400).json({ error: 'Prix invalide' })
  if (stock !== undefined && (!Number.isFinite(Number(stock)) || Number(stock) < 0)) return res.status(400).json({ error: 'Stock invalide' })
  if (wholesalePrice != null && wholesalePrice !== '' && (!Number.isFinite(Number(wholesalePrice)) || Number(wholesalePrice) <= 0)) return res.status(400).json({ error: 'Prix de gros invalide' })

  try {
    const [shop, settings] = await Promise.all([
      prisma.shop.findUnique({ where: { userId: req.user.id } }),
      prisma.platformSettings.findUnique({ where: { id: 1 } }),
    ])
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })

    const limit = settings?.basicMaxProducts ?? 0
    if (limit > 0 && shop.plan === 'BASIC') {
      const activeCount = await prisma.product.count({ where: { shopId: shop.id, active: true } })
      if (activeCount >= limit) return res.status(403).json({
        error: `Plan BASIC : limite de ${limit} produits actifs atteinte. Passez au plan Certifié pour continuer.`,
        code: 'PRODUCT_LIMIT_REACHED',
      })
    }

    // Le produit est créé avec stock=0, puis stockEngine.initializeStock (LOT 5)
    // l'amène à sa quantité initiale dans la même transaction — jamais une
    // écriture directe de `stock` en dehors du Stock Engine.
    const initialStock = Number(stock) || 0
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          shopId: shop.id,
          name,
          slug: slugify(name),
          description,
          category,
          price: Number(price),
          pricePerKg: Math.round(Number(price) / (Number(unit?.replace(/[^0-9]/g, '') || 5))),
          unit: unit || '5kg',
          stock: 0,
          images: JSON.stringify(images || []),
          badge:    badge    || null,
          origin:   origin   || null,
          harvest:  harvest  || null,
          saleType: ['RETAIL','WHOLESALE','BOTH'].includes(saleType) ? saleType : 'BOTH',
          wholesalePrice:  wholesalePrice  != null && wholesalePrice  !== '' ? Number(wholesalePrice)  : null,
          minWholesaleQty: minWholesaleQty != null && minWholesaleQty !== '' ? Number(minWholesaleQty) : null,
        },
      })
      await stockEngine.initializeStock(tx, { productId: created.id, quantity: initialStock, actorId: req.user.id })
      return tx.product.findUnique({ where: { id: created.id } })
    })
    res.status(201).json(product)
  } catch (e) {
    sendError(res, e)
  }
})

// PUT /api/products/:id — seller
router.put('/:id', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const [shop, settings] = await Promise.all([
      prisma.shop.findUnique({ where: { userId: req.user.id } }),
      prisma.platformSettings.findUnique({ where: { id: 1 } }),
    ])
    const product = await prisma.product.findFirst({
      where: { id: Number(req.params.id), shopId: shop?.id },
    })
    if (!product) return res.status(404).json({ error: 'Produit introuvable' })

    // Limit check when activating a product
    const limit = settings?.basicMaxProducts ?? 0
    if (limit > 0 && shop?.plan === 'BASIC' && req.body.active === true && !product.active) {
      const activeCount = await prisma.product.count({ where: { shopId: shop.id, active: true } })
      if (activeCount >= limit) return res.status(403).json({
        error: `Plan BASIC : limite de ${limit} produits actifs atteinte. Passez au plan Certifié pour continuer.`,
        code: 'PRODUCT_LIMIT_REACHED',
      })
    }

    // ── Détection des changements ─────────────────────────────────────────────
    // `stock` n'est plus modifiable ici depuis le LOT 5 (Stock Engine) — toute
    // écriture directe et absolue de la quantité était le risque principal
    // identifié par l'audit (§0.4) : aucun motif, aucun mouvement tracé. Le
    // champ est ignoré s'il est envoyé ; passer par POST /:id/adjust-stock.
    const TRACKED = {
      name:        'Nom',
      description: 'Description',
      category:    'Catégorie',
      price:       'Prix',
      unit:        'Unité',
      badge:       'Badge',
      origin:      'Origine',
      harvest:     'Récolte',
      saleType:        'Type de vente',
      wholesalePrice:  'Prix gros',
      minWholesaleQty: 'Qté min gros',
      active:          'Statut',
    }
    const changes = []
    for (const [field, label] of Object.entries(TRACKED)) {
      if (!(field in req.body)) continue
      let oldVal = product[field]
      let newVal = req.body[field]
      // Normalisation numérique
      if (field === 'price')           { oldVal = Number(oldVal); newVal = Number(newVal) }
      if (field === 'wholesalePrice')  { oldVal = oldVal != null ? Number(oldVal) : null; newVal = newVal != null && newVal !== '' ? Number(newVal) : null }
      if (field === 'minWholesaleQty') { oldVal = oldVal != null ? Number(oldVal) : null; newVal = newVal != null && newVal !== '' ? Number(newVal) : null }
      if (field === 'active')          { oldVal = Boolean(oldVal); newVal = Boolean(newVal) }
      if (String(oldVal) !== String(newVal)) {
        changes.push({ field, label, from: oldVal, to: newVal })
      }
    }

    // Champs modifiables par le vendeur uniquement — jamais shopId, rating, reviewCount, slug, createdAt, id...
    const EDITABLE_FIELDS = ['name', 'description', 'category', 'unit', 'badge', 'origin', 'harvest', 'saleType', 'active']
    const data = {}
    for (const field of EDITABLE_FIELDS) {
      if (field in req.body) data[field] = req.body[field]
    }
    if (data.saleType && !['RETAIL', 'WHOLESALE', 'BOTH'].includes(data.saleType)) delete data.saleType

    if (req.body.price !== undefined) {
      const price = Number(req.body.price)
      if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'Prix invalide' })
      data.price = price
    }
    if (req.body.images !== undefined) data.images = JSON.stringify(req.body.images)
    if ('wholesalePrice' in req.body) {
      const wp = req.body.wholesalePrice
      if (wp != null && wp !== '') {
        const n = Number(wp)
        if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: 'Prix de gros invalide' })
        data.wholesalePrice = n
      } else data.wholesalePrice = null
    }
    if ('minWholesaleQty' in req.body) {
      const mq = req.body.minWholesaleQty
      if (mq != null && mq !== '') {
        const n = Number(mq)
        if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: 'Quantité min. de gros invalide' })
        data.minWholesaleQty = n
      } else data.minWholesaleQty = null
    }
    data.updatedAt = new Date()

    const updated = await prisma.product.update({
      where: { id: product.id },
      data,
    })

    // Enregistrement de l'historique si des champs ont changé
    if (changes.length > 0) {
      await prisma.productHistory.create({
        data: {
          productId: product.id,
          actorId:   req.user.id,
          actorName: req.user.name || 'Vendeur',
          changes:   JSON.stringify(changes),
        },
      })
    }

    res.json(updated)
  } catch (e) {
    sendError(res, e)
  }
})

// GET /api/products/:id/history — seller : historique de modifications
// ⚠ Doit être AVANT /:id seul — mais ici c'est un sous-chemin donc ça va
router.get('/:id/history', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id } })
    const product = await prisma.product.findFirst({
      where: { id: Number(req.params.id), shopId: shop?.id },
    })
    if (!product) return res.status(404).json({ error: 'Produit introuvable' })

    const history = await prisma.productHistory.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    res.json(history.map(h => ({
      ...h,
      changes: JSON.parse(h.changes),
    })))
  } catch (e) {
    sendError(res, e)
  }
})

// DELETE /api/products/:id — seller
router.delete('/:id', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id } })
    const product = await prisma.product.findFirst({
      where: { id: Number(req.params.id), shopId: shop?.id },
    })
    if (!product) return res.status(404).json({ error: 'Produit introuvable' })

    await prisma.product.update({ where: { id: product.id }, data: { active: false } })
    res.json({ success: true })
  } catch (e) {
    sendError(res, e)
  }
})

// POST /api/products/import-csv — seller
router.post('/import-csv', authenticate, requireRole('SELLER'), uploadCsv.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier CSV requis' })

  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id } })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })

    const csv = req.file.buffer.toString('utf8')
    const { data, errors } = Papa.parse(csv, { header: true, skipEmptyLines: true })

    if (errors.length) return res.status(400).json({ error: 'CSV invalide', details: errors })

    const required = ['name', 'category', 'price', 'stock']
    const created = []
    const failed = []

    for (const row of data) {
      if (required.some(k => !row[k])) { failed.push({ row, reason: 'Champs requis manquants' }); continue }
      try {
        const rowStock = Number(row.stock)
        const product = await prisma.$transaction(async (tx) => {
          const p = await tx.product.create({
            data: {
              shopId: shop.id,
              name: row.name,
              slug: slugify(row.name),
              description: row.description || null,
              category: row.category,
              price: Number(row.price),
              pricePerKg: Number(row.pricePerKg) || 0,
              unit: row.unit || '5kg',
              stock: 0,
              images: row.images ? JSON.stringify(row.images.split('|')) : '[]',
              badge: row.badge || null,
              origin: row.origin || null,
              harvest: row.harvest || null,
            },
          })
          await stockEngine.initializeStock(tx, { productId: p.id, quantity: rowStock, actorId: req.user.id })
          return p
        })
        created.push(product)
      } catch (err) {
        failed.push({ row, reason: err.message })
      }
    }

    res.json({ created: created.length, failed: failed.length, errors: failed })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Stock Engine (LOT 5) ───────────────────────────────────────────────────
// Remplace l'ancienne écriture directe de `stock` via PUT /:id : chaque
// changement de quantité passe désormais par un mouvement typé avec motif
// obligatoire, tracé dans StockMovement.
const ADJUST_TYPES = ['RECEPTION', 'LOSS', 'ADJUSTMENT']

// POST /api/products/:id/adjust-stock — seller
router.post('/:id/adjust-stock', authenticate, requireRole('SELLER'), async (req, res) => {
  const { type, quantity, reason } = req.body
  if (!ADJUST_TYPES.includes(type)) return res.status(400).json({ error: `type ∈ ${ADJUST_TYPES.join('|')}` })
  if (!reason || !reason.trim()) return res.status(400).json({ error: 'Un motif est requis' })
  const qty = Number(quantity)

  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id } })
    const product = await prisma.product.findFirst({ where: { id: Number(req.params.id), shopId: shop?.id } })
    if (!product) return res.status(404).json({ error: 'Produit introuvable' })

    let result
    if (type === 'RECEPTION') {
      if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'quantity doit être un entier positif' })
      result = await stockEngine.receiveStock(prisma, { productId: product.id, quantity: qty, actorId: req.user.id, reason: reason.trim() })
    } else if (type === 'LOSS') {
      if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'quantity doit être un entier positif' })
      result = await stockEngine.recordLoss(prisma, { productId: product.id, quantity: qty, actorId: req.user.id, reason: reason.trim() })
    } else {
      if (!Number.isInteger(qty) || qty === 0) return res.status(400).json({ error: 'quantity (delta signé) doit être un entier non nul' })
      result = await stockEngine.adjustStock(prisma, { productId: product.id, delta: qty, actorId: req.user.id, reason: reason.trim() })
    }

    res.status(201).json(result)
  } catch (e) {
    if (e instanceof stockEngine.InsufficientStockError) return res.status(400).json({ error: e.message })
    sendError(res, e)
  }
})

// GET /api/products/:id/stock-movements — seller : historique des mouvements de stock
router.get('/:id/stock-movements', authenticate, requireRole('SELLER'), async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id } })
    const product = await prisma.product.findFirst({ where: { id: Number(req.params.id), shopId: shop?.id } })
    if (!product) return res.status(404).json({ error: 'Produit introuvable' })

    const movements = await stockEngine.listMovements(prisma, { productId: product.id, limit: req.query.limit, offset: req.query.offset })
    res.json({ movements })
  } catch (e) {
    sendError(res, e)
  }
})

// ─── Inventaire physique (LOT 6) ────────────────────────────────────────────
// Compte terrain plutôt qu'un delta connu (ADJUSTMENT) — l'écart avec la
// position système est calculé et tracé par le Stock Engine, jamais saisi
// directement par le vendeur.
router.post('/:id/inventory-count', authenticate, requireRole('SELLER'), async (req, res) => {
  const { countedQuantity, reason } = req.body
  const counted = Number(countedQuantity)
  if (!Number.isInteger(counted) || counted < 0) return res.status(400).json({ error: 'countedQuantity doit être un entier ≥ 0' })

  try {
    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id } })
    const product = await prisma.product.findFirst({ where: { id: Number(req.params.id), shopId: shop?.id } })
    if (!product) return res.status(404).json({ error: 'Produit introuvable' })

    const result = await stockEngine.applyInventoryCount(prisma, {
      productId: product.id, countedQuantity: counted, actorId: req.user.id, reason: reason?.trim() || null,
    })
    res.status(201).json(result)
  } catch (e) {
    sendError(res, e)
  }
})

module.exports = router
