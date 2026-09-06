const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate, requireRole } = require('../middleware/auth')
const { notify } = require('../services/notifications')

// ─── Listes de référence (régions, produits, unités) ─────────────────────────
// Gérées par l'admin (voir b2bAdmin.js) — cette route publique alimente les
// listes déroulantes/suggestions du frontend, jamais figées dans son code.
router.get('/reference-data', async (req, res) => {
  try {
    const items = await prisma.b2BReferenceItem.findMany({ where: { active: true }, orderBy: { value: 'asc' } })
    const byType = (t) => items.filter(i => i.type === t).map(i => i.value)
    res.json({ regions: byType('REGION'), products: byType('PRODUCT'), units: byType('UNIT') })
  } catch (e) { sendError(res, e) }
})

// ─── Profils ────────────────────────────────────────────────────────────────

const PROFILE_MODEL = {
  PRODUCER: 'producer',
  COOPERATIVE: 'cooperative',
  TRADER: 'trader',
  PROCESSOR: 'processor',
  EXPORTER: 'exporter',
}

// LOT AUDIT-G13 (audit XXX RIZ) : documentUrl éditable sur les 5 profils —
// permet au titulaire de fournir une pièce justificative (RCCM, identité...)
// avant de demander la vérification admin (POST .../request-verification).
const EDITABLE_FIELDS = {
  PRODUCER: ['region', 'department', 'commune', 'locality', 'farmType', 'surfaceHa', 'capacityKg', 'photo', 'description', 'documentUrl'],
  // LOT AUDIT-ACC-05 : commissionRate éditable — taux que LA COOPÉRATIVE
  // (pas la plateforme) prélève sur les ventes de ses membres.
  COOPERATIVE: ['name', 'responsable', 'region', 'zone', 'description', 'documentUrl', 'commissionRate'],
  TRADER: ['companyName', 'activity', 'zones', 'documentUrl'],
  PROCESSOR: ['companyName', 'zones', 'documentUrl'],
  EXPORTER: ['companyName', 'capacityKg', 'zones', 'documentUrl'],
}

const NUMERIC_FIELDS = new Set(['surfaceHa', 'capacityKg', 'commissionRate'])

const B2B_ROLES = Object.keys(PROFILE_MODEL)

const requireB2BRole = requireRole(...B2B_ROLES)

// Retourne { model, actorId } pour l'utilisateur courant, ou null si aucun profil.
// LOT 2 (Arbitrage XXX RIZ) : ne se limite plus au rôle PRINCIPAL — un compte
// dont le rôle principal n'est pas un rôle B2B (ex. BUYER) peut avoir activé
// une capacité B2B secondaire (UserCapability, ex. TRADER). On résout alors
// sur la première capacité qui correspond à un profil B2B connu. Limitation
// connue et acceptée pour ce lot : si un compte cumulait un jour DEUX
// capacités B2B différentes en même temps, ce choix serait ambigu (le
// premier match l'emporte) — non pertinent pour BUYER+TRADER (un seul côté
// est un rôle B2B), à revisiter si un cumul B2B×B2B est demandé plus tard.
const roleForActor = (req) => {
  if (PROFILE_MODEL[req.user.role]) return req.user.role
  return (req.user.capabilities || []).find((c) => PROFILE_MODEL[c]) || null
}

async function myActor(req) {
  const actingRole = roleForActor(req)
  const modelName = PROFILE_MODEL[actingRole]
  if (!modelName) return null
  const row = await prisma.user.findUnique({ where: { id: req.user.id }, include: { [modelName]: true } })
  const profile = row?.[modelName]
  if (!profile) return null
  return { modelName, profile, actingRole }
}

router.get('/my-profile', authenticate, requireB2BRole, async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    res.json(actor.profile)
  } catch (e) { sendError(res, e) }
})

router.put('/my-profile', authenticate, requireB2BRole, async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })

    const allowed = EDITABLE_FIELDS[actor.actingRole]
    const data = {}
    for (const field of allowed) {
      if (!(field in req.body)) continue
      data[field] = NUMERIC_FIELDS.has(field) && req.body[field] !== '' && req.body[field] != null
        ? Number(req.body[field])
        : req.body[field]
    }
    if (data.commissionRate !== undefined && (!Number.isFinite(data.commissionRate) || data.commissionRate < 0 || data.commissionRate > 100)) {
      return res.status(400).json({ error: 'Taux de commission invalide (0 à 100)' })
    }

    const updated = await prisma[actor.modelName].update({ where: { id: actor.profile.id }, data })
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

// POST /api/b2b/my-profile/request-verification — passe le profil en file
// d'attente admin (cahier de cadrage §10 : Non vérifié → Vérification en cours).
router.post('/my-profile/request-verification', authenticate, requireB2BRole, async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    if (actor.profile.verification === 'VERIFIED') return res.status(400).json({ error: 'Ce profil est déjà vérifié' })
    if (actor.profile.verification === 'PENDING') return res.status(400).json({ error: 'Une demande est déjà en cours' })
    // LOT AUDIT-G13 (audit XXX RIZ) : sans cette vérification, un profil
    // pouvait demander (et obtenir) VERIFIED sans jamais avoir fourni de
    // pièce justificative.
    if (!actor.profile.documentUrl) {
      return res.status(400).json({ error: 'Ajoutez une pièce justificative (RCCM, identité...) avant de demander la vérification' })
    }

    const updated = await prisma[actor.modelName].update({
      where: { id: actor.profile.id },
      // rejectionReason effacé : une nouvelle soumission ne doit plus
      // afficher le motif d'un refus passé (cf. commentaire schema.prisma).
      data: { verification: 'PENDING', rejectionReason: null },
    })
    // LOT AUDIT-B2B-05 (audit XXX RIZ) : gap confirmé — aucune notification
    // n'existait ni pour l'utilisateur (confirmation de réception) ni pour
    // l'admin (nouvelle candidature à traiter). Admin notifié via l'id 1,
    // même convention que NEW_DISPUTE (disputes.js) et PLAN_UPGRADE_REQUEST
    // (shops.js/drivers.js) dans ce projet.
    await notify(req.user.id, 'B2B_VERIFICATION', 'Candidature soumise',
      'Votre demande de vérification a été transmise à l\'équipe RizIvoirien. Vous serez notifié dès son examen.',
      { profileType: actor.actingRole })
    await notify(1, 'B2B_NEW_APPLICATION', 'Nouvelle candidature B2B',
      `${req.user.name} (${actor.actingRole}) a soumis une candidature B2B à examiner.`,
      { profileType: actor.actingRole, profileId: actor.profile.id })
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

// ─── Offres (Producteur / Coopérative) ───────────────────────────────────────

const OFFER_SELLER_ROLES = ['PRODUCER', 'COOPERATIVE']

router.get('/offers', async (req, res) => {
  const { product, region, minQuantity, sellerType, availableBy, search, limit = '20', offset = '0' } = req.query
  try {
    const and = [{ status: 'AVAILABLE' }]
    if (product) and.push({ product })
    if (region) and.push({ region: { contains: region } })
    if (minQuantity) and.push({ quantity: { gte: Number(minQuantity) } })
    if (sellerType === 'PRODUCER') and.push({ producerId: { not: null } })
    if (sellerType === 'COOPERATIVE') and.push({ cooperativeId: { not: null } })
    // "Disponible avant le [date]" (§5/§6 disponibilité) : une offre sans date
    // déclarée est considérée disponible immédiatement, donc toujours incluse.
    if (availableBy) {
      const byDate = new Date(availableBy)
      if (!isNaN(byDate)) and.push({ OR: [{ availableFrom: null }, { availableFrom: { lte: byDate } }] })
    }
    if (search) and.push({ OR: [{ product: { contains: search } }, { variety: { contains: search } }] })
    // Un acteur suspendu (§10) disparaît de la recherche publique — la suspension
    // administrative doit avoir un effet réel, pas juste cosmétique sur le badge.
    and.push({ OR: [{ producerId: null }, { producer: { verification: { not: 'SUSPENDED' } } }] })
    and.push({ OR: [{ cooperativeId: null }, { cooperative: { verification: { not: 'SUSPENDED' } } }] })
    const where = { AND: and }

    const [offers, total] = await Promise.all([
      prisma.riceOffer.findMany({
        where,
        include: {
          producer: { select: { id: true, region: true, verification: true, user: { select: { name: true } } } },
          cooperative: { select: { id: true, name: true, region: true, verification: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit) || 20, 100),
        skip: Number(offset) || 0,
      }),
      prisma.riceOffer.count({ where }),
    ])
    res.json({ offers, total })
  } catch (e) { sendError(res, e) }
})

router.get('/offers/mine', authenticate, requireRole(...OFFER_SELLER_ROLES), async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const where = actor.modelName === 'producer' ? { producerId: actor.profile.id } : { cooperativeId: actor.profile.id }
    const offers = await prisma.riceOffer.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { ownerProducer: { select: { id: true, region: true, user: { select: { name: true } } } } },
    })
    res.json({ offers })
  } catch (e) { sendError(res, e) }
})

router.get('/offers/:id', async (req, res) => {
  try {
    const offer = await prisma.riceOffer.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        // Les coordonnées (téléphone) ne sont jamais exposées ici — elles ne se
        // révèlent qu'après acceptation d'une demande de contact (b2bContact.js).
        producer: { select: { id: true, region: true, verification: true, user: { select: { id: true, name: true } } } },
        cooperative: { select: { id: true, name: true, region: true, verification: true, responsable: true, userId: true } },
        ownerProducer: { select: { id: true, region: true, user: { select: { name: true } } } },
      },
    })
    if (!offer) return res.status(404).json({ error: 'Offre introuvable' })
    res.json(offer)
  } catch (e) { sendError(res, e) }
})

// LOT AUDIT-OWN-01 (audit XXX RIZ) : ownerProducerId n'est accepté que pour
// une offre COOPERATIVE, et seulement s'il référence un membre RÉEL et actif
// de cette coopérative — jamais un producteur arbitraire (fuite d'attribution
// vers un tiers sans lien réel avec la coopérative).
async function resolveOwnerProducerId(actor, ownerProducerId) {
  if (actor.modelName !== 'cooperative' || ownerProducerId === undefined || ownerProducerId === null || ownerProducerId === '') {
    return null
  }
  const oid = Number(ownerProducerId)
  const membership = await prisma.cooperativeMember.findUnique({
    where: { cooperativeId_producerId: { cooperativeId: actor.profile.id, producerId: oid } },
  })
  if (!membership || !membership.active) {
    const err = new Error("Le propriétaire doit être un membre actif de la coopérative")
    err.status = 400
    throw err
  }
  return oid
}

router.post('/offers', authenticate, requireRole(...OFFER_SELLER_ROLES), async (req, res) => {
  const { product, variety, quantity, unit, region, availableFrom, quality, price, photos, status, minOrderQty, ownerProducerId } = req.body
  if (!product || !quantity || !unit || !region) return res.status(400).json({ error: 'Champs requis manquants' })
  const qty = Number(quantity)
  if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Quantité invalide' })
  if (price !== undefined && price !== null && price !== '' && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
    return res.status(400).json({ error: 'Prix invalide' })
  }
  // LOT B2B-7 : le MOQ ne peut jamais dépasser le stock total offert (qty) —
  // une offre "minimum 500 kg" avec seulement 200 kg disponibles serait
  // trompeuse, jamais honorable telle quelle.
  let moq = null
  if (minOrderQty !== undefined && minOrderQty !== null && minOrderQty !== '') {
    moq = Number(minOrderQty)
    if (!Number.isFinite(moq) || moq <= 0) return res.status(400).json({ error: 'MOQ invalide (doit être positif)' })
    if (moq > qty) return res.status(400).json({ error: `MOQ (${moq}) ne peut pas dépasser la quantité disponible (${qty})` })
  }

  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable — complétez votre profil avant de publier' })
    if (actor.profile.verification === 'SUSPENDED') return res.status(403).json({ error: 'Votre profil est suspendu — contactez le support' })

    let resolvedOwnerId
    try {
      resolvedOwnerId = await resolveOwnerProducerId(actor, ownerProducerId)
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message })
    }

    const offer = await prisma.riceOffer.create({
      data: {
        producerId: actor.modelName === 'producer' ? actor.profile.id : null,
        cooperativeId: actor.modelName === 'cooperative' ? actor.profile.id : null,
        ownerProducerId: resolvedOwnerId,
        product, variety: variety || null, quantity: qty, unit, region,
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        quality: quality || null,
        price: price !== undefined && price !== null && price !== '' ? Number(price) : null,
        minOrderQty: moq,
        photos: JSON.stringify(photos || []),
        status: ['DRAFT', 'AVAILABLE'].includes(status) ? status : 'AVAILABLE',
      },
    })
    res.status(201).json(offer)
  } catch (e) { sendError(res, e) }
})

router.put('/offers/:id', authenticate, requireRole(...OFFER_SELLER_ROLES), async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const ownerWhere = actor.modelName === 'producer' ? { producerId: actor.profile.id } : { cooperativeId: actor.profile.id }

    const existing = await prisma.riceOffer.findFirst({ where: { id: Number(req.params.id), ...ownerWhere } })
    if (!existing) return res.status(404).json({ error: 'Offre introuvable' })

    const EDITABLE = ['product', 'variety', 'quantity', 'minOrderQty', 'unit', 'region', 'availableFrom', 'quality', 'price', 'photos', 'status', 'ownerProducerId']
    const VALID_STATUS = ['DRAFT', 'AVAILABLE', 'RESERVED', 'SOLD', 'EXPIRED', 'DISABLED']
    const data = {}
    for (const field of EDITABLE) {
      if (!(field in req.body)) continue
      if (field === 'status') {
        if (!VALID_STATUS.includes(req.body.status)) return res.status(400).json({ error: `Statut invalide : "${req.body.status}" (attendu : ${VALID_STATUS.join(', ')})` })
        data.status = req.body.status
      } else if (field === 'quantity') {
        const qty = Number(req.body.quantity)
        if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Quantité invalide' })
        data.quantity = qty
      } else if (field === 'minOrderQty') {
        const raw = req.body.minOrderQty
        if (raw === null || raw === '') data.minOrderQty = null
        else {
          const moq = Number(raw)
          const finalQty = data.quantity ?? existing.quantity
          if (!Number.isFinite(moq) || moq <= 0) return res.status(400).json({ error: 'MOQ invalide (doit être positif)' })
          if (moq > finalQty) return res.status(400).json({ error: `MOQ (${moq}) ne peut pas dépasser la quantité disponible (${finalQty})` })
          data.minOrderQty = moq
        }
      } else if (field === 'price') {
        const p = req.body.price
        if (p === null || p === '') data.price = null
        else {
          const n = Number(p)
          if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Prix invalide' })
          data.price = n
        }
      } else if (field === 'availableFrom') {
        data.availableFrom = req.body.availableFrom ? new Date(req.body.availableFrom) : null
      } else if (field === 'photos') {
        data.photos = JSON.stringify(req.body.photos || [])
      } else if (field === 'ownerProducerId') {
        try {
          data.ownerProducerId = await resolveOwnerProducerId(actor, req.body.ownerProducerId)
        } catch (err) {
          return res.status(err.status || 400).json({ error: err.message })
        }
      } else {
        data[field] = req.body[field]
      }
    }

    // Si la quantité baisse SANS que minOrderQty ne soit touché dans cette
    // même requête, le MOQ existant peut devenir incohérent (ex. MOQ 500 kg
    // pour un stock réduit à 300 kg) — vérifié après coup, une seule fois,
    // plutôt que de dupliquer la logique ci-dessus.
    if (data.quantity !== undefined && data.minOrderQty === undefined) {
      const effectiveMoq = existing.minOrderQty
      if (effectiveMoq != null && effectiveMoq > data.quantity) {
        return res.status(400).json({ error: `La quantité disponible (${data.quantity}) ne peut pas passer sous le MOQ actuel (${effectiveMoq}) — mettez aussi à jour le MOQ` })
      }
    }

    const updated = await prisma.riceOffer.update({ where: { id: existing.id }, data })
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

router.delete('/offers/:id', authenticate, requireRole(...OFFER_SELLER_ROLES), async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const ownerWhere = actor.modelName === 'producer' ? { producerId: actor.profile.id } : { cooperativeId: actor.profile.id }

    const existing = await prisma.riceOffer.findFirst({ where: { id: Number(req.params.id), ...ownerWhere } })
    if (!existing) return res.status(404).json({ error: 'Offre introuvable' })

    if (existing.status === 'DRAFT') {
      await prisma.riceOffer.delete({ where: { id: existing.id } })
    } else {
      await prisma.riceOffer.update({ where: { id: existing.id }, data: { status: 'DISABLED' } })
    }
    res.json({ ok: true })
  } catch (e) { sendError(res, e) }
})

// ─── Demandes (Acheteur / Transformateur / Exportateur) ─────────────────────

const REQUEST_BUYER_ROLES = ['TRADER', 'PROCESSOR', 'EXPORTER']
const REQUEST_ACTOR_FK = { trader: 'traderId', processor: 'processorId', exporter: 'exporterId' }

router.get('/requests', async (req, res) => {
  const { product, region, minQuantity, actorType, search, limit = '20', offset = '0' } = req.query
  try {
    const and = [{ status: 'ACTIVE' }]
    if (product) and.push({ product })
    if (region) and.push({ region: { contains: region } })
    if (minQuantity) and.push({ quantity: { gte: Number(minQuantity) } })
    if (actorType === 'TRADER') and.push({ traderId: { not: null } })
    if (actorType === 'PROCESSOR') and.push({ processorId: { not: null } })
    if (actorType === 'EXPORTER') and.push({ exporterId: { not: null } })
    // "Disponibilité" pour une demande est une période libre (§6), pas une date
    // structurée — on la couvre via la recherche texte plutôt qu'un filtre exact.
    if (search) and.push({ OR: [{ product: { contains: search } }, { requirements: { contains: search } }, { period: { contains: search } }] })
    and.push({ OR: [{ traderId: null }, { trader: { verification: { not: 'SUSPENDED' } } }] })
    and.push({ OR: [{ processorId: null }, { processor: { verification: { not: 'SUSPENDED' } } }] })
    and.push({ OR: [{ exporterId: null }, { exporter: { verification: { not: 'SUSPENDED' } } }] })
    const where = { AND: and }

    const [requests, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        include: {
          trader: { select: { id: true, companyName: true, verification: true } },
          processor: { select: { id: true, companyName: true, verification: true } },
          exporter: { select: { id: true, companyName: true, verification: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit) || 20, 100),
        skip: Number(offset) || 0,
      }),
      prisma.purchaseRequest.count({ where }),
    ])
    res.json({ requests, total })
  } catch (e) { sendError(res, e) }
})

router.get('/requests/mine', authenticate, requireRole(...REQUEST_BUYER_ROLES), async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const fk = REQUEST_ACTOR_FK[actor.modelName]
    const requests = await prisma.purchaseRequest.findMany({ where: { [fk]: actor.profile.id }, orderBy: { createdAt: 'desc' } })
    res.json({ requests })
  } catch (e) { sendError(res, e) }
})

router.get('/requests/:id', async (req, res) => {
  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        // Idem : téléphone jamais public, uniquement après contact accepté.
        trader: { select: { id: true, companyName: true, verification: true, user: { select: { id: true, name: true } } } },
        processor: { select: { id: true, companyName: true, verification: true, user: { select: { id: true, name: true } } } },
        exporter: { select: { id: true, companyName: true, verification: true, user: { select: { id: true, name: true } } } },
      },
    })
    if (!request) return res.status(404).json({ error: 'Demande introuvable' })
    res.json(request)
  } catch (e) { sendError(res, e) }
})

router.post('/requests', authenticate, requireRole(...REQUEST_BUYER_ROLES), async (req, res) => {
  const { product, quantity, unit, region, period, requirements, status } = req.body
  if (!product || !quantity || !unit || !region) return res.status(400).json({ error: 'Champs requis manquants' })
  const qty = Number(quantity)
  if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Quantité invalide' })

  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable — complétez votre profil avant de publier' })
    if (actor.profile.verification === 'SUSPENDED') return res.status(403).json({ error: 'Votre profil est suspendu — contactez le support' })
    const fk = REQUEST_ACTOR_FK[actor.modelName]

    const request = await prisma.purchaseRequest.create({
      data: {
        [fk]: actor.profile.id,
        product, quantity: qty, unit, region,
        period: period || null,
        requirements: requirements || null,
        status: ['DRAFT', 'ACTIVE'].includes(status) ? status : 'ACTIVE',
      },
    })
    res.status(201).json(request)
  } catch (e) { sendError(res, e) }
})

router.put('/requests/:id', authenticate, requireRole(...REQUEST_BUYER_ROLES), async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const fk = REQUEST_ACTOR_FK[actor.modelName]

    const existing = await prisma.purchaseRequest.findFirst({ where: { id: Number(req.params.id), [fk]: actor.profile.id } })
    if (!existing) return res.status(404).json({ error: 'Demande introuvable' })

    const EDITABLE = ['product', 'quantity', 'unit', 'region', 'period', 'requirements', 'status']
    const VALID_STATUS = ['DRAFT', 'ACTIVE', 'FULFILLED', 'EXPIRED', 'CANCELLED']
    const data = {}
    for (const field of EDITABLE) {
      if (!(field in req.body)) continue
      if (field === 'status') {
        if (!VALID_STATUS.includes(req.body.status)) return res.status(400).json({ error: `Statut invalide : "${req.body.status}" (attendu : ${VALID_STATUS.join(', ')})` })
        data.status = req.body.status
      } else if (field === 'quantity') {
        const qty = Number(req.body.quantity)
        if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Quantité invalide' })
        data.quantity = qty
      } else {
        data[field] = req.body[field]
      }
    }

    const updated = await prisma.purchaseRequest.update({ where: { id: existing.id }, data })
    res.json(updated)
  } catch (e) { sendError(res, e) }
})

router.delete('/requests/:id', authenticate, requireRole(...REQUEST_BUYER_ROLES), async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const fk = REQUEST_ACTOR_FK[actor.modelName]

    const existing = await prisma.purchaseRequest.findFirst({ where: { id: Number(req.params.id), [fk]: actor.profile.id } })
    if (!existing) return res.status(404).json({ error: 'Demande introuvable' })

    if (existing.status === 'DRAFT') {
      await prisma.purchaseRequest.delete({ where: { id: existing.id } })
    } else {
      await prisma.purchaseRequest.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } })
    }
    res.json({ ok: true })
  } catch (e) { sendError(res, e) }
})

// ─── Coopérative : membres (producteurs affiliés) ────────────────────────────

// LOT AUDIT-ORG-02 (audit XXX RIZ) : ?search (nom/région) et ?active
// (true|false, omis = tous) — absents jusqu'ici, aucun moyen de retrouver un
// membre dans une coopérative en comptant beaucoup.
router.get('/cooperative/members', authenticate, requireRole('COOPERATIVE'), async (req, res) => {
  const { search, active } = req.query
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const where = { cooperativeId: actor.profile.id }
    if (active === 'true' || active === 'false') where.active = active === 'true'
    if (search?.trim()) {
      where.producer = {
        OR: [
          { region: { contains: search.trim() } },
          { user: { name: { contains: search.trim() } } },
        ],
      }
    }
    const members = await prisma.cooperativeMember.findMany({
      where,
      include: { producer: { select: { id: true, region: true, verification: true, user: { select: { name: true, phone: true } } } } },
      orderBy: { joinedAt: 'desc' },
    })
    res.json({ members })
  } catch (e) { sendError(res, e) }
})

// GET /cooperative/members/:producerId — fiche détail d'un membre (LOT ORG-02)
router.get('/cooperative/members/:producerId', authenticate, requireRole('COOPERATIVE'), async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const member = await prisma.cooperativeMember.findUnique({
      where: { cooperativeId_producerId: { cooperativeId: actor.profile.id, producerId: Number(req.params.producerId) } },
      include: {
        producer: {
          select: {
            id: true, region: true, department: true, commune: true, farmType: true, surfaceHa: true, capacityKg: true, verification: true,
            user: { select: { name: true, email: true, phone: true } },
            // LOT AUDIT-ORG-03 (audit XXX RIZ) : "marchandises apportées" —
            // seules les offres explicitement attribuées à CE membre au sein
            // de CETTE coopérative (jamais les offres publiées par le membre
            // en son nom propre ailleurs, hors périmètre de cette fiche).
            ownedOffers: { where: { cooperativeId: actor.profile.id }, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    })
    if (!member) return res.status(404).json({ error: 'Membre introuvable' })
    res.json(member)
  } catch (e) { sendError(res, e) }
})

// PUT /cooperative/members/:producerId — activer/désactiver, note interne (LOT ORG-02)
router.put('/cooperative/members/:producerId', authenticate, requireRole('COOPERATIVE'), async (req, res) => {
  const { active, note } = req.body
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const data = {}
    if (typeof active === 'boolean') data.active = active
    if (note !== undefined) data.note = note || null
    const result = await prisma.cooperativeMember.updateMany({
      where: { cooperativeId: actor.profile.id, producerId: Number(req.params.producerId) },
      data,
    })
    if (result.count === 0) return res.status(404).json({ error: 'Membre introuvable' })
    const member = await prisma.cooperativeMember.findUnique({
      where: { cooperativeId_producerId: { cooperativeId: actor.profile.id, producerId: Number(req.params.producerId) } },
    })
    res.json(member)
  } catch (e) { sendError(res, e) }
})

// ─── Coopérative : ledger membre (LOT AUDIT-ACC-05) ──────────────────────────
// Ledger DÉCLARATIF interne à la coopérative — SALE_CREDIT/COMMISSION générés
// automatiquement à la déclaration d'une transaction (b2bContact.js), jamais
// ici. Cette route ne permet que PAYMENT (paiement effectué au membre, hors
// plateforme) et ADJUSTMENT (correction motivée) — jamais SALE_CREDIT ni
// COMMISSION en saisie manuelle, qui resteraient alors non traçables vers une
// vente réelle.
router.get('/cooperative/members/:producerId/ledger', authenticate, requireRole('COOPERATIVE'), async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const producerId = Number(req.params.producerId)
    const membership = await prisma.cooperativeMember.findUnique({
      where: { cooperativeId_producerId: { cooperativeId: actor.profile.id, producerId } },
    })
    if (!membership) return res.status(404).json({ error: 'Membre introuvable' })

    const entries = await prisma.cooperativeLedgerEntry.findMany({
      where: { cooperativeId: actor.profile.id, producerId },
      orderBy: { createdAt: 'desc' },
    })
    const balance = entries.reduce((sum, e) => sum + e.amount, 0)
    res.json({ entries, balance })
  } catch (e) { sendError(res, e) }
})

router.post('/cooperative/members/:producerId/payments', authenticate, requireRole('COOPERATIVE'), async (req, res) => {
  const { amount, reference, description } = req.body
  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Montant invalide' })
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const producerId = Number(req.params.producerId)
    const membership = await prisma.cooperativeMember.findUnique({
      where: { cooperativeId_producerId: { cooperativeId: actor.profile.id, producerId } },
    })
    if (!membership) return res.status(404).json({ error: 'Membre introuvable' })

    const entry = await prisma.cooperativeLedgerEntry.create({
      data: {
        cooperativeId: actor.profile.id, producerId,
        type: 'PAYMENT', amount: -amt,
        sourceType: 'MANUAL', reference: reference || null,
        description: description || 'Paiement au membre',
        authorUserId: req.user.id,
      },
    })
    res.status(201).json(entry)
  } catch (e) { sendError(res, e) }
})

router.post('/cooperative/members/:producerId/adjustments', authenticate, requireRole('COOPERATIVE'), async (req, res) => {
  const { amount, description } = req.body
  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt === 0) return res.status(400).json({ error: 'Montant invalide (différent de zéro)' })
  if (!description?.trim()) return res.status(400).json({ error: 'Motif requis pour un ajustement' })
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    const producerId = Number(req.params.producerId)
    const membership = await prisma.cooperativeMember.findUnique({
      where: { cooperativeId_producerId: { cooperativeId: actor.profile.id, producerId } },
    })
    if (!membership) return res.status(404).json({ error: 'Membre introuvable' })

    const entry = await prisma.cooperativeLedgerEntry.create({
      data: {
        cooperativeId: actor.profile.id, producerId,
        type: 'ADJUSTMENT', amount: amt,
        sourceType: 'MANUAL', description: description.trim(),
        authorUserId: req.user.id,
      },
    })
    res.status(201).json(entry)
  } catch (e) { sendError(res, e) }
})

// GET /my-ledger — self-service, un PRODUCER consulte SON PROPRE solde/ledger,
// jamais celui d'un autre membre (permission MEMBRE, LOT AUDIT-PERM).
router.get('/my-ledger', authenticate, requireRole('PRODUCER'), async (req, res) => {
  try {
    const producer = await prisma.producer.findUnique({ where: { userId: req.user.id } })
    if (!producer) return res.status(404).json({ error: 'Profil introuvable' })
    const entries = await prisma.cooperativeLedgerEntry.findMany({
      where: { producerId: producer.id },
      orderBy: { createdAt: 'desc' },
    })
    const balance = entries.reduce((sum, e) => sum + e.amount, 0)
    res.json({ entries, balance })
  } catch (e) { sendError(res, e) }
})

router.post('/cooperative/members', authenticate, requireRole('COOPERATIVE'), async (req, res) => {
  const { producerEmail } = req.body
  if (!producerEmail) return res.status(400).json({ error: 'Email du producteur requis' })
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })

    const producerUser = await prisma.user.findUnique({ where: { email: producerEmail }, include: { producer: true } })
    if (!producerUser?.producer) return res.status(404).json({ error: 'Aucun producteur trouvé avec cet email' })

    const member = await prisma.cooperativeMember.create({
      data: { cooperativeId: actor.profile.id, producerId: producerUser.producer.id },
    })
    res.status(201).json(member)
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Ce producteur est déjà membre de la coopérative' })
    sendError(res, e)
  }
})

router.delete('/cooperative/members/:producerId', authenticate, requireRole('COOPERATIVE'), async (req, res) => {
  try {
    const actor = await myActor(req)
    if (!actor) return res.status(404).json({ error: 'Profil introuvable' })
    await prisma.cooperativeMember.deleteMany({
      where: { cooperativeId: actor.profile.id, producerId: Number(req.params.producerId) },
    })
    res.json({ ok: true })
  } catch (e) { sendError(res, e) }
})

module.exports = router
