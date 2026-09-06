const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate, requireRole } = require('../middleware/auth')

// GET /api/wishlist — ma wishlist
router.get('/', authenticate, requireRole('BUYER'), async (req, res) => {
  try {
    const items = await prisma.wishlist.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          include: { shop: { select: { id: true, name: true, certified: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(items)
  } catch (e) {
    sendError(res, e)
  }
})

// POST /api/wishlist/:productId — ajouter
router.post('/:productId', authenticate, requireRole('BUYER'), async (req, res) => {
  try {
    const item = await prisma.wishlist.upsert({
      where: { userId_productId: { userId: req.user.id, productId: Number(req.params.productId) } },
      update: {},
      create: { userId: req.user.id, productId: Number(req.params.productId) },
    })
    res.status(201).json(item)
  } catch (e) {
    sendError(res, e)
  }
})

// DELETE /api/wishlist/:productId — retirer
router.delete('/:productId', authenticate, requireRole('BUYER'), async (req, res) => {
  try {
    await prisma.wishlist.deleteMany({
      where: { userId: req.user.id, productId: Number(req.params.productId) },
    })
    res.json({ success: true })
  } catch (e) {
    sendError(res, e)
  }
})

module.exports = router
