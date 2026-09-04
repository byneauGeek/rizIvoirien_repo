const router = require('express').Router()
const path = require('path')
const { authenticate } = require('../middleware/auth')
const { uploadImage } = require('../middleware/upload')

// Résout l'URL publique d'un fichier uploadé.
// Cloudinary (multer-storage-cloudinary) place déjà l'URL complète (https://res.cloudinary.com/...)
// dans `file.path` — il ne faut JAMAIS la reconstruire depuis `file.filename` (qui, sous Cloudinary,
// est un public_id et pas un chemin local), sinon l'URL renvoyée au client pointe vers rien.
// En stockage disque local (dev), `file.path` est un chemin filesystem : on reconstruit alors
// l'URL depuis BASE_URL + /uploads/<filename>.
const fileUrl = (file) => {
  if (/^https?:\/\//.test(file.path)) return file.path
  if (!process.env.BASE_URL && process.env.NODE_ENV === 'production') {
    throw new Error('BASE_URL doit être configuré en production pour servir les fichiers uploadés localement.')
  }
  const base = process.env.BASE_URL || 'http://localhost:3001'
  return `${base}/uploads/${file.filename}`
}

// POST /api/upload — upload d'image
router.post('/', authenticate, uploadImage.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier image requis' })
  try {
    res.json({ url: fileUrl(req.file), filename: req.file.filename })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/upload/multiple — upload multiple
router.post('/multiple', authenticate, uploadImage.array('files', 8), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Fichiers requis' })
  try {
    res.json({ urls: req.files.map(fileUrl) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
