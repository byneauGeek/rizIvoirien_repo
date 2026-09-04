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

module.exports = { notify }
