const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authenticate, requireRole } = require('../middleware/auth')

// POST /api/promo/validate — valider un code promo (acheteur)
router.post('/validate', authenticate, async (req, res) => {
  const { code, orderTotal } = req.body
  if (!code) return res.status(400).json({ error: 'Code requis' })

  try {
    const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } })
    if (!promo || !promo.active) return res.status(404).json({ error: 'Code promo invalide' })
    if (promo.expiresAt && new Date() > promo.expiresAt) return res.status(400).json({ error: 'Code promo expiré' })
    if (promo.usedCount >= promo.maxUses) return res.status(400).json({ error: 'Code promo épuisé' })
    if (orderTotal < promo.minOrder) return res.status(400).json({ error: `Commande minimum: ${promo.minOrder} FCFA` })

    const discount = promo.type === 'PERCENT'
      ? Math.round(orderTotal * promo.value / 100)
      : Math.min(promo.value, orderTotal)

    res.json({ valid: true, promo, discount })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/promo — admin: liste
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(codes)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/promo — admin: créer
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { code, description, type, value, minOrder, maxUses, expiresAt } = req.body
  if (!code || !value) return res.status(400).json({ error: 'Code et valeur requis' })

  try {
    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        description: description || null,
        type: type || 'PERCENT',
        value: Number(value),
        minOrder: Number(minOrder) || 0,
        maxUses: Number(maxUses) || 100,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })
    res.status(201).json(promo)
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Code déjà existant' })
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/promo/:id — admin: toggle actif
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const updated = await prisma.promoCode.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/promo/:id — admin
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.promoCode.delete({ where: { id: Number(req.params.id) } })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
