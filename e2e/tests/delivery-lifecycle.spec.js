// LOT 17 : couvre le cycle de livraison complet à travers deux acteurs réels
// (livreur + acheteur) dans un vrai navigateur — le parcours le plus
// complexe de ce programme logistique, celui où deux vrais bugs (LOT3
// deadlock transactionnel, LOT9 animation qui ne se termine jamais hors
// focus) n'ont été trouvés QUE par un test manuel dans un navigateur,
// jamais par les 290+ tests d'intégration Jest de ce programme.
const { test, expect } = require('@playwright/test')
const fixtures = require('../.fixtures.json')

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

test('cycle de livraison complet : offre → en route → code → livrée', async ({ browser }) => {
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
  await expect(driverPage.getByRole('button', { name: 'Confirmer la livraison' })).toBeVisible({ timeout: 10000 })

  // ── 4. L'acheteur voit désormais son code de livraison ────────────────────
  await buyerPage.reload()
  const codeLocator = buyerPage.getByTestId('delivery-code')
  await expect(codeLocator).toBeVisible({ timeout: 15000 })
  const code = (await codeLocator.textContent()).trim()
  expect(code).toMatch(/^\d{4}$/)

  // ── 5. Le livreur saisit un mauvais code : rejeté avec un message clair ───
  await driverPage.getByRole('button', { name: 'Confirmer la livraison' }).click()
  await driverPage.getByPlaceholder('0000').fill('0000')
  await driverPage.getByRole('button', { name: 'Confirmer', exact: true }).click()
  await expect(driverPage.getByText(/incorrect/i)).toBeVisible({ timeout: 10000 })

  // ── 6. Le bon code confirme la livraison ──────────────────────────────────
  await driverPage.getByPlaceholder('0000').fill(code)
  await driverPage.getByRole('button', { name: 'Confirmer', exact: true }).click()
  await expect(driverPage.getByText('Livraison réussie !')).toBeVisible({ timeout: 10000 })

  // ── 7. L'acheteur voit sa commande livrée ─────────────────────────────────
  await buyerPage.reload()
  await expect(buyerPage.getByText('Livrée').first()).toBeVisible({ timeout: 15000 })
})
