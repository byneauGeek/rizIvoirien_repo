const { Prisma } = require('@prisma/client')
const Sentry = require('@sentry/node')
const logger = require('../lib/logger')

module.exports = function errorHandler(err, req, res, next) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Cette valeur existe déjà.' })
    if (err.code === 'P2025') return res.status(404).json({ error: 'Ressource introuvable.' })
    if (err.code === 'P2003') return res.status(400).json({ error: 'Référence invalide.' })
  }
  if (err instanceof Prisma.PrismaClientValidationError)
    return res.status(400).json({ error: 'Données invalides.' })

  logger.error({ err, method: req.method, url: req.url.replace(/([?&]token=)[^&]+/i, '$1[REDACTED]') }, 'Erreur serveur')
  if (process.env.SENTRY_DSN) Sentry.captureException(err)
  res.status(500).json({ error: 'Erreur serveur interne.' })
}
