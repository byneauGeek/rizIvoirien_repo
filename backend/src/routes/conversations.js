const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate } = require('../middleware/auth')
const { notify } = require('../services/notifications')
const { pushToUser } = require('../services/sse')

const CONTEXT_TYPES = ['ORDER', 'ORDER_DRIVER', 'SHIPMENT', 'B2B_TRANSACTION']

// Déduit les deux participants légitimes d'une conversation à partir de son
// contexte transactionnel — jamais un DM générique ouvert (cf. audit
// messagerie XXX RIZ) : le droit de se parler vient déjà de la commande, la
// livraison ou la transaction B2B qui les lie.
async function resolveParticipants(contextType, contextId) {
  if (contextType === 'ORDER') {
    const order = await prisma.order.findUnique({ where: { id: contextId }, include: { shop: true } })
    if (!order) return null
    return { a: order.buyerId, b: order.shop.userId }
  }
  // Commande B2C : Order.driverId est déjà dénormalisé sur la commande
  // elle-même (pas besoin de passer par Shipment) — c'est ce que
  // MyOrdersPage a déjà sous la main pour afficher le livreur assigné.
  if (contextType === 'ORDER_DRIVER') {
    const order = await prisma.order.findUnique({ where: { id: contextId } })
    if (!order?.driverId) return null
    const driver = await prisma.driver.findUnique({ where: { id: order.driverId } })
    if (!driver) return null
    return { a: order.buyerId, b: driver.userId }
  }
  if (contextType === 'SHIPMENT') {
    const shipment = await prisma.shipment.findUnique({ where: { id: contextId }, include: { order: true } })
    if (!shipment?.driverId || !shipment.order?.buyerId) return null
    const driver = await prisma.driver.findUnique({ where: { id: shipment.driverId } })
    if (!driver) return null
    return { a: shipment.order.buyerId, b: driver.userId }
  }
  if (contextType === 'B2B_TRANSACTION') {
    const tx = await prisma.b2BTransaction.findUnique({ where: { id: contextId } })
    if (!tx) return null
    return { a: tx.buyerUserId, b: tx.sellerUserId }
  }
  return null
}

// POST /api/conversations/resolve — récupère (ou crée) la conversation liée à
// un contexte donné. C'est le seul point d'entrée pour "commencer à parler
// avec X" — l'appelant ne choisit jamais directement l'autre participant.
router.post('/resolve', authenticate, async (req, res) => {
  const { contextType, contextId } = req.body
  if (!CONTEXT_TYPES.includes(contextType) || !contextId) {
    return res.status(400).json({ error: 'contextType (ORDER|SHIPMENT|B2B_TRANSACTION) et contextId requis' })
  }
  try {
    const participants = await resolveParticipants(contextType, Number(contextId))
    if (!participants) return res.status(404).json({ error: 'Contexte introuvable ou messagerie non disponible pour cette livraison' })
    const { a, b } = participants
    if (req.user.id !== a && req.user.id !== b) return res.status(403).json({ error: 'Accès refusé' })

    const conversation = await prisma.conversation.upsert({
      where: { contextType_contextId: { contextType, contextId: Number(contextId) } },
      update: {},
      create: { contextType, contextId: Number(contextId), userAId: a, userBId: b },
      include: {
        userA: { select: { id: true, name: true } },
        userB: { select: { id: true, name: true } },
      },
    })
    const otherParty = conversation.userAId === req.user.id ? conversation.userB : conversation.userA
    res.json({ id: conversation.id, contextType: conversation.contextType, contextId: conversation.contextId, otherParty })
  } catch (e) { sendError(res, e) }
})

// GET /api/conversations — liste des conversations de l'utilisateur courant
router.get('/', authenticate, async (req, res) => {
  try {
    const list = await prisma.conversation.findMany({
      where: { OR: [{ userAId: req.user.id }, { userBId: req.user.id }] },
      include: {
        userA: { select: { id: true, name: true } },
        userB: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    })
    const result = await Promise.all(list.map(async (c) => {
      const otherParty = c.userAId === req.user.id ? c.userB : c.userA
      const unreadCount = await prisma.message.count({
        where: { conversationId: c.id, read: false, NOT: { senderId: req.user.id } },
      })
      return {
        id: c.id,
        contextType: c.contextType,
        contextId: c.contextId,
        otherParty,
        lastMessage: c.messages[0] || null,
        unreadCount,
        updatedAt: c.updatedAt,
      }
    }))
    res.json(result)
  } catch (e) { sendError(res, e) }
})

// GET /api/conversations/:id/messages
router.get('/:id/messages', authenticate, async (req, res) => {
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: Number(req.params.id) } })
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' })
    if (conv.userAId !== req.user.id && conv.userBId !== req.user.id) return res.status(403).json({ error: 'Accès refusé' })

    const messages = await prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })
    res.json(messages)
  } catch (e) { sendError(res, e) }
})

// POST /api/conversations/:id/messages
router.post('/:id/messages', authenticate, async (req, res) => {
  const content = (req.body.content || '').trim()
  if (!content) return res.status(400).json({ error: 'Message vide' })
  if (content.length > 2000) return res.status(400).json({ error: 'Message trop long (2000 caractères max)' })
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: Number(req.params.id) } })
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' })
    if (conv.userAId !== req.user.id && conv.userBId !== req.user.id) return res.status(403).json({ error: 'Accès refusé' })

    const message = await prisma.message.create({
      data: { conversationId: conv.id, senderId: req.user.id, content },
    })
    await prisma.conversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } })

    const recipientId = conv.userAId === req.user.id ? conv.userBId : conv.userAId
    await notify(recipientId, 'NEW_MESSAGE', `Nouveau message de ${req.user.name}`, content.slice(0, 140), { conversationId: conv.id })
    pushToUser(recipientId, 'new_message', { conversationId: conv.id })

    res.status(201).json(message)
  } catch (e) { sendError(res, e) }
})

// POST /api/conversations/:id/read — marque comme lus tous les messages reçus
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: Number(req.params.id) } })
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' })
    if (conv.userAId !== req.user.id && conv.userBId !== req.user.id) return res.status(403).json({ error: 'Accès refusé' })

    await prisma.message.updateMany({
      where: { conversationId: conv.id, read: false, NOT: { senderId: req.user.id } },
      data: { read: true },
    })
    res.json({ success: true })
  } catch (e) { sendError(res, e) }
})

module.exports = router
