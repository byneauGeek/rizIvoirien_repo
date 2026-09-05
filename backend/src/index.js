require('dotenv').config()
const Sentry = require('@sentry/node')
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' })
}
const express = require('express')
const cors = require('cors')
const path = require('path')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const logger = require('./lib/logger')

const app = express()

// Log des requêtes HTTP
// Ne jamais logger un token en clair : le SSE (/api/drivers/events) reçoit son
// JWT en query string faute d'alternative côté EventSource — on le redacte ici
// avant qu'il n'atterrisse dans les logs/Sentry/monitoring.
const redactUrl = (url) => url.replace(/([?&]token=)[^&]+/i, '$1[REDACTED]')

app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'
    logger[level]({ method: req.method, url: redactUrl(req.url), status: res.statusCode, ms }, 'http')
  })
  next()
})

// Sécurité HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // autorise /uploads cross-origin
  contentSecurityPolicy: false,                           // à configurer avec whitelist en prod
}))

// Origines autorisées :
//   - Dev  : tout localhost/127.0.0.1 (n'importe quel port)
//   - Prod : variable d'env ALLOWED_ORIGINS (virgule-séparée)
//   - Toujours : pas d'origin (curl, Postman, apps mobiles)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : []

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`Origine non autorisée : ${origin}`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false })
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' } })
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, message: { error: 'Trop d\'uploads, réessayez dans 1 minute.' } })

app.use('/api', limiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/upload', uploadLimiter)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/products', require('./routes/products'))
app.use('/api/orders', require('./routes/orders'))
app.use('/api/shops', require('./routes/shops'))
app.use('/api/drivers', require('./routes/drivers'))
app.use('/api/carousel', require('./routes/carousel'))
app.use('/api/admin', require('./routes/admin'))
app.use('/api/admin/b2b', require('./routes/b2bAdmin'))
app.use('/api/accounting', require('./routes/accounting'))
app.use('/api/accounting/remunerations', require('./routes/remuneration'))
app.use('/api/accounting', require('./routes/accountingCore'))
app.use('/api/accounting', require('./routes/paymentExecution'))
app.use('/api/accounting', require('./routes/accountingReports'))
app.use('/api/accounting', require('./routes/accountingControls'))
app.use('/api/admin/accounting', require('./routes/accountingAdmin'))
app.use('/api/commercial', require('./routes/commercial'))
app.use('/api/reviews', require('./routes/reviews'))
app.use('/api/wishlist', require('./routes/wishlist'))
app.use('/api/addresses', require('./routes/addresses'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/upload', require('./routes/upload'))
app.use('/api/stats', require('./routes/stats'))
app.use('/api/promo', require('./routes/promo'))
app.use('/api/disputes', require('./routes/disputes'))
app.use('/api/shop-reviews', require('./routes/shopReviews'))
app.use('/api/b2b', require('./routes/b2b'))
app.use('/api/b2b', require('./routes/b2bContact'))

// ── Public settings (SEO + maintenance) — no auth needed ──────────────────────
app.get('/api/settings/public', async (req, res) => {
  try {
    const prisma = require('./lib/prisma')
    const s = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    if (!s) return res.json({})
    res.json({
      seoTitle:           s.seoTitle,
      seoDescription:     s.seoDescription,
      seoKeywords:        s.seoKeywords,
      seoOgImage:         s.seoOgImage,
      seoCanonicalDomain: s.seoCanonicalDomain,
      seoGoogleId:        s.seoGoogleId,
      seoFbPixelId:       s.seoFbPixelId,
      seoRobotsIndex:     s.seoRobotsIndex,
      seoSitemapEnabled:  s.seoSitemapEnabled,
      maintenanceMode:    s.maintenanceMode,
      supportEmail:       s.supportEmail,
      supportPhone:       s.supportPhone,
    })
  } catch (e) { res.json({}) }
})

// Health check avec vérification DB
app.get('/api/health', async (req, res) => {
  try {
    const prisma = require('./lib/prisma')
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, db: 'ok', ts: new Date().toISOString() })
  } catch {
    res.status(503).json({ ok: false, db: 'down', ts: new Date().toISOString() })
  }
})

// ── robots.txt — piloté par seoRobotsIndex ────────────────────────────────────
app.get('/robots.txt', async (req, res) => {
  try {
    const prisma = require('./lib/prisma')
    const s = await prisma.platformSettings.findUnique({ where: { id: 1 } })
    const domain  = s?.seoCanonicalDomain || 'https://rizivoirien.ci'
    const index   = s?.seoRobotsIndex   !== false
    const sitemap = s?.seoSitemapEnabled !== false

    const lines = ['User-agent: *']
    if (index) {
      lines.push('Allow: /')
      lines.push('Disallow: /admin')
      lines.push('Disallow: /vendor')
      lines.push('Disallow: /driver')
      lines.push('Disallow: /checkout')
      lines.push('Disallow: /cart')
      if (sitemap) lines.push(`Sitemap: ${domain}/sitemap.xml`)
    } else {
      lines.push('Disallow: /')
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(lines.join('\n'))
  } catch {
    res.setHeader('Content-Type', 'text/plain')
    res.send('User-agent: *\nAllow: /')
  }
})

// ── sitemap.xml — dynamique, piloté par seoSitemapEnabled ─────────────────────
app.get('/sitemap.xml', async (req, res) => {
  try {
    const prisma = require('./lib/prisma')
    const s = await prisma.platformSettings.findUnique({ where: { id: 1 } })

    if (s?.seoSitemapEnabled === false) return res.status(404).send('Sitemap désactivé')

    const domain = (s?.seoCanonicalDomain || 'https://rizivoirien.ci').replace(/\/$/, '')
    const now    = new Date().toISOString().split('T')[0]

    const [products, shops] = await Promise.all([
      prisma.product.findMany({
        where: { active: true, shop: { status: 'ACTIVE', contractSigned: true } },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.shop.findMany({
        where: { status: 'ACTIVE', contractSigned: true },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    const url = (loc, priority = '0.5', freq = 'weekly') =>
      `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`

    const urls = [
      url(`${domain}/`,      '1.0', 'daily'),
      url(`${domain}/shop`,  '0.9', 'daily'),
      ...shops.map(sh    => url(`${domain}/shop/${sh.id}`,       '0.7', 'weekly')),
      ...products.map(p  => url(`${domain}/product/${p.slug}`,   '0.8', 'weekly')),
    ]

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.send(xml)
  } catch (e) {
    res.status(500).send('Erreur génération sitemap')
  }
})

// 404
app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }))

// Error handler global (Prisma + générique)
app.use(require('./middleware/errorHandler'))

// `app` est exporté sans écouter de port — nécessaire pour les tests (supertest
// pilote l'app directement, sans bind réseau). Le serveur ne démarre réellement
// que lorsque ce fichier est exécuté directement (`node src/index.js`), pas
// lorsqu'il est `require()`. Comportement identique pour `npm start`/`npm run dev`.
function start() {
  const PORT = process.env.PORT || 3001
  const prisma = require('./lib/prisma')
  const server = app.listen(PORT, () => {
    logger.info(`🌾 RizIvoirien API → http://localhost:${PORT}`)
    const { startEngine } = require('./services/assignmentEngine')
    try { startEngine() } catch (e) { logger.error({ err: e }, '❌ Moteur assignation') }
    const { startB2BExpiryEngine } = require('./services/b2bExpiry')
    try { startB2BExpiryEngine() } catch (e) { logger.error({ err: e }, '❌ Moteur expiration B2B') }
  })

  process.on('SIGTERM', async () => {
    logger.info('🛑 SIGTERM — arrêt propre...')
    server.close(async () => {
      await prisma.$disconnect()
      logger.info('✅ Connexion DB fermée')
      process.exit(0)
    })
  })

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, '❌ Promise non gérée')
  })

  return server
}

if (require.main === module) start()

module.exports = app
