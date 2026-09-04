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

// ── Stockage : Cloudinary en prod, disque local en dev ────────────────────────
let storage

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
} else {
  // DÉVELOPPEMENT — stockage disque local
  const uploadDir = path.join(__dirname, '../../uploads')
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname)
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
    },
  })
}

const uploadImage = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } })
const uploadCsv = multer({ storage: multer.memoryStorage(), fileFilter: csvFilter, limits: { fileSize: 2 * 1024 * 1024 } })

module.exports = { uploadImage, uploadCsv }
