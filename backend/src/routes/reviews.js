const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate, requireRole } = require('../middleware/auth')
const { notify } = require('../services/notifications')

// GET /api/reviews/shop/:shopId — LOT REVIEW-1 (audit XXX RIZ) : agrège les
// avis PRODUIT (Review) de tous les produits d'une boutique. N'existait pas
// avant ce lot — c'est la cause racine confirmée du bug "le vendeur ne voit
// pas les avis client" : VendorReviewsTab.jsx ne lisait que ShopReview (avis
// boutique), jamais Review (avis produit), faute d'un endpoint pour les
// agréger. Réservé au propriétaire de la boutique (ou un admin) : contrairement
// à GET /product/:id (public, un seul produit déjà visible sur sa fiche),
// cette vue expose le nom de tous les clients ayant noté N'IMPORTE LEQUEL des
// produits de la boutique — pas une donnée à exposer à un tiers.
router.get('/shop/:shopId', authenticate, async (req, res) => {
  try {
    const shopId = Number(req.params.shopId)
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { userId: true } })
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' })
    if (shop.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès refusé' })
    }

    const [reviews, agg] = await Promise.all([
      prisma.review.findMany({
        where: { product: { shopId } },
        include: { user: { select: { name: true } }, product: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.aggregate({ where: { product: { shopId } }, _avg: { rating: true }, _count: { id: true } }),
    ])
    res.json({ reviews, avg: Math.round((agg._avg.rating || 0) * 10) / 10, total: agg._count.id })
  } catch (e) { sendError(res, e) }
})

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
      include: { user: { select: { name: true } }, product: { select: { name: true, shopId: true } } },
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

    // LOT REVIEW-3 (audit XXX RIZ) : le vendeur n'était jamais notifié
    // qu'un avis venait d'être publié sur l'un de ses produits — gap signalé
    // par l'audit, aucun notify() n'existait ici jusqu'ici.
    const shop = await prisma.shop.findUnique({ where: { id: review.product.shopId }, select: { userId: true } })
    if (shop) {
      await notify(shop.userId, 'NEW_REVIEW', 'Nouvel avis client',
        `${review.user.name} a laissé ${review.rating}★ sur "${review.product.name}".`,
        { productId: Number(productId), rating: review.rating })
    }

    res.status(201).json(review)
  } catch (e) {
    sendError(res, e)
  }
})

// POST /api/reviews/:id/reply — le vendeur répond publiquement à un avis
// laissé sur l'un de ses produits. Une seule réponse par avis, ré-éditable
// (pas un fil de discussion) — cf. commentaire schema.prisma sur Review.
router.post('/:id/reply', authenticate, requireRole('SELLER'), async (req, res) => {
  const { reply } = req.body
  if (!reply || !reply.trim()) return res.status(400).json({ error: 'Réponse requise' })
  if (reply.length > 1000) return res.status(400).json({ error: 'Réponse trop longue (1000 caractères max)' })

  try {
    const review = await prisma.review.findUnique({
      where: { id: Number(req.params.id) },
      include: { product: { select: { shopId: true, name: true } } },
    })
    if (!review) return res.status(404).json({ error: 'Avis introuvable' })

    const shop = await prisma.shop.findUnique({ where: { userId: req.user.id }, select: { id: true } })
    if (!shop || shop.id !== review.product.shopId) return res.status(403).json({ error: 'Cet avis ne concerne pas votre boutique' })

    const updated = await prisma.review.update({
      where: { id: review.id },
      data: { sellerReply: reply.trim(), sellerRepliedAt: new Date() },
      include: { user: { select: { name: true } }, product: { select: { name: true, shopId: true } } },
    })

    await notify(review.userId, 'REVIEW_REPLY', 'Le vendeur a répondu à votre avis',
      `"${review.product.name}" : ${reply.trim().slice(0, 100)}`, { productId: review.productId })

    res.json(updated)
  } catch (e) { sendError(res, e) }
})

module.exports = router
