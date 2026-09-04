// Source unique pour l'URL de l'API — évite que le fallback localhost soit
// dupliqué (et donc oublié) dans plusieurs fichiers. En build de production,
// une variable VITE_API_URL manquante est une erreur de configuration : on le
// signale bruyamment plutôt que de basculer silencieusement sur localhost,
// ce qui casserait l'app pour de vrais utilisateurs sans message clair.
const configured = import.meta.env.VITE_API_URL

if (import.meta.env.PROD && !configured) {
  // eslint-disable-next-line no-console
  console.error(
    '[config] VITE_API_URL est manquant dans ce build de production — ' +
    'l\'API pointera vers localhost et ne fonctionnera pas. Vérifiez la configuration de build.'
  )
}

export const API_BASE = configured || 'http://localhost:3001/api'
