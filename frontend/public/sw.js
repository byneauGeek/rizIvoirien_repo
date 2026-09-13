// Service worker minimal — app shell + mise en cache opportuniste.
// Pas de préchargement de la liste des bundles hashés (leurs noms changent à
// chaque build Vite, une liste statique se périmerait immédiatement) : on
// met plutôt en cache au fil de l'eau ce qui est réellement demandé, et on
// retombe sur offline.html seulement pour une navigation qui échoue hors ligne.
const CACHE_NAME = 'riz-shell-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  // Navigation (changement de page) : réseau d'abord, repli sur la page
  // hors-ligne si la requête échoue faute de connexion.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    )
    return
  }

  // Assets statiques same-origin (JS/CSS/images buildés) : cache d'abord,
  // avec mise à jour silencieuse du cache en arrière-plan si le réseau
  // répond — accélère les visites suivantes sans jamais servir de contenu
  // périmé indéfiniment (chaque asset Vite est hashé par contenu).
  if (new URL(request.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        }).catch(() => cached)
        return cached || fetchPromise
      })
    )
  }
})
