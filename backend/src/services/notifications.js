const prisma = require('../lib/prisma')

async function notify(userId, type, title, message, data = null) {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, data: data ? JSON.stringify(data) : null },
    })
  } catch (e) {
    console.error('Notification error:', e.message)
  }
}

// LOT REVISION (retour utilisateur) : tous les appelants notifiaient l'admin
// via notify(1, ...) — hypothèse fausse en prod, où rien ne garantit que le
// tout premier compte créé (id=1) est un ADMIN (contrairement au seed.js de
// dev, qui crée toujours l'admin en premier). Cherche les vrais comptes
// ADMIN et les notifie tous (utile si plusieurs admins existent un jour).
async function notifyAdmins(type, title, message, data = null) {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    if (!admins.length) {
      console.error(`notifyAdmins: aucun compte ADMIN trouvé — notification "${type}" perdue.`)
      return
    }
    await Promise.all(admins.map((a) => notify(a.id, type, title, message, data)))
  } catch (e) {
    console.error('notifyAdmins error:', e.message)
  }
}

module.exports = { notify, notifyAdmins }
