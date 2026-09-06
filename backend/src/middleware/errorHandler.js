const Sentry = require('@sentry/node')
const logger = require('../lib/logger')
const { classifyError } = require('../lib/sendError')

// Filet de sécurité final : n'est atteint que par ce qui échappe à un catch
// manuel dans une route (une exception synchrone hors handler async, une
// erreur du body-parser, etc.) — la quasi-totalité des routes de ce projet
// catchent et répondent elles-mêmes via sendError() (lib/sendError.js), qui
// partage la même logique de traduction (classifyError) pour rester cohérent.
module.exports = function errorHandler(err, req, res, next) {
  const { status, body } = classifyError(err)
  logger.error({ err, method: req.method, url: req.url.replace(/([?&]token=)[^&]+/i, '$1[REDACTED]') }, 'Erreur serveur')
  if (process.env.SENTRY_DSN) Sentry.captureException(err)
  res.status(status).json(body)
}
