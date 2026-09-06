const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate } = require('../middleware/auth')
const { notify } = require('../services/notifications')

// ─── Visibilité des coordonnées ──────────────────────────────────────────────
// Règle centralisée (cahier de cadrage §5/§24) : un téléphone n'est visible
// que pour son propriétaire, un admin, ou l'autre partie d'un ContactRequest
// ACCEPTED. Ne JAMAIS dupliquer cette logique ailleurs — tout endpoint qui a
// besoin de savoir si on peut révéler des coordonnées doit passer par ici.
async function canSeeContactInfo(viewerUserId, ownerUserId) {
  if (viewerUserId === ownerUserId) return true
  const accepted = await prisma.contactRequest.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { fromUserId: viewerUserId, toUserId: ownerUserId },
        { fromUserId: ownerUserId, toUserId: viewerUserId },
      ],
    },
  })
  return Boolean(accepted)
}

const userPublic = { select: { id: true, name: true, phone: true, email: true } }

// ─── Mise en relation ─────────────────────────────────────────────────────────

// POST /api/b2b/contacts — démarrer un contact à partir d'une offre OU d'une demande.
// Le destinataire est TOUJOURS dérivé du propriétaire de l'annonce, jamais fourni
// par le client, pour éviter qu'un contact ne soit envoyé à un utilisateur arbitraire.
router.post('/contacts', authenticate, async (req, res) => {
  const { offerId, requestId, message } = req.body
  if (!offerId && !requestId) return res.status(400).json({ error: 'offerId ou requestId requis' })
  if (offerId && requestId) return res.status(400).json({ error: 'Fournir offerId OU requestId, pas les deux' })

  try {
    let toUserId
    if (offerId) {
      const offer = await prisma.riceOffer.findUnique({
        where: { id: Number(offerId) },
        include: { producer: { select: { userId: true } }, cooperative: { select: { userId: true } } },
      })
      if (!offer) return res.status(404).json({ error: 'Offre introuvable' })
      toUserId = offer.producer?.userId ?? offer.cooperative?.userId
    } else {
      const request = await prisma.purchaseRequest.findUnique({
        where: { id: Number(requestId) },
        include: {
          trader: { select: { userId: true } },
          processor: { select: { userId: true } },
          exporter: { select: { userId: true } },
        },
      })
      if (!request) return res.status(404).json({ error: 'Demande introuvable' })
      toUserId = request.trader?.userId ?? request.processor?.userId ?? request.exporter?.userId
    }

    if (!toUserId) return res.status(404).json({ error: 'Propriétaire introuvable' })
    if (toUserId === req.user.id) return res.status(400).json({ error: 'Impossible de vous contacter vous-même' })

    // Évite les doublons : réutilise un contact déjà en cours sur la même annonce.
    const existing = await prisma.contactRequest.findFirst({
      where: {
        fromUserId: req.user.id,
        toUserId,
        offerId: offerId ? Number(offerId) : null,
        requestId: requestId ? Number(requestId) : null,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    })
    if (existing) return res.status(200).json(existing)

    const contact = await prisma.contactRequest.create({
      data: {
        fromUserId: req.user.id,
        toUserId,
        offerId: offerId ? Number(offerId) : null,
        requestId: requestId ? Number(requestId) : null,
        message: message || null,
      },
    })

    setImmediate(() => notify(
      toUserId,
      'B2B_CONTACT_REQUEST',
      'Nouvelle demande de contact',
      `${req.user.name} souhaite entrer en contact avec vous.`,
      { contactId: contact.id }
    ))

    res.status(201).json(contact)
  } catch (e) { sendError(res, e) }
})

// GET /api/b2b/contacts — mes contacts (envoyés + reçus), coordonnées révélées si ACCEPTED
router.get('/contacts', authenticate, async (req, res) => {
  try {
    const contacts = await prisma.contactRequest.findMany({
      where: { OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }] },
      include: {
        fromUser: userPublic,
        toUser: userPublic,
        offer: { select: { id: true, product: true, quantity: true, unit: true, region: true } },
        request: { select: { id: true, product: true, quantity: true, unit: true, region: true } },
        transaction: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const shaped = await Promise.all(contacts.map(async (c) => {
      const isMine = c.fromUserId === req.user.id
      const counterpart = isMine ? c.toUser : c.fromUser
      const reveal = await canSeeContactInfo(req.user.id, counterpart.id)
      return {
        ...c,
        direction: isMine ? 'SENT' : 'RECEIVED',
        counterpart: reveal ? counterpart : { id: counterpart.id, name: counterpart.name },
      }
    }))

    res.json({ contacts: shaped })
  } catch (e) { sendError(res, e) }
})

router.post('/contacts/:id/accept', authenticate, async (req, res) => {
  try {
    const contact = await prisma.contactRequest.findFirst({
      where: { id: Number(req.params.id), toUserId: req.user.id, status: 'PENDING' },
    })
    if (!contact) return res.status(404).json({ error: 'Demande de contact introuvable' })

    const updated = await prisma.contactRequest.update({ where: { id: contact.id }, data: { status: 'ACCEPTED' } })
    setImmediate(() => notify(
      contact.fromUserId, 'B2B_CONTACT_ACCEPTED', 'Contact accepté',
      `${req.user.name} a accepté votre demande de contact.`, { contactId: contact.id }
    ))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

router.post('/contacts/:id/reject', authenticate, async (req, res) => {
  try {
    const contact = await prisma.contactRequest.findFirst({
      where: { id: Number(req.params.id), toUserId: req.user.id, status: 'PENDING' },
    })
    if (!contact) return res.status(404).json({ error: 'Demande de contact introuvable' })

    const updated = await prisma.contactRequest.update({ where: { id: contact.id }, data: { status: 'REJECTED' } })
    setImmediate(() => notify(
      contact.fromUserId, 'B2B_CONTACT_REJECTED', 'Contact refusé',
      `${req.user.name} a décliné votre demande de contact.`, { contactId: contact.id }
    ))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

// ─── Transaction déclarée ─────────────────────────────────────────────────────
// Jamais un paiement : un simple constat, déclaré par l'une des deux parties
// d'un contact ACCEPTED, pour alimenter les statistiques de la marketplace.

router.post('/transactions', authenticate, async (req, res) => {
  const { contactId, quantity, amount, notes, unit, region, product } = req.body
  if (!contactId) return res.status(400).json({ error: 'contactId requis' })
  const qty = Number(quantity)
  if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Quantité invalide' })
  if (amount != null && amount !== '' && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) {
    return res.status(400).json({ error: 'Montant invalide' })
  }

  try {
    const contact = await prisma.contactRequest.findFirst({
      where: {
        id: Number(contactId),
        status: 'ACCEPTED',
        OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }],
      },
      include: { offer: true, request: true },
    })
    if (!contact) return res.status(404).json({ error: 'Contact introuvable ou non accepté' })

    const existingTx = await prisma.b2BTransaction.findUnique({ where: { contactId: contact.id } })
    if (existingTx) return res.status(409).json({ error: 'Une transaction est déjà déclarée pour ce contact' })

    // LOT AUDIT-G3 (audit XXX RIZ) : minOrderQty (LOT B2B-7) était vérifié à
    // la création/édition de l'offre mais jamais relu ici — une transaction
    // pouvait être déclarée sous le MOQ affiché de l'offre d'origine.
    if (contact.offer?.minOrderQty && qty < contact.offer.minOrderQty) {
      return res.status(400).json({
        error: `Quantité (${qty}) inférieure au MOQ de l'offre (${contact.offer.minOrderQty} ${contact.offer.unit})`,
      })
    }
    // LOT AUDIT-OWN-02 (audit XXX RIZ) : RiceOffer.quantity n'était jamais
    // décrémenté par une transaction (restait un total statique jamais lié
    // aux ventes réelles) — une transaction pouvait donc être déclarée
    // au-delà du stock réellement disponible sur l'offre.
    if (contact.offer && qty > contact.offer.quantity) {
      return res.status(400).json({
        error: `Quantité (${qty}) supérieure au stock disponible sur l'offre (${contact.offer.quantity} ${contact.offer.unit})`,
      })
    }

    // L'offre est publiée par le vendeur (destinataire du contact) ; une demande
    // est publiée par l'acheteur (destinataire du contact) — dans les deux cas
    // c'est le contexte de l'annonce qui détermine qui est acheteur / vendeur.
    let buyerUserId, sellerUserId
    if (contact.offerId) {
      sellerUserId = contact.toUserId
      buyerUserId = contact.fromUserId
    } else if (contact.requestId) {
      buyerUserId = contact.toUserId
      sellerUserId = contact.fromUserId
    } else {
      return res.status(400).json({ error: 'Contact sans offre ni demande associée' })
    }

    const source = contact.offer || contact.request

    // LOT AUDIT-G12/OWN-02/OWN-03 (audit XXX RIZ) : tout dans une seule
    // transaction DB — si le décrément atomique de l'offre échoue (stock
    // changé entre-temps par une déclaration concurrente sur le même
    // contact.offer), la création de B2BTransaction doit être annulée avec
    // lui, sinon on obtient une transaction "fantôme" sans décrément
    // correspondant (vente déclarée au-delà du stock réellement restant).
    const tx = await prisma.$transaction(async (db) => {
      const created = await db.b2BTransaction.create({
        data: {
          contactId: contact.id,
          buyerUserId,
          sellerUserId,
          product: product || source?.product || 'Riz',
          quantity: qty,
          unit: unit || source?.unit || 'tonne',
          region: region || source?.region || '',
          amount: amount != null && amount !== '' ? Number(amount) : null,
          notes: notes || null,
          // LOT AUDIT-OWN-03 : snapshot au moment de la déclaration, jamais
          // recalculé depuis l'offre par la suite (voir commentaire schema.prisma).
          ownerProducerId: contact.offer?.ownerProducerId ?? null,
        },
      })

      if (contact.offerId && contact.offer) {
        // Décrément conditionnel (quantity >= qty) plutôt qu'un recalcul
        // depuis la lecture faite plus haut : deux transactions déclarées en
        // parallèle sur la même offre ne doivent jamais la faire passer sous
        // zéro (même classe de garde que stockEngine.js côté B2C).
        const decremented = await db.riceOffer.updateMany({
          where: { id: contact.offerId, status: { in: ['AVAILABLE', 'RESERVED'] }, quantity: { gte: qty } },
          data: { quantity: { decrement: qty } },
        })
        if (decremented.count === 0) {
          const err = new Error('Le stock de cette offre a changé entre-temps — réessayez.')
          err.status = 409
          throw err
        }
        const refreshed = await db.riceOffer.findUnique({ where: { id: contact.offerId }, select: { quantity: true } })
        await db.riceOffer.update({
          where: { id: contact.offerId },
          data: { status: refreshed.quantity <= 0 ? 'SOLD' : 'RESERVED' },
        })
      }

      return created
    })

    const otherPartyId = req.user.id === buyerUserId ? sellerUserId : buyerUserId
    setImmediate(() => notify(
      otherPartyId, 'B2B_TRANSACTION_DECLARED', 'Transaction déclarée',
      `${req.user.name} a déclaré une transaction (${qty} ${tx.unit} de ${tx.product}).`, { transactionId: tx.id }
    ))

    res.status(201).json(tx)
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message })
    sendError(res, e)
  }
})

router.get('/transactions', authenticate, async (req, res) => {
  try {
    const transactions = await prisma.b2BTransaction.findMany({
      where: { OR: [{ buyerUserId: req.user.id }, { sellerUserId: req.user.id }] },
      include: {
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
        // LOT 2 (Arbitrage XXX RIZ) : "suivre ses shipments" — pas un
        // endpoint séparé, la liste de transactions existante suffit une
        // fois le Shipment joint.
        shipment: { select: { id: true, status: true, driverId: true, pickedUpAt: true, deliveredAt: true, failureReason: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ transactions })
  } catch (e) { sendError(res, e) }
})

// GET /api/b2b/transactions/:id/track — LOT 11 (Arbitrage XXX RIZ) :
// équivalent B2B de orders.js GET /:id/track, jusqu'ici totalement absent —
// le backend savait déjà générer un QR/code de secours pour une livraison
// B2B (LOT2/3), mais aucune route n'exposait ces données à l'acheteur B2B,
// qui n'avait donc aucun moyen réel de les consulter. Volontairement plus
// sobre que le B2C : pas de position GPS ni d'ETA (DriverCurrentLocation est
// lié à Order.id, pas à B2BTransaction — brancher une position temps réel
// pour le B2B est un sujet séparé, hors périmètre de ce lot) ; uniquement ce
// qui est strictement nécessaire à la preuve de livraison (QR/code/statut).
router.get('/transactions/:id/track', authenticate, async (req, res) => {
  try {
    const tx = await prisma.b2BTransaction.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, buyerUserId: true },
    })
    if (!tx) return res.status(404).json({ error: 'Transaction introuvable' })
    if (tx.buyerUserId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès refusé' })
    }

    const shipment = await prisma.shipment.findUnique({
      where: { b2bTransactionId: tx.id },
      select: { id: true, status: true, deliveryCode: true },
    })
    if (!shipment) return res.json({ shipmentStatus: null, deliveryCode: null, qrToken: null })

    const qrToken = (await prisma.deliveryVerificationToken.findFirst({
      where: { shipmentId: shipment.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { token: true },
    }))?.token || null

    res.json({ shipmentStatus: shipment.status, deliveryCode: shipment.deliveryCode || null, qrToken })
  } catch (e) { sendError(res, e) }
})

// PUT /api/b2b/transactions/:id/request-logistics — LOT 2 : le TRADER (ou
// tout acheteur B2B) demande une livraison pour une transaction déclarée.
// Seul l'ACHETEUR peut la demander : c'est lui le destinataire de la
// livraison ("être destinataire d'une livraison" — arbitrage §2). Ne crée
// PAS le Shipment ici — l'assignation d'un livreur (admin, voir
// admin.js POST /logistics/b2b/:id/assign) est ce qui crée réellement le
// Shipment, exactement comme pour une commande B2C prête (PRET) qui n'a pas
// encore de livreur.
const VALID_SERVICE_LEVELS = ['ECONOMIC', 'STANDARD', 'EXPRESS']

// LOT 6 (Arbitrage XXX RIZ) : deliveryFee était jusqu'ici une saisie manuelle
// obligatoire ("jamais un montant inventé par le système, toujours une
// décision explicite" — commentaire historique LOT2 du schéma). La grille
// PricingRule (segment=B2B_CARGO) permet désormais un calcul réel, pas
// inventé : coût interne dérivé de la quantité/zone, comme pour le B2C. La
// saisie manuelle reste possible et prime toujours si fournie — jamais
// supprimée, migration progressive uniquement.
router.put('/transactions/:id/request-logistics', authenticate, async (req, res) => {
  const { deliveryAddress, deliveryFee, serviceLevel: requestedServiceLevel } = req.body
  if (!deliveryAddress?.trim()) return res.status(400).json({ error: 'deliveryAddress requis' })
  const serviceLevel = VALID_SERVICE_LEVELS.includes(requestedServiceLevel) ? requestedServiceLevel : 'STANDARD'

  try {
    const tx = await prisma.b2BTransaction.findFirst({
      where: { id: Number(req.params.id), status: 'DECLARED', buyerUserId: req.user.id },
    })
    if (!tx) return res.status(404).json({ error: 'Transaction introuvable, déjà traitée, ou vous n\'en êtes pas l\'acheteur' })

    let finalFee = deliveryFee != null && deliveryFee !== '' ? Number(deliveryFee) : null
    let deliveryInternalCost = null
    let deliveryMargin = null
    if (finalFee == null) {
      const { estimateB2BWeightKg, geocodeAddress, resolveZoneIdForCity } = require('../services/deliveryService')
      const pricingEngine = require('../services/pricingEngine')
      const weightKg = estimateB2BWeightKg(tx.quantity, tx.unit)
      const originZoneId = await resolveZoneIdForCity(prisma, tx.region)
      // NB : aucune coordonnée d'origine n'existe pour un vendeur B2B (pas de
      // Shop, seulement une région déclarative) — distanceKm reste à 0, la
      // règle ne peut donc facturer que base + poids + corridor, jamais un
      // coût kilométrique fictif.
      const destCoords = await geocodeAddress(deliveryAddress.trim())
      const destinationZoneId = destCoords ? await resolveZoneIdForCity(prisma, destCoords.city) : null
      const pricing = await pricingEngine.computePricing(prisma, {
        segment: 'B2B_CARGO', serviceLevel, originZoneId, destinationZoneId, weightKg, distanceKm: 0, packages: 1, extraOrigins: 0,
      }).catch(() => null)
      if (pricing) {
        finalFee = pricing.customerPrice
        deliveryInternalCost = pricing.internalCost
        deliveryMargin = pricing.platformMargin
      }
    }

    const updated = await prisma.b2BTransaction.update({
      where: { id: tx.id },
      data: {
        needsLogistics: true,
        deliveryAddress: deliveryAddress.trim(),
        deliveryFee: finalFee,
        serviceLevel,
        deliveryInternalCost,
        deliveryMargin,
      },
    })
    setImmediate(() => notify(
      tx.sellerUserId, 'B2B_LOGISTICS_REQUESTED', 'Livraison demandée',
      `${req.user.name} a demandé une livraison pour la transaction #${tx.id}.`, { transactionId: tx.id }
    ))
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

// POST /api/b2b/transactions/:id/confirm-receipt — LOT 5 (Arbitrage XXX RIZ,
// "vérification unifiée B2C/B2B" — limite documentée au LOT2) : équivalent
// B2B de orders.js POST /:id/confirm-receipt. Même mécanisme, même garde-fou
// (QR_SCANNED requis, idempotent) — deliveryLifecycle.confirmDeliveryByBuyer
// est déjà générique aux deux sources depuis ce lot, aucune logique
// dupliquée ici.
router.post('/transactions/:id/confirm-receipt', authenticate, async (req, res) => {
  try {
    const tx = await prisma.b2BTransaction.findFirst({
      where: { id: Number(req.params.id), buyerUserId: req.user.id },
    })
    if (!tx) return res.status(404).json({ error: 'Transaction introuvable ou vous n\'en êtes pas l\'acheteur' })

    const deliveryLifecycle = require('../services/deliveryLifecycle')
    await deliveryLifecycle.confirmDeliveryByBuyer(prisma, { b2bTransactionId: tx.id, actorId: req.user.id })

    const shipment = await prisma.shipment.findUnique({ where: { b2bTransactionId: tx.id }, select: { driverId: true } })
    if (shipment?.driverId) {
      const driver = await prisma.driver.findUnique({ where: { id: shipment.driverId }, select: { userId: true } })
      if (driver) {
        await notify(
          driver.userId, 'DELIVERY_CONFIRMED', 'Livraison confirmée par le client',
          `Le client a confirmé la réception de la transaction B2B #${tx.id}.`, { transactionId: tx.id }
        )
      }
    }

    res.json({ success: true })
  } catch (e) {
    if (e.code === 'CONFIRMATION_NOT_READY') return res.status(400).json({ error: e.message })
    sendError(res, e)
  }
})

router.post('/transactions/:id/cancel', authenticate, async (req, res) => {
  try {
    const tx = await prisma.b2BTransaction.findFirst({
      where: {
        id: Number(req.params.id),
        status: 'DECLARED',
        OR: [{ buyerUserId: req.user.id }, { sellerUserId: req.user.id }],
      },
    })
    if (!tx) return res.status(404).json({ error: 'Transaction introuvable' })
    const updated = await prisma.b2BTransaction.update({ where: { id: tx.id }, data: { status: 'CANCELLED' } })
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

// ─── Signalement ──────────────────────────────────────────────────────────────

router.post('/reports', authenticate, async (req, res) => {
  const { targetType, targetId, reason } = req.body
  if (!['PROFILE', 'OFFER', 'REQUEST'].includes(targetType)) return res.status(400).json({ error: 'targetType invalide' })
  if (!targetId || !reason) return res.status(400).json({ error: 'targetId et reason requis' })

  try {
    const report = await prisma.b2BReport.create({
      data: { reporterId: req.user.id, targetType, targetId: Number(targetId), reason },
    })
    res.status(201).json(report)
  } catch (e) { sendError(res, e) }
})

module.exports = router
module.exports.canSeeContactInfo = canSeeContactInfo
