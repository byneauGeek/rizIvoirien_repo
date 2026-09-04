const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authenticate, requireRole } = require('../middleware/auth')

// GET /api/carousel — public: slides actifs
router.get('/', async (req, res) => {
  try {
    const slides = await prisma.carouselSlide.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
    })
    res.json(slides)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/carousel/all — admin: tous les slides
router.get('/all', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const slides = await prisma.carouselSlide.findMany({ orderBy: { position: 'asc' } })
    res.json(slides)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/carousel — admin
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { type, title, subtitle, badge, cta, ctaLink, bg, accent, image, active, position } = req.body
  if (!title) return res.status(400).json({ error: 'Titre requis' })
  try {
    const slide = await prisma.carouselSlide.create({
      data: { type: type || 'promotion', title, subtitle, badge, cta, ctaLink, bg: bg || '#1B4332', accent: accent || '#E8A217', image, active: Boolean(active), position: position || 0 },
    })
    res.status(201).json(slide)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/carousel/suggestions — admin: boutiques certifiées + top produits pour génération auto
router.get('/suggestions', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const [shops, products] = await Promise.all([
      prisma.shop.findMany({
        where: { certified: true, status: 'ACTIVE' },
        select: {
          id: true, name: true, slug: true, description: true,
          coverImage: true, avatar: true, rating: true, reviewCount: true,
          _count: { select: { products: true } },
        },
        orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
        take: 6,
      }),
      prisma.product.findMany({
        where: { active: true, shop: { certified: true, status: 'ACTIVE' } },
        select: {
          id: true, name: true, slug: true, category: true,
          price: true, images: true, rating: true, reviewCount: true,
          shop: { select: { name: true, slug: true } },
        },
        orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
        take: 8,
      }),
    ])
    res.json({ shops, products })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/carousel/:id — admin
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const EDITABLE_FIELDS = ['type', 'title', 'subtitle', 'badge', 'cta', 'ctaLink', 'bg', 'accent', 'image', 'active', 'position']
    const data = {}
    for (const field of EDITABLE_FIELDS) {
      if (field in req.body) data[field] = req.body[field]
    }
    data.updatedAt = new Date()
    const slide = await prisma.carouselSlide.update({
      where: { id: Number(req.params.id) },
      data,
    })
    res.json(slide)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/carousel/:id — admin
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.carouselSlide.delete({ where: { id: Number(req.params.id) } })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
