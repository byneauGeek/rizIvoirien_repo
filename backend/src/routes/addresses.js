const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authenticate } = require('../middleware/auth')

// GET /api/addresses
router.get('/', authenticate, async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    })
    res.json(addresses)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/addresses
router.post('/', authenticate, async (req, res) => {
  const { label, address, city, isDefault } = req.body
  if (!label || !address) return res.status(400).json({ error: 'Libellé et adresse requis' })

  try {
    if (isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } })
    }
    const created = await prisma.address.create({
      data: { userId: req.user.id, label, address, city: city || 'Abidjan', isDefault: Boolean(isDefault) },
    })
    res.status(201).json(created)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/addresses/:id
router.put('/:id', authenticate, async (req, res) => {
  const { label, address, city, isDefault } = req.body
  try {
    const existing = await prisma.address.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } })
    if (!existing) return res.status(404).json({ error: 'Adresse introuvable' })

    if (isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } })
    }
    const updated = await prisma.address.update({
      where: { id: existing.id },
      data: { label, address, city, isDefault: Boolean(isDefault) },
    })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/addresses/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.address.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } })
    if (!existing) return res.status(404).json({ error: 'Adresse introuvable' })
    await prisma.address.delete({ where: { id: existing.id } })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/addresses/:id/default
router.put('/:id/default', authenticate, async (req, res) => {
  try {
    const existing = await prisma.address.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } })
    if (!existing) return res.status(404).json({ error: 'Adresse introuvable' })

    await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } })
    const updated = await prisma.address.update({ where: { id: existing.id }, data: { isDefault: true } })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
