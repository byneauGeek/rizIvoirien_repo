// Extrait des coordonnées (lat, lng) d'un lien Google Maps ou d'une saisie
// brute "lat, lng" — solution additionnelle à la saisie d'adresse texte,
// pour une position plus précise sans dépendre du géocodage automatique.
// Ne gère pas les liens raccourcis (maps.app.goo.gl/...) : leur résolution
// exige de suivre une redirection HTTP, impossible à faire de façon fiable
// côté client seul — l'utilisateur doit alors copier le lien complet depuis
// "Partager → Copier le lien" une fois la carte ouverte, pas le lien court
// affiché par défaut sur mobile.
export function parseGoogleMapsInput(input) {
  const s = (input || '').trim()
  if (!s) return null

  const inRange = (lat, lng) => lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180

  // Saisie brute "lat, lng" ou "lat,lng"
  let m = s.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (m) {
    const lat = Number(m[1]), lng = Number(m[2])
    if (inRange(lat, lng)) return { lat, lng }
  }

  // Lien Google Maps avec @lat,lng,zoom (format le plus courant, copié
  // depuis la barre d'adresse une fois la carte centrée sur le point)
  m = s.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/)
  if (m) {
    const lat = Number(m[1]), lng = Number(m[2])
    if (inRange(lat, lng)) return { lat, lng }
  }

  // Lien avec ?q=lat,lng ou &q=lat,lng
  m = s.match(/[?&]q=(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/)
  if (m) {
    const lat = Number(m[1]), lng = Number(m[2])
    if (inRange(lat, lng)) return { lat, lng }
  }

  return null
}
