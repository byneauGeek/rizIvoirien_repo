const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')

const verifyAndLoadUser = async (rawToken) => {
  const payload = jwt.verify(rawToken, process.env.JWT_SECRET)
  const user = await prisma.user.findUnique({ where: { id: payload.id } })
  if (!user) throw new Error('Utilisateur introuvable')
  return user
}

// Auth standard : uniquement via header Authorization: Bearer <token>.
// Ne JAMAIS accepter de token en query string ici — il finirait dans req.url,
// donc dans les logs HTTP, l'historique navigateur, les proxys et Sentry.
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization
  const rawToken = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!rawToken) {
    return res.status(401).json({ error: 'Token manquant' })
  }

  try {
    req.user = await verifyAndLoadUser(rawToken)
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide' })
  }
}

// Auth réservée aux endpoints SSE (EventSource) : le navigateur ne permet pas
// d'envoyer un header Authorization custom sur un EventSource, donc le token
// doit transiter par la query string. Le logger HTTP redacte ce paramètre
// (voir index.js) pour qu'il n'atterrisse jamais en clair dans les logs.
const authenticateSSE = async (req, res, next) => {
  const rawToken = req.query.token || null
  if (!rawToken) return res.status(401).json({ error: 'Token manquant' })

  try {
    req.user = await verifyAndLoadUser(rawToken)
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

module.exports = { authenticate, authenticateSSE, requireRole }
