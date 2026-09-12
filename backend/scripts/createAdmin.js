require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

// Crée un compte ADMIN, ou promeut un compte existant en ADMIN et met à jour
// son mot de passe. Usage : ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_NAME=...] node scripts/createAdmin.js
async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || 'Administrateur'

  if (!email || !password) {
    console.error('❌ ADMIN_EMAIL et ADMIN_PASSWORD sont requis.')
    process.exit(1)
  }
  if (password.length < 6) {
    console.error('❌ Le mot de passe doit contenir au moins 6 caractères.')
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash, role: 'ADMIN', banned: false, emailVerified: true },
    create: { email, password: hash, name, role: 'ADMIN', emailVerified: true },
  })

  console.log(`✅ ${user.email} est maintenant ADMIN (id=${user.id}).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
