const { Prisma } = require('@prisma/client')
const logger = require('./logger')

// Traduit une erreur en {status, body} de réponse HTTP — logique PARTAGÉE
// entre le middleware errorHandler.js (filet de sécurité final pour tout ce
// qui échapperait à un catch manuel) et sendError() ci-dessous, appelé
// directement par les ~300 routes qui catchent elles-mêmes leurs erreurs.
// Un seul endroit à maintenir pour la traduction Prisma → message humain.
function classifyError(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return { status: 409, body: { error: 'Cette valeur existe déjà.' } }
    if (err.code === 'P2025') return { status: 404, body: { error: 'Ressource introuvable.' } }
    if (err.code === 'P2003') return { status: 400, body: { error: 'Référence invalide.' } }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, body: { error: 'Données invalides.' } }
  }
  // TypeError/ReferenceError/RangeError/SyntaxError ne sont (dans ce code)
  // jamais levées délibérément pour un message métier (toujours
  // `new Error('texte clair')` dans ce cas) — elles trahissent presque
  // toujours un bug réel (accès à une propriété undefined, JSON malformé du
  // client, etc.), dont le message technique brut ne doit jamais atteindre
  // l'utilisateur ni remplacer un vrai message d'erreur.
  if (err instanceof TypeError || err instanceof ReferenceError || err instanceof RangeError || err instanceof SyntaxError) {
    return { status: 500, body: { error: 'Erreur serveur interne. Veuillez réessayer.' }, unexpected: true }
  }
  // Erreur métier délibérée (ex. "Un motif est requis pour signaler un échec
  // de livraison") : son message est déjà écrit pour l'utilisateur, on
  // l'affiche tel quel — c'est le comportement historique de ce code, à ne
  // pas casser en le redirigeant vers un message générique.
  return { status: 500, body: { error: err.message } }
}

// Appelé directement par le catch(e) d'une route (pas de next(e) : la
// quasi-totalité des routes de ce projet gèrent déjà leur propre erreur sans
// jamais déléguer à errorHandler.js — voir l'audit qui a motivé ce fichier).
// Ne journalise QUE le cas "vraiment inattendu" (Prisma ou bug) : les erreurs
// de validation métier sont un flux normal, pas un incident à tracer.
function sendError(res, err, context = {}) {
  const { status, body, unexpected } = classifyError(err)
  if (unexpected || err instanceof Prisma.PrismaClientKnownRequestError || err instanceof Prisma.PrismaClientValidationError) {
    logger.error({ err, ...context }, 'Erreur serveur')
    if (process.env.SENTRY_DSN) {
      try { require('@sentry/node').captureException(err, { extra: context }) } catch { /* Sentry ne doit jamais faire planter la réponse */ }
    }
  }
  return res.status(status).json(body)
}

module.exports = { sendError, classifyError }
