const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
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
    sendError(res, e)
  }
})

// LOT GEOLOC (retour utilisateur) : lat/lng sont une précision additionnelle,
// jamais un remplacement de label/address — toujours optionnels.
const parseCoord = (v, min, max) => {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined
}

// POST /api/addresses
router.post('/', authenticate, async (req, res) => {
  const { label, address, city, isDefault, latitude, longitude } = req.body
  if (!label || !address) return res.status(400).json({ error: 'Libellé et adresse requis' })

  try {
    if (isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } })
    }
    const created = await prisma.address.create({
      data: {
        userId: req.user.id, label, address, city: city || 'Abidjan', isDefault: Boolean(isDefault),
        latitude: parseCoord(latitude, -90, 90) ?? null,
        longitude: parseCoord(longitude, -180, 180) ?? null,
      },
    })
    res.status(201).json(created)
  } catch (e) {
    sendError(res, e)
  }
})

// PUT /api/addresses/:id
router.put('/:id', authenticate, async (req, res) => {
  const { label, address, city, isDefault, latitude, longitude } = req.body
  try {
    const existing = await prisma.address.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } })
    if (!existing) return res.status(404).json({ error: 'Adresse introuvable' })

    if (isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } })
    }
    const data = { label, address, city, isDefault: Boolean(isDefault) }
    if ('latitude' in req.body) data.latitude = parseCoord(latitude, -90, 90) ?? null
    if ('longitude' in req.body) data.longitude = parseCoord(longitude, -180, 180) ?? null
    const updated = await prisma.address.update({ where: { id: existing.id }, data })
    res.json(updated)
  } catch (e) {
    sendError(res, e)
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
    sendError(res, e)
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
    sendError(res, e)
  }
})

module.exports = router
