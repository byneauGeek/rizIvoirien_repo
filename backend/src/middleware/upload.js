const multer = require('multer')
const path = require('path')
const fs = require('fs')

// ── Filtre type de fichier ────────────────────────────────────────────────────
const imageFilter = (req, file, cb) => {
  const allowedExt  = /jpeg|jpg|png|webp/
  const allowedMime = /^image\/(jpeg|png|webp)$/
  if (allowedExt.test(path.extname(file.originalname).toLowerCase()) && allowedMime.test(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Seuls les formats JPEG, PNG et WebP sont acceptés'))
  }
}

const csvFilter = (req, file, cb) => {
  if (path.extname(file.originalname).toLowerCase() === '.csv') {
    cb(null, true)
  } else {
    cb(new Error('Format CSV requis'))
  }
}

// Pièces comptables (LOT 6) — factures/reçus/contrats sont le plus souvent
// des PDF, contrairement aux visuels produits (images seules).
const documentFilter = (req, file, cb) => {
  const allowedExt  = /jpeg|jpg|png|webp|pdf/
  const allowedMime = /^(image\/(jpeg|png|webp)|application\/pdf)$/
  if (allowedExt.test(path.extname(file.originalname).toLowerCase()) && allowedMime.test(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Seuls les formats JPEG, PNG, WebP et PDF sont acceptés'))
  }
}

// ── Stockage : Cloudinary en prod, disque local en dev ────────────────────────
let storage, documentStorage

if (process.env.CLOUDINARY_CLOUD_NAME) {
  // PRODUCTION — Cloudinary
  // npm install cloudinary multer-storage-cloudinary
  const cloudinary = require('cloudinary').v2
  const { CloudinaryStorage } = require('multer-storage-cloudinary')

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'rizivoirien',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }],
    },
  })

  // resource_type 'auto' est requis par Cloudinary pour accepter un PDF (le
  // type 'image' par défaut le rejette) ; pas de transformation ici (on ne
  // recompresse pas une pièce justificative).
  documentStorage = new CloudinaryStorage({
    cloudinary,
    params: { folder: 'rizivoirien/accounting-documents', resource_type: 'auto' },
  })
} else {
  // DÉVELOPPEMENT — stockage disque local
  const uploadDir = path.join(__dirname, '../../uploads')
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

  const localDisk = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname)
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
    },
  })
  storage = localDisk
  documentStorage = localDisk
}

// Résout l'URL publique d'un fichier uploadé par un des multer ci-dessous.
// Cloudinary place déjà l'URL complète dans `file.path` — ne jamais la
// reconstruire depuis `file.filename` (un public_id, pas un chemin local).
const fileUrl = (file) => {
  if (/^https?:\/\//.test(file.path)) return file.path
  if (!process.env.BASE_URL && process.env.NODE_ENV === 'production') {
    throw new Error('BASE_URL doit être configuré en production pour servir les fichiers uploadés localement.')
  }
  const base = process.env.BASE_URL || 'http://localhost:3001'
  return `${base}/uploads/${file.filename}`
}

const uploadImage = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } })
const uploadCsv = multer({ storage: multer.memoryStorage(), fileFilter: csvFilter, limits: { fileSize: 2 * 1024 * 1024 } })
const uploadDocument = multer({ storage: documentStorage, fileFilter: documentFilter, limits: { fileSize: 10 * 1024 * 1024 } })

module.exports = { uploadImage, uploadCsv, uploadDocument, fileUrl }
