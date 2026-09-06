const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')
const { authenticate } = require('../middleware/auth')
const { sendMail } = require('../services/mailer')

const genToken = () => crypto.randomBytes(32).toString('hex')

const sign = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })

const safeUser = (user) => {
  const { password, ...rest } = user
  return rest
}

const makeSlug = (name) =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now()

// ─── Acheteur ─────────────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const { email, password, name, phone } = req.body
  if (!email || !password || !name)
    return res.status(400).json({ error: 'Champs requis manquants' })
  try {
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ error: 'Email déjà utilisé' })
    const hash = await bcrypt.hash(password, 10)
    const verifyToken = genToken()
    const user = await prisma.user.create({
      data: { email, password: hash, name, phone, role: 'BUYER', emailVerifyToken: verifyToken },
    })
    setImmediate(() => sendMail(email, 'verifyEmail', { name, token: verifyToken }))
    res.status(201).json({ token: sign(user), user: safeUser(user), emailNotVerified: true })
  } catch (e) { sendError(res, e) }
})

// ─── Vendeur ──────────────────────────────────────────────────────────────────

// Étape 1 : création boutique complète (status PENDING)
router.post('/register-vendor', async (req, res) => {
  const {
    email, password, name, phone,
    shopName, businessName, rccm, shopEmail, shopPhone,
    shopDescription, shopSpeciality, shopLocation, shopAvatar, shopCover,
    minOrder, deliveryZones, openingHours,
  } = req.body

  if (!email || !password || !name || !shopName || !shopPhone)
    return res.status(400).json({ error: 'Champs obligatoires manquants' })

  try {
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ error: 'Email déjà utilisé' })

    const hash = await bcrypt.hash(password, 10)
    const slug = makeSlug(shopName)

    const user = await prisma.user.create({
      data: {
        email, password: hash, name, phone, role: 'SELLER',
        shop: {
          create: {
            name: shopName,
            slug,
            businessName: businessName || null,
            rccm: rccm || null,
            email: shopEmail || null,
            phone: shopPhone,
            description: shopDescription || null,
            speciality: shopSpeciality || null,
            location: shopLocation || null,
            coverImage: shopCover || null,
            avatar: shopAvatar || null,
            minOrder: minOrder ? Number(minOrder) : 0,
            deliveryZones: deliveryZones || null,
            openingHours: openingHours || null,
            since: String(new Date().getFullYear()),
            status: 'PENDING',
            active: false,
          },
        },
      },
      include: { shop: true },
    })
    const verifyToken = genToken()
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifyToken: verifyToken } })
    setImmediate(() => sendMail(email, 'verifyEmail', { name, token: verifyToken }))
    res.status(201).json({ token: sign(user), user: safeUser(user), emailNotVerified: true })
  } catch (e) { sendError(res, e) }
})

// ─── Livreur ──────────────────────────────────────────────────────────────────

// Étape 1 : valider le code d'invitation (avant de remplir le formulaire)
router.post('/check-invite', async (req, res) => {
  const { inviteCode } = req.body
  if (!inviteCode) return res.status(400).json({ error: 'Code requis' })
  try {
    const code = await prisma.inviteCode.findUnique({ where: { code: inviteCode.trim().toUpperCase() } })
    if (!code) return res.status(404).json({ error: 'Code d\'invitation invalide' })
    if (code.used) return res.status(400).json({ error: 'Code déjà utilisé' })
    res.json({ valid: true, code: code.code })
  } catch (e) { sendError(res, e) }
})

// Étape 2 : inscription complète
router.post('/register-driver', async (req, res) => {
  const {
    email, password, name, phone, inviteCode,
    idNumber, idPhoto,
    licenseNumber, licenseExpiry, licensePhoto,
    vehicleType, vehiclePlate, vehiclePhoto,
    avatar,
  } = req.body

  if (!email || !password || !name || !phone || !inviteCode ||
      !idNumber || !licenseNumber || !vehicleType || !vehiclePlate)
    return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' })

  try {
    const code = await prisma.inviteCode.findUnique({ where: { code: inviteCode.trim().toUpperCase() } })
    if (!code || code.used)
      return res.status(400).json({ error: 'Code d\'invitation invalide ou déjà utilisé' })

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ error: 'Email déjà utilisé' })

    const hash = await bcrypt.hash(password, 10)
    const driverCode = `DRV-${Math.random().toString(36).toUpperCase().slice(2, 8)}`

    const user = await prisma.user.create({
      data: {
        email, password: hash, name, phone, role: 'DRIVER',
        driver: {
          create: {
            inviteCode: driverCode,
            status: 'PENDING',
            avatar: avatar || null,
            idNumber, idPhoto: idPhoto || null,
            licenseNumber,
            licenseExpiry: licenseExpiry || null,
            licensePhoto: licensePhoto || null,
            vehicleType, vehiclePlate,
            vehiclePhoto: vehiclePhoto || null,
          },
        },
      },
      include: { driver: true },
    })

    await prisma.inviteCode.update({
      where: { code: inviteCode.trim().toUpperCase() },
      data: { used: true, usedById: user.id },
    })

    const verifyToken = genToken()
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifyToken: verifyToken } })
    setImmediate(() => sendMail(email, 'verifyEmail', { name, token: verifyToken }))
    res.status(201).json({ token: sign(user), user: safeUser(user), emailNotVerified: true })
  } catch (e) { sendError(res, e) }
})

// ─── Commercial ───────────────────────────────────────────────────────────────

router.post('/register-commercial', async (req, res) => {
  const { email, password, name, phone, inviteCode } = req.body
  if (!email || !password || !name || !inviteCode)
    return res.status(400).json({ error: 'Champs requis manquants' })
  try {
    const code = await prisma.inviteCode.findUnique({ where: { code: inviteCode.trim().toUpperCase() } })
    if (!code || code.used) return res.status(400).json({ error: 'Code d\'invitation invalide ou déjà utilisé' })

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ error: 'Email déjà utilisé' })

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hash, name, phone, role: 'COMMERCIAL' },
    })
    await prisma.inviteCode.update({
      where: { code: inviteCode.trim().toUpperCase() },
      data: { used: true, usedById: user.id },
    })
    res.status(201).json({ token: sign(user), user: safeUser(user) })
  } catch (e) { sendError(res, e) }
})

// ─── B2B (filière riz) ──────────────────────────────────────────────────────
// Un seul endpoint pour les 5 profils B2B : la forme (User + profil lié 1:1) est
// identique, seuls les champs métier et le modèle Prisma ciblé changent.

const B2B_PROFILES = {
  PRODUCER: {
    role: 'PRODUCER',
    required: ['region'],
    fields: ['region', 'department', 'commune', 'locality', 'farmType', 'surfaceHa', 'capacityKg', 'photo', 'description'],
    numeric: ['surfaceHa', 'capacityKg'],
    relation: 'producer',
  },
  COOPERATIVE: {
    role: 'COOPERATIVE',
    required: ['name', 'responsable', 'region'],
    fields: ['name', 'responsable', 'region', 'zone', 'description'],
    numeric: [],
    relation: 'cooperative',
  },
  TRADER: {
    role: 'TRADER',
    required: ['companyName'],
    fields: ['companyName', 'activity', 'zones'],
    numeric: [],
    relation: 'trader',
  },
  PROCESSOR: {
    role: 'PROCESSOR',
    required: ['companyName'],
    fields: ['companyName', 'zones'],
    numeric: [],
    relation: 'processor',
  },
  EXPORTER: {
    role: 'EXPORTER',
    required: ['companyName'],
    fields: ['companyName', 'capacityKg', 'zones'],
    numeric: ['capacityKg'],
    relation: 'exporter',
  },
}

router.post('/register-b2b', async (req, res) => {
  const { profileType, email, password, name, phone, profile } = req.body
  const spec = B2B_PROFILES[profileType]
  if (!spec) return res.status(400).json({ error: 'Type de profil B2B invalide' })
  if (!email || !password || !name) return res.status(400).json({ error: 'Champs requis manquants' })

  const missing = spec.required.filter((f) => !profile?.[f])
  if (missing.length) return res.status(400).json({ error: `Champs requis manquants : ${missing.join(', ')}` })

  try {
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ error: 'Email déjà utilisé' })

    const profileData = {}
    for (const field of spec.fields) {
      if (profile?.[field] === undefined || profile[field] === '') continue
      profileData[field] = spec.numeric.includes(field) ? Number(profile[field]) : profile[field]
    }

    const hash = await bcrypt.hash(password, 10)
    const verifyToken = genToken()
    const user = await prisma.user.create({
      data: {
        email, password: hash, name, phone, role: spec.role,
        emailVerifyToken: verifyToken,
        [spec.relation]: { create: profileData },
      },
      include: { [spec.relation]: true },
    })
    setImmediate(() => sendMail(email, 'verifyEmail', { name, token: verifyToken }))
    res.status(201).json({ token: sign(user), user: safeUser(user), emailNotVerified: true })
  } catch (e) { sendError(res, e) }
})

// POST /api/auth/capabilities — LOT 2 (Arbitrage XXX RIZ) : active une
// capacité secondaire (ex. TRADER) sur un compte DÉJÀ existant, sans changer
// son rôle principal ni créer un nouveau compte — à la différence de
// /register-b2b (nouveau compte uniquement, rejette un email déjà utilisé).
// Réutilise exactement B2B_PROFILES : même validation, mêmes champs, pas de
// logique dupliquée. Idempotent : réactiver une capacité déjà accordée ne
// recrée rien, renvoie simplement l'état actuel.
router.post('/capabilities', authenticate, async (req, res) => {
  const { profileType, profile } = req.body
  const spec = B2B_PROFILES[profileType]
  if (!spec) return res.status(400).json({ error: 'Type de capacité invalide' })
  if (req.user.role === spec.role) {
    return res.status(400).json({ error: 'Ce compte a déjà ce rôle comme rôle principal' })
  }

  const missing = spec.required.filter((f) => !profile?.[f])
  if (missing.length) return res.status(400).json({ error: `Champs requis manquants : ${missing.join(', ')}` })

  try {
    const existingProfile = await prisma[spec.relation].findUnique({ where: { userId: req.user.id } })
    if (existingProfile) {
      await prisma.userCapability.upsert({
        where: { userId_role: { userId: req.user.id, role: spec.role } },
        update: {}, create: { userId: req.user.id, role: spec.role },
      })
      return res.json({ profile: existingProfile, capabilities: [...new Set([...(req.user.capabilities || []), spec.role])] })
    }

    const profileData = {}
    for (const field of spec.fields) {
      if (profile?.[field] === undefined || profile[field] === '') continue
      profileData[field] = spec.numeric.includes(field) ? Number(profile[field]) : profile[field]
    }

    const [createdProfile] = await prisma.$transaction([
      prisma[spec.relation].create({ data: { userId: req.user.id, ...profileData } }),
      prisma.userCapability.create({ data: { userId: req.user.id, role: spec.role } }),
    ])

    res.status(201).json({ profile: createdProfile, capabilities: [...new Set([...(req.user.capabilities || []), spec.role])] })
  } catch (e) { sendError(res, e) }
})

// ─── Login ────────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' })
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { shop: true, driver: true },
    })
    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' })
    if (user.banned) return res.status(403).json({ error: 'Compte suspendu. Contactez le support.' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' })

    // Avertir si compte en attente de validation
    if (user.role === 'DRIVER' && user.driver?.status === 'PENDING') {
      return res.json({ token: sign(user), user: safeUser(user), pendingValidation: true })
    }
    if (user.role === 'SELLER' && user.shop?.status === 'PENDING') {
      return res.json({ token: sign(user), user: safeUser(user), pendingValidation: true })
    }

    res.json({
      token: sign(user),
      user: safeUser(user),
      ...(user.emailVerified === false && { emailNotVerified: true }),
    })
  } catch (e) { sendError(res, e) }
})

// ─── Vérification email ───────────────────────────────────────────────────────

router.get('/verify-email', async (req, res) => {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'Token manquant' })
  try {
    const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } })
    if (!user) return res.status(400).json({ error: 'Lien invalide ou expiré' })
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null },
    })
    res.json({ success: true, message: 'Email vérifié avec succès' })
  } catch (e) { sendError(res, e) }
})

router.post('/resend-verification', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (user.emailVerified) return res.json({ success: true })
    const verifyToken = genToken()
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifyToken: verifyToken } })
    setImmediate(() => sendMail(user.email, 'verifyEmail', { name: user.name, token: verifyToken }))
    res.json({ success: true })
  } catch (e) { sendError(res, e) }
})

// ─── Mot de passe oublié ──────────────────────────────────────────────────────

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email requis' })
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    // Réponse identique que l'email existe ou non (sécurité anti-énumération)
    if (user) {
      const token = genToken()
      const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1h
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpiry: expiry },
      })
      setImmediate(() => sendMail(email, 'resetPassword', { name: user.name, token }))
    }
    res.json({ success: true })
  } catch (e) { sendError(res, e) }
})

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Champs requis' })
  if (password.length < 6) return res.status(400).json({ error: 'Minimum 6 caractères' })
  try {
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    })
    if (!user) return res.status(400).json({ error: 'Lien invalide ou expiré' })
    const hash = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash, resetToken: null, resetTokenExpiry: null },
    })
    res.json({ success: true })
  } catch (e) { sendError(res, e) }
})

// ─── Profil ───────────────────────────────────────────────────────────────────

router.put('/profile', authenticate, async (req, res) => {
  const { name, phone } = req.body
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { ...(name && { name }), ...(phone !== undefined && { phone }) },
      include: { shop: true, driver: true },
    })
    res.json(safeUser(user))
  } catch (e) { sendError(res, e) }
})

router.put('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' })
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères' })
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return res.status(400).json({ error: 'Mot de passe actuel incorrect' })
    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hash } })
    res.json({ success: true })
  } catch (e) { sendError(res, e) }
})

router.put('/change-email', authenticate, async (req, res) => {
  const { newEmail, password } = req.body
  if (!newEmail || !password) return res.status(400).json({ error: 'Champs requis' })
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).json({ error: 'Mot de passe incorrect' })
    const exists = await prisma.user.findUnique({ where: { email: newEmail } })
    if (exists) return res.status(409).json({ error: 'Email déjà utilisé' })
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { email: newEmail },
      include: { shop: true, driver: true },
    })
    res.json({ token: sign(updated), user: safeUser(updated) })
  } catch (e) { sendError(res, e) }
})

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        shop: { include: { subscription: true } },
        driver: true,
        producer: true,
        cooperative: true,
        trader: true,
        processor: true,
        exporter: true,
      },
    })
    res.json(safeUser(user))
  } catch (e) { sendError(res, e) }
})

module.exports = router
