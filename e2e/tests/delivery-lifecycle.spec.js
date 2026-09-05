// LOT 17 (programme précédent) puis LOT 10 (Arbitrage XXX RIZ) : couvre le
// cycle de livraison complet à travers deux acteurs réels (livreur +
// acheteur) dans un vrai navigateur — le parcours le plus complexe et le plus
// fragile du programme.
//
// LOT 10 a dû RÉÉCRIRE le premier test : LOT3 (Arbitrage XXX RIZ) avait
// restructuré DeliveryTab.jsx pour insérer ARRIVED/QR_SCANNED avant DELIVERED
// (QR dynamique comme mécanisme PRINCIPAL, OTP en secours) — le test
// d'origine cliquait "Confirmer la livraison" juste après "Colis récupéré",
// ce qui n'existe plus dans ce vocabulaire ; aucun test E2E n'avait été
// rejoué depuis ce lot, donc personne ne l'avait remarqué. C'est exactement
// le type de régression que cette suite existe pour attraper.
const { test, expect } = require('@playwright/test')
const fixtures = require('../.fixtures.json')

const API_BASE = 'http://localhost:3001/api'

async function login(page, email, password) {
  await page.goto('/auth')
  await page.getByPlaceholder('vous@exemple.ci').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  // La connexion redirige (rôle-dépendant) une fois le token stocké — sans
  // attendre, un goto() immédiat après le clic peut arriver AVANT que le
  // token n'existe, et PrivateRoute renvoie alors silencieusement vers /auth.
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'))
}

async function getToken(page) {
  return page.evaluate(() => localStorage.getItem('rz_token'))
}

test('cycle de livraison complet : offre → arrivé → code de secours → livrée', async ({ browser }) => {
  const driverPage = await (await browser.newContext()).newPage()
  const buyerPage = await (await browser.newContext()).newPage()

  // ── 1. Le livreur se connecte et accepte l'offre ──────────────────────────
  await login(driverPage, fixtures.driver.email, fixtures.driver.password)
  await driverPage.waitForURL('**/driver')
  await driverPage.getByRole('button', { name: 'Accepter la livraison' }).click()

  // L'acceptation bascule automatiquement sur l'onglet "En cours" (DeliveryTab).
  await expect(driverPage.getByRole('button', { name: /Colis récupéré/ })).toBeVisible({ timeout: 10000 })

  // ── 2. L'acheteur se connecte, ne voit encore aucun code (pas IN_TRANSIT) ──
  await login(buyerPage, fixtures.buyer.email, fixtures.buyer.password)
  await buyerPage.goto('/orders')
  await expect(buyerPage.getByTestId('delivery-code')).toHaveCount(0)

  // ── 3. Le livreur récupère le colis (IN_TRANSIT) ──────────────────────────
  await driverPage.getByRole('button', { name: /Colis récupéré/ }).click()
  await expect(driverPage.getByRole('button', { name: 'Je suis arrivé' })).toBeVisible({ timeout: 10000 })

  // ── 4. L'acheteur voit désormais son code de secours (mais pas encore le QR,
  //      généré seulement au passage ARRIVED) ───────────────────────────────
  await buyerPage.reload()
  const codeLocator = buyerPage.getByTestId('delivery-code')
  await expect(codeLocator).toBeVisible({ timeout: 15000 })
  const code = (await codeLocator.textContent()).trim()
  expect(code).toMatch(/^\d{4}$/)
  await expect(buyerPage.getByTestId('delivery-qr')).toHaveCount(0)

  // ── 5. Le livreur arrive (ARRIVED) — le QR devient disponible côté acheteur,
  //      le bouton "Scanner le QR" apparaît côté livreur ───────────────────
  await driverPage.getByRole('button', { name: 'Je suis arrivé' }).click()
  await expect(driverPage.getByRole('button', { name: 'Scanner le QR du client' })).toBeVisible({ timeout: 10000 })
  await buyerPage.reload()
  await expect(buyerPage.getByTestId('delivery-qr')).toBeVisible({ timeout: 15000 })

  // ── 6. Le livreur utilise le code de secours (OTP) plutôt que le QR — chemin
  //      INDÉPENDANT, toujours disponible même après ARRIVED (arbitrage LOT3/5:
  //      "OTP fallback contrôlé, jamais retiré") ────────────────────────────
  await driverPage.getByText('Confirmer avec un code de secours à la place').click()
  await driverPage.getByPlaceholder('0000').fill('0000')
  await driverPage.getByRole('button', { name: 'Confirmer', exact: true }).click()
  await expect(driverPage.getByText(/incorrect/i)).toBeVisible({ timeout: 10000 })

  await driverPage.getByPlaceholder('0000').fill(code)
  await driverPage.getByRole('button', { name: 'Confirmer', exact: true }).click()
  await expect(driverPage.getByText('Livraison réussie !')).toBeVisible({ timeout: 10000 })

  // ── 7. L'acheteur voit sa commande livrée ─────────────────────────────────
  await buyerPage.reload()
  await expect(buyerPage.getByText('Livrée').first()).toBeVisible({ timeout: 15000 })
})

// LOT 10 (Arbitrage XXX RIZ) : couvre le chemin PRINCIPAL resté totalement
// non testé E2E jusqu'ici — QR scanné par le livreur PUIS confirmation
// ACTIVE de l'acheteur (LOT4/5), sans jamais passer par l'OTP. Le scan
// caméra réel n'est pas simulable de façon fiable en CI (le contenu du QR
// est un jeton aléatoire généré côté serveur à l'exécution, donc aucune
// vidéo factice pré-enregistrée ne peut le contenir) — on vérifie que le
// scanner s'ouvre bien sans planter (régression réelle trouvée et corrigée
// au LOT3, voir DeliveryTab.jsx), puis on simule l'acte physique du scan par
// un seul appel API direct portant le jeton réellement affiché à l'acheteur
// (lu via /orders/:id/track, jamais deviné) — tout le reste du parcours
// (arrivée, affichage du QR, bouton de confirmation acheteur, effet réel sur
// les deux comptes) passe par la vraie UI.
test('QR scanné puis confirmation active de l\'acheteur (sans OTP)', async ({ browser }) => {
  const driverPage = await (await browser.newContext()).newPage()
  const buyerPage = await (await browser.newContext()).newPage()

  await login(driverPage, fixtures.driver2.email, fixtures.driver2.password)
  await driverPage.waitForURL('**/driver')
  await driverPage.getByRole('button', { name: 'Accepter la livraison' }).click()
  await expect(driverPage.getByRole('button', { name: /Colis récupéré/ })).toBeVisible({ timeout: 10000 })

  await login(buyerPage, fixtures.buyer.email, fixtures.buyer.password)
  await buyerPage.goto('/orders')

  await driverPage.getByRole('button', { name: /Colis récupéré/ }).click()
  await expect(driverPage.getByRole('button', { name: 'Je suis arrivé' })).toBeVisible({ timeout: 10000 })
  await driverPage.getByRole('button', { name: 'Je suis arrivé' }).click()
  await expect(driverPage.getByRole('button', { name: 'Scanner le QR du client' })).toBeVisible({ timeout: 10000 })

  // Le scanner s'ouvre sans planter (permission caméra refusée en CI —
  // vérifie juste que l'UI reste debout, "Annuler" reste cliquable).
  await driverPage.getByRole('button', { name: 'Scanner le QR du client' }).click()
  await expect(driverPage.getByRole('button', { name: 'Annuler' })).toBeVisible({ timeout: 10000 })
  await driverPage.getByRole('button', { name: 'Annuler' }).click()
  await expect(driverPage.getByRole('button', { name: 'Scanner le QR du client' })).toBeVisible({ timeout: 10000 })

  // Le jeton QR réellement affiché à l'acheteur (jamais deviné) sert à
  // simuler l'acte physique du scan via un appel API direct.
  const buyerToken = await getToken(buyerPage)
  const trackRes = await buyerPage.request.get(`${API_BASE}/orders/${fixtures.order2Id}/track`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  })
  const { qrToken } = await trackRes.json()
  expect(qrToken).toBeTruthy()

  const driverToken = await getToken(driverPage)
  const scanRes = await driverPage.request.put(`${API_BASE}/drivers/delivery/${fixtures.order2Id}/status`, {
    headers: { Authorization: `Bearer ${driverToken}` },
    data: { status: 'QR_SCANNED', qrToken },
  })
  expect(scanRes.ok()).toBe(true)

  // Côté livreur : le QR est vérifié, mais DELIVERED n'est PAS encore atteint
  // (aucune des deux voies indépendantes — OTP ou confirmation acheteur —
  // n'a encore été empruntée). Un reload complet réinitialise l'onglet actif
  // du tableau de bord livreur (retombe sur "Offres") — retour explicite sur
  // "En cours" avant de vérifier l'état de la livraison.
  await driverPage.reload()
  await driverPage.getByRole('button', { name: 'En cours' }).click()
  await expect(driverPage.getByText(/QR vérifié/)).toBeVisible({ timeout: 10000 })

  // Côté acheteur : le bouton de confirmation active n'apparaît qu'après le
  // scan (arbitrage LOT4 : "disponible uniquement une fois le QR scanné") —
  // le scan vient d'avoir lieu (appel API ci-dessus), donc déjà visible ici.
  await buyerPage.reload()
  await expect(buyerPage.getByRole('button', { name: 'J\'ai reçu mon colis' })).toBeVisible({ timeout: 15000 })
  await buyerPage.getByRole('button', { name: 'J\'ai reçu mon colis' }).click()
  await expect(buyerPage.getByText('Merci ! Livraison confirmée.')).toBeVisible({ timeout: 10000 })

  // Côté livreur : la livraison a disparu de "en cours" (GET
  // /drivers/active-delivery exclut DELIVERED par conception, voir LOT17) —
  // pas d'écran "Livraison réussie !" ici, cet écran est propre au chemin où
  // le LIVREUR lui-même déclenche DELIVERED (OTP), pas quand l'acheteur le
  // fait de façon autonome.
  await driverPage.reload()
  await driverPage.getByRole('button', { name: 'En cours' }).click()
  await expect(driverPage.getByText('Aucune livraison en cours')).toBeVisible({ timeout: 15000 })
})
