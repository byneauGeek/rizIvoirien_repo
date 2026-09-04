const router = require('express').Router()
const path = require('path')
const { authenticate } = require('../middleware/auth')
const { uploadImage } = require('../middleware/upload')

// POST /api/upload — upload d'image
router.post('/', authenticate, uploadImage.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier image requis' })
  const url = `${process.env.BASE_URL || 'http://localhost:3001'}/uploads/${req.file.filename}`
  res.json({ url, filename: req.file.filename })
})

// POST /api/upload/multiple — upload multiple
router.post('/multiple', authenticate, uploadImage.array('files', 8), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Fichiers requis' })
  const base = process.env.BASE_URL || 'http://localhost:3001'
  const urls = req.files.map(f => `${base}/uploads/${f.filename}`)
  res.json({ urls })
})

module.exports = router
