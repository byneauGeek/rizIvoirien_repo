const router = require('express').Router()
const { sendError } = require('../lib/sendError')
const { authenticate } = require('../middleware/auth')
const { uploadImage, fileUrl } = require('../middleware/upload')

// POST /api/upload — upload d'image
router.post('/', authenticate, uploadImage.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier image requis' })
  try {
    res.json({ url: fileUrl(req.file), filename: req.file.filename })
  } catch (e) {
    sendError(res, e)
  }
})

// POST /api/upload/multiple — upload multiple
router.post('/multiple', authenticate, uploadImage.array('files', 8), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Fichiers requis' })
  try {
    res.json({ urls: req.files.map(fileUrl) })
  } catch (e) {
    sendError(res, e)
  }
})

module.exports = router
