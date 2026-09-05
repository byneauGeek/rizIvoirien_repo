// LOT 17 (logistique) : premier test E2E du projet — jusqu'ici, chaque lot
// de ce programme n'avait été vérifié dans un vrai navigateur que
// manuellement (sessions ad hoc, jamais rejouables). Couvre le cycle de
// livraison complet (offre -> en route -> code -> livrée), le parcours le
// plus complexe et le plus sujet aux bugs de ce programme : deux vrais bugs
// (LOT3 deadlock transactionnel, LOT9 animation qui ne se termine jamais
// hors focus) n'ont été trouvés QUE par un test manuel dans un vrai
// navigateur, jamais par les tests d'intégration Jest.
const path = require('path')
const { defineConfig, devices } = require('@playwright/test')

const BACKEND_DIR = path.join(__dirname, '..', 'backend')
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend')
const DATABASE_URL = 'file:' + path.join(BACKEND_DIR, 'prisma', 'e2e.db')

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false, // un seul scénario multi-acteurs partagé, pas de parallélisation utile
  retries: 0,
  globalSetup: require.resolve('./global-setup.js'),
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'node src/index.js',
      cwd: BACKEND_DIR,
      env: { DATABASE_URL, PORT: '3001' },
      port: 3001,
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'npm run dev',
      cwd: FRONTEND_DIR,
      port: 5173,
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
})
