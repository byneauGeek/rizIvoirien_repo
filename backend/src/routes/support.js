const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate } = require('../middleware/auth')
const { notify, notifyAdmins } = require('../services/notifications')
const { resolveTicketPriority } = require('../services/supportPriority')

// POST /api/support/tickets — n'importe quel compte connecté peut ouvrir un
// ticket. priority figé à l'ouverture (cf. commentaire schema.prisma) — un
// changement de plan après coup ne réordonne jamais un ticket déjà ouvert.
router.post('/tickets', authenticate, async (req, res) => {
  const subject = (req.body.subject || '').trim()
  const message = (req.body.message || '').trim()
  if (!subject || !message) return res.status(400).json({ error: 'Sujet et message requis' })
  if (message.length > 4000) return res.status(400).json({ error: 'Message trop long (4000 caractères max)' })

  try {
    const priority = await resolveTicketPriority(req.user)
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.user.id,
        subject,
        priority,
        messages: { create: { senderId: req.user.id, content: message } },
      },
      include: { messages: true },
    })
    await notifyAdmins(
      priority === 'PRIORITY' ? 'SUPPORT_TICKET_PRIORITY' : 'SUPPORT_TICKET_NEW',
      priority === 'PRIORITY' ? 'Nouveau ticket PRIORITAIRE' : 'Nouveau ticket de support',
      `${req.user.name} : "${subject}"`,
      { ticketId: ticket.id }
    )
    res.status(201).json(ticket)
  } catch (e) { sendError(res, e) }
})

// GET /api/support/tickets — mes tickets
router.get('/tickets', authenticate, async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.user.id },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(tickets)
  } catch (e) { sendError(res, e) }
})

// GET /api/support/tickets/:id/messages
router.get('/tickets/:id/messages', authenticate, async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } })
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' })
    const messages = await prisma.supportTicketMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ ticket, messages })
  } catch (e) { sendError(res, e) }
})

// POST /api/support/tickets/:id/messages — répondre à son propre ticket
router.post('/tickets/:id/messages', authenticate, async (req, res) => {
  const content = (req.body.content || '').trim()
  if (!content) return res.status(400).json({ error: 'Message vide' })
  if (content.length > 4000) return res.status(400).json({ error: 'Message trop long (4000 caractères max)' })

  try {
    const ticket = await prisma.supportTicket.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } })
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' })
    if (ticket.status === 'CLOSED') return res.status(400).json({ error: 'Ce ticket est clôturé' })

    const message = await prisma.supportTicketMessage.create({
      data: { ticketId: ticket.id, senderId: req.user.id, content },
    })
    // Une réponse de l'utilisateur sur un ticket déjà pris en charge le
    // remet en file d'attente active plutôt que RESOLVED silencieusement.
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: ticket.status === 'RESOLVED' ? 'OPEN' : ticket.status, updatedAt: new Date() },
    })
    if (ticket.assignedToId) {
      await notify(ticket.assignedToId, 'SUPPORT_TICKET_REPLY', 'Nouvelle réponse sur un ticket', `"${ticket.subject}"`, { ticketId: ticket.id })
    } else {
      await notifyAdmins('SUPPORT_TICKET_REPLY', 'Nouvelle réponse sur un ticket', `"${ticket.subject}"`, { ticketId: ticket.id })
    }
    res.status(201).json(message)
  } catch (e) { sendError(res, e) }
})

module.exports = router
