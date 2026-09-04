const prisma = require('../lib/prisma')

async function logAction(adminId, action, targetType, targetId, details) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetType: targetType || null,
        targetId: targetId ? Number(targetId) : null,
        details: details ? JSON.stringify(details) : null,
      },
    })
  } catch (e) {
    console.error('[adminLog] Erreur enregistrement:', e.message)
  }
}

module.exports = { logAction }
