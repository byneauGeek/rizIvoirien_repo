const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')

// LOT 2 (Arbitrage XXX RIZ) : les capacités secondaires (UserCapability) sont
// chargées ICI, à chaque requête authentifiée, plutôt qu'embarquées dans le
// JWT — un compte qui active une capacité (ex. BUYER → TRADER) en bénéficie
// dès sa prochaine requête, sans réémission de token ni reconnexion. Un seul
// aller-retour DB (include), pas une requête séparée.
const verifyAndLoadUser = async (rawToken) => {
  const payload = jwt.verify(rawToken, process.env.JWT_SECRET)
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    include: { capabilities: { select: { role: true } } },
  })
  if (!user) throw new Error('Utilisateur introuvable')
  // LOT PROD-5 (audit XXX RIZ) : stratégie de révocation JWT — aucun blocklist
  // de token n'existe (et n'est pas nécessaire ici) puisque ce middleware
  // recharge déjà l'utilisateur en base à CHAQUE requête. Le gap réel était que
  // `banned` n'était vérifié qu'à la connexion (auth.js) : un compte banni en
  // cours de route gardait un accès complet jusqu'à l'expiration de son JWT
  // (7 jours, cf. signToken). Ce contrôle suffit à révoquer l'accès dès la
  // requête suivante, sans coût supplémentaire (le fetch avait déjà lieu).
  if (user.banned) {
    const err = new Error('Compte suspendu. Contactez le support.')
    err.banned = true
    throw err
  }
  user.capabilities = user.capabilities.map((c) => c.role)
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
  } catch (e) {
    if (e.banned) return res.status(403).json({ error: e.message })
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
  } catch (e) {
    if (e.banned) return res.status(403).json({ error: e.message })
    res.status(401).json({ error: 'Token invalide' })
  }
}

// LOT 2 : vérifie le rôle PRINCIPAL (comportement inchangé, 100% des comptes
// existants) OU une capacité secondaire activée (UserCapability) — un compte
// BUYER ayant activé TRADER passe requireRole('TRADER') sans jamais changer
// son rôle principal ni son tableau de bord par défaut.
const requireRole = (...roles) => (req, res, next) => {
  const hasRole = roles.includes(req.user?.role)
  const hasCapability = req.user?.capabilities?.some((c) => roles.includes(c))
  if (!hasRole && !hasCapability) {
    return res.status(403).json({ error: 'Accès refusé' })
  }
  next()
}

module.exports = { authenticate, authenticateSSE, requireRole }
