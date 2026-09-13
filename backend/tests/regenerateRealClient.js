// Lancé en processus DÉTACHÉ par globalTeardown.js, pas exécuté dans le
// process Jest lui-même. Sur Windows, le moteur natif Prisma
// (query_engine-windows.dll.node) que les PrismaClient de test viennent
// d'utiliser reste verrouillé tant que le process Jest qui les a créés n'a
// pas complètement terminé — `--forceExit` ne garantit pas que ce soit déjà
// le cas au moment où globalTeardown s'exécute (il tourne DANS ce même
// process). Attendre à l'intérieur de globalTeardown ne sert donc à rien :
// le verrou ne se lève qu'après la sortie du process, qui n'a pas encore eu
// lieu. Un process séparé et détaché, lui, n'est bloqué par rien — il
// patiente simplement jusqu'à ce que le verrou se libère.
const { execSync } = require('child_process')
const path = require('path')

const cwd = path.join(__dirname, '..')

async function main() {
  for (let attempt = 1; attempt <= 15; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    try {
      execSync('npx prisma generate', { cwd, stdio: 'ignore' })
      return
    } catch {
      // Verrou encore tenu — réessaie.
    }
  }
  console.error('⚠️  Impossible de régénérer @prisma/client (schéma réel, postgresql) automatiquement après les tests — lancez `npx prisma generate` manuellement avant de redémarrer le serveur de dev.')
}

main()
