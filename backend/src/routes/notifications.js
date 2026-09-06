const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate } = require('../middleware/auth')

// GET /api/notifications — mes notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const unread = notifications.filter(n => !n.read).length
    res.json({ notifications, unread })
  } catch (e) {
    sendError(res, e)
  }
})

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } })
    res.json({ success: true })
  } catch (e) {
    sendError(res, e)
  }
})

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { id: Number(req.params.id), userId: req.user.id },
      data: { read: true },
    })
    res.json({ success: true })
  } catch (e) {
    sendError(res, e)
  }
})

// DELETE /api/notifications/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.notification.deleteMany({ where: { id: Number(req.params.id), userId: req.user.id } })
    res.json({ success: true })
  } catch (e) {
    sendError(res, e)
  }
})

module.exports = router
