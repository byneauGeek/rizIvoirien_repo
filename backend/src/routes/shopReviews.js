const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authenticate, requireRole } = require('../middleware/auth')

// POST /api/shop-reviews — Acheteur note une boutique (après livraison)
router.post('/', authenticate, requireRole('BUYER'), async (req, res) => {
  const { shopId, orderId, rating, comment } = req.body
  if (!shopId || !rating) return res.status(400).json({ error: 'shopId et rating requis' })
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Note entre 1 et 5' })

  try {
    // Vérifier que l'acheteur a bien reçu une commande livrée de cette boutique
    if (orderId) {
      const order = await prisma.order.findUnique({ where: { id: Number(orderId) } })
      if (!order || order.buyerId !== req.user.id || order.shopId !== Number(shopId) || order.status !== 'DELIVERED')
        return res.status(403).json({ error: 'Commande non éligible pour noter cette boutique' })
    }

    const existing = await prisma.shopReview.findUnique({
      where: { shopId_userId: { shopId: Number(shopId), userId: req.user.id } },
    })
    if (existing) return res.status(409).json({ error: 'Vous avez déjà noté cette boutique' })

    const review = await prisma.shopReview.create({
      data: {
        shopId: Number(shopId),
        userId: req.user.id,
        orderId: orderId ? Number(orderId) : null,
        rating: Number(rating),
        comment: comment || null,
      },
    })

    // Recalculer la note moyenne de la boutique
    const agg = await prisma.shopReview.aggregate({
      where: { shopId: Number(shopId) },
      _avg: { rating: true },
      _count: { rating: true },
    })
    await prisma.shop.update({
      where: { id: Number(shopId) },
      data: {
        rating: Math.round((agg._avg.rating || 5) * 10) / 10,
        reviewCount: agg._count.rating,
      },
    })

    res.status(201).json(review)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/shop-reviews/:shopId — Liste des avis d'une boutique
router.get('/:shopId', async (req, res) => {
  try {
    const reviews = await prisma.shopReview.findMany({
      where: { shopId: Number(req.params.shopId) },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    res.json(reviews)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/shop-reviews/my/:shopId — Vérifier si l'acheteur a déjà noté
router.get('/my/:shopId', authenticate, async (req, res) => {
  try {
    const review = await prisma.shopReview.findUnique({
      where: { shopId_userId: { shopId: Number(req.params.shopId), userId: req.user.id } },
    })
    res.json({ review })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
