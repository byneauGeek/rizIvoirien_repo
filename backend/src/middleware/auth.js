const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization
  // Fallback query param ?token= pour les EventSource / SSE (browser ne supporte pas les headers custom)
  const rawToken = header?.startsWith('Bearer ')
    ? header.slice(7)
    : (req.query.token || null)

  if (!rawToken) {
    return res.status(401).json({ error: 'Token manquant' })
  }

  try {
    const token = rawToken
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.user.findUnique({ where: { id: payload.id } })
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide' })
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Accès refusé' })
  }
  next()
}

module.exports = { authenticate, requireRole }
