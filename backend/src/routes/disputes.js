const router = require('express').Router()
const prisma  = require('../lib/prisma')
const { authenticate, requireRole } = require('../middleware/auth')
const { notify }   = require('../services/notifications')
const { sendMail } = require('../services/mailer')
const { logAction } = require('../services/adminLog')

const REASONS = {
  PRODUCT_NOT_RECEIVED: 'Produit non reçu',
  PRODUCT_DAMAGED:      'Produit endommagé',
  WRONG_PRODUCT:        'Mauvais produit livré',
  DELIVERY_ISSUE:       'Problème de livraison',
  OTHER:                'Autre',
}

// ── Acheteur : ouvrir un litige ───────────────────────────────────────────────
router.post('/', authenticate, requireRole('BUYER'), async (req, res) => {
  const { orderId, reason, description } = req.body
  if (!orderId || !reason || !description)
    return res.status(400).json({ error: 'orderId, reason et description requis' })
  if (!REASONS[reason])
    return res.status(400).json({ error: 'Motif invalide' })

  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
      include: { shop: { select: { userId: true, name: true } }, buyer: { select: { name: true, email: true } } },
    })
    if (!order)                           return res.status(404).json({ error: 'Commande introuvable' })
    if (order.buyerId !== req.user.id)    return res.status(403).json({ error: 'Accès refusé' })
    if (order.status !== 'DELIVERED')     return res.status(400).json({ error: 'Seules les commandes livrées peuvent faire l\'objet d\'un litige' })

    const existing = await prisma.dispute.findUnique({ where: { orderId: order.id } })
    if (existing) return res.status(409).json({ error: 'Un litige existe déjà pour cette commande' })

    const dispute = await prisma.dispute.create({
      data: {
        orderId: order.id,
        buyerId: req.user.id,
        reason,
        description,
        status: 'OPEN',
      },
    })

    // Notifier l'admin
    setImmediate(() => notify(1, 'NEW_DISPUTE', 'Nouveau litige signalé',
      `Commande #${order.id} — ${REASONS[reason]}`, { disputeId: dispute.id, orderId: order.id }))

    res.status(201).json(dispute)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Acheteur : voir ses litiges ───────────────────────────────────────────────
router.get('/my', authenticate, requireRole('BUYER'), async (req, res) => {
  try {
    const disputes = await prisma.dispute.findMany({
      where: { buyerId: req.user.id },
      include: { order: { select: { id: true, total: true, shop: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(disputes)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Admin : liste tous les litiges ────────────────────────────────────────────
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { status } = req.query
  try {
    const where = status ? { status } : {}
    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        order: { select: { id: true, total: true, deliveryFee: true, shop: { select: { name: true } } } },
        buyer: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ disputes })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Admin : résoudre un litige ────────────────────────────────────────────────
router.put('/:id/resolve', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { status, refundAmount = 0, resolution } = req.body
  const validStatuses = ['UNDER_REVIEW', 'RESOLVED_REFUND', 'RESOLVED_REJECTED', 'CLOSED']
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: `Statut invalide. Valeurs acceptées : ${validStatuses.join(', ')}` })

  try {
    const dispute = await prisma.dispute.update({
      where: { id: Number(req.params.id) },
      data: {
        status,
        refundAmount: Number(refundAmount),
        resolution: resolution || null,
        resolvedAt: ['RESOLVED_REFUND', 'RESOLVED_REJECTED', 'CLOSED'].includes(status) ? new Date() : null,
        updatedAt: new Date(),
      },
      include: {
        buyer: { select: { name: true, email: true } },
        order: { select: { id: true, total: true, shop: { select: { name: true } } } },
      },
    })

    const { buyer, order } = dispute
    setImmediate(() => {
      // Notification in-app
      notify(dispute.buyerId, 'DISPUTE_UPDATE', 'Mise à jour de votre litige',
        status === 'RESOLVED_REFUND'
          ? `Remboursement de ${Number(refundAmount).toLocaleString('fr-FR')} FCFA accordé.`
          : status === 'RESOLVED_REJECTED'
            ? 'Votre litige n\'a pas pu être résolu en votre faveur.'
            : 'Votre litige est en cours de traitement.',
        { disputeId: dispute.id }
      )
      // Email à l'acheteur
      sendMail(buyer?.email, 'disputeResolved', {
        name: buyer?.name || '',
        orderId: order?.id,
        status,
        refundAmount: Number(refundAmount),
        resolution: resolution || '',
        shopName: order?.shop?.name || '',
      })
      // Journal d'audit
      logAction(req.user.id, 'DISPUTE_RESOLVE', 'DISPUTE', dispute.id, { status, refundAmount, resolution })
    })

    res.json(dispute)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
