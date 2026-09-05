const pino = require('pino')

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
})

// LOT 16 (logistique) : les tâches fire-and-forget (setImmediate) tournent
// hors du cycle requête/réponse — une erreur qui y survient n'atteint
// jamais errorHandler.js, donc jamais Sentry ni les logs. Plusieurs de ces
// tâches (géocodage paresseux LOT8, purge de l'historique GPS LOT9) avalaient
// silencieusement TOUTE erreur en `catch {}` pour ne jamais faire échouer
// l'opération principale (best-effort, volontaire) — mais ça rendait un vrai
// bug (pas juste "Nominatim ne répond pas") totalement invisible en
// production. Ce helper garde le même contrat "ne jamais throw", en rendant
// l'erreur visible : mêmes canaux qu'errorHandler.js (logger + Sentry si
// configuré), jamais un simple `catch {}` muet.
function reportBackgroundError(err, context) {
  logger.error({ err, ...context }, 'Erreur dans une tâche d\'arrière-plan')
  if (process.env.SENTRY_DSN) {
    try {
      require('@sentry/node').captureException(err, { extra: context })
    } catch {
      // Sentry lui-même ne doit jamais faire planter l'appelant
    }
  }
}

module.exports = logger
module.exports.reportBackgroundError = reportBackgroundError
