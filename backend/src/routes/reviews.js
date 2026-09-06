const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate, requireRole } = require('../middleware/auth')

// GET /api/reviews/product/:id — public
router.get('/product/:id', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: Number(req.params.id) },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
    res.json({ reviews, avg: Math.round(avg * 10) / 10, total: reviews.length })
  } catch (e) {
    sendError(res, e)
  }
})

// POST /api/reviews — acheteur après livraison
router.post('/', authenticate, requireRole('BUYER'), async (req, res) => {
  const { productId, rating, comment, orderId } = req.body
  if (!productId || !rating) return res.status(400).json({ error: 'Produit et note requis' })
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Note entre 1 et 5' })

  try {
    // Vérifier que l'acheteur a commandé ce produit et reçu la livraison
    const ordered = await prisma.orderItem.findFirst({
      where: {
        productId: Number(productId),
        order: { buyerId: req.user.id, status: 'DELIVERED' },
      },
    })
    if (!ordered) return res.status(403).json({ error: 'Vous devez avoir reçu ce produit pour laisser un avis' })

    const review = await prisma.review.upsert({
      where: { productId_userId: { productId: Number(productId), userId: req.user.id } },
      update: { rating: Number(rating), comment: comment || null },
      create: {
        productId: Number(productId),
        userId: req.user.id,
        orderId: orderId ? Number(orderId) : null,
        rating: Number(rating),
        comment: comment || null,
      },
      include: { user: { select: { name: true } } },
    })

    // Recalculer la note moyenne du produit
    const agg = await prisma.review.aggregate({
      where: { productId: Number(productId) },
      _avg: { rating: true },
      _count: { id: true },
    })
    await prisma.product.update({
      where: { id: Number(productId) },
      data: {
        rating: Math.round((agg._avg.rating || 5) * 10) / 10,
        reviewCount: agg._count.id,
      },
    })

    res.status(201).json(review)
  } catch (e) {
    sendError(res, e)
  }
})

module.exports = router
