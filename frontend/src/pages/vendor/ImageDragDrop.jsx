/**
 * ImageDragDrop
 * Zone de dépôt + thumbnails réordonnables par drag-and-drop.
 *
 * Props :
 *   images   {string[]}  URLs actuelles
 *   onChange {fn}        Callback avec le nouveau tableau d'URLs
 */
import { useRef, useState, useCallback } from 'react'
import { uploadImages } from '../../api/client'
import { ImagePlus, X, GripVertical, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ImageDragDrop({ images = [], onChange }) {
  const inputRef   = useRef()
  const dragIdx    = useRef(null)   // index du thumbnail en cours de drag
  const [over, setOver]       = useState(false)   // survol de la zone principale
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [error, setError]         = useState('')

  /* ── Upload ── */
  const doUpload = useCallback(async (files) => {
    if (!files.length) return
    setUploading(true); setProgress(0); setError('')
    // Simuler une progression visuelle
    const tick = setInterval(() => setProgress(p => Math.min(p + 15, 85)), 120)
    try {
      const urls = await uploadImages(Array.from(files))
      clearInterval(tick); setProgress(100)
      onChange([...images, ...urls])
      setTimeout(() => setProgress(0), 400)
    } catch (e) {
      clearInterval(tick)
      setError(e.message || 'Erreur upload')
    } finally {
      setUploading(false)
    }
  }, [images, onChange])

  /* ── Drop sur la zone principale ── */
  const onDrop = (e) => {
    e.preventDefault(); setOver(false)
    const all   = Array.from(e.dataTransfer.files)
    const imgs  = all.filter(f => f.type.startsWith('image/'))
    const other = all.filter(f => !f.type.startsWith('image/'))
    if (other.length) {
      setError(`Fichier${other.length > 1 ? 's' : ''} ignoré${other.length > 1 ? 's' : ''} : ${other.map(f => f.name).join(', ')} — seules les images sont acceptées.`)
      setTimeout(() => setError(''), 4000)
    }
    if (imgs.length) doUpload(imgs)
  }

  /* ── Réordonnement par drag entre thumbnails ── */
  const onThumbDragStart = (e, idx) => {
    dragIdx.current = idx
    e.dataTransfer.effectAllowed = 'move'
    // Image fantôme transparente
    const ghost = document.createElement('div')
    ghost.style.opacity = '0'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }
  const onThumbDragOver  = (e, idx) => {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) return
    const next = [...images]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(idx, 0, moved)
    dragIdx.current = idx
    onChange(next)
  }
  const onThumbDragEnd = () => { dragIdx.current = null }

  const remove = (idx) => onChange(images.filter((_, i) => i !== idx))

  return (
    <div className="space-y-3">
      {/* Zone de dépôt principale */}
      <div
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer transition-all
          ${over
            ? 'border-[#E8A217] bg-[#E8A217]/8 scale-[1.01]'
            : 'border-charcoal/15 bg-charcoal/2 hover:border-[#E8A217]/50 hover:bg-[#E8A217]/4'
          }
          ${uploading ? 'pointer-events-none opacity-70' : ''}
        `}
        style={{ minHeight: 110 }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 size={22} className="text-[#E8A217] animate-spin" />
            <p className="font-syne text-xs font-bold text-[#E8A217]">Upload en cours…</p>
            {/* Barre de progression */}
            <div className="w-32 h-1 bg-charcoal/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#E8A217] rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-6 select-none">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${over ? 'bg-[#E8A217]/20' : 'bg-charcoal/6'}`}>
              <ImagePlus size={18} className={over ? 'text-[#E8A217]' : 'text-charcoal/30'} />
            </div>
            <p className="font-syne text-sm font-bold text-charcoal/50">
              {over ? 'Relâchez pour ajouter' : 'Glissez des photos ici'}
            </p>
            <p className="font-dm text-xs text-charcoal/30">ou cliquez · JPG, PNG, WEBP</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => { doUpload(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* Erreur */}
      {error && (
        <p className="font-dm text-xs text-red-500 flex items-center gap-1">
          <X size={11} /> {error}
        </p>
      )}

      {/* Thumbnails réordonnables */}
      <AnimatePresence>
        {images.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2"
          >
            {images.map((url, idx) => (
              <motion.div
                key={url + idx}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.18 }}
                draggable
                onDragStart={e => onThumbDragStart(e, idx)}
                onDragOver={e => onThumbDragOver(e, idx)}
                onDragEnd={onThumbDragEnd}
                className="relative group cursor-grab active:cursor-grabbing"
              >
                {/* Thumbnail */}
                <div className={`relative rounded-xl overflow-hidden border-2 transition-colors
                  ${idx === 0 ? 'border-[#E8A217]' : 'border-transparent group-hover:border-charcoal/20'}`}
                  style={{ width: 72, height: 72 }}>
                  <img src={url} alt="" className="w-full h-full object-cover" />

                  {/* Overlay au survol */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />

                  {/* Grip handle */}
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical size={12} className="text-white drop-shadow" />
                  </div>

                  {/* Bouton supprimer */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); remove(idx) }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>

                {/* Badge couverture */}
                {idx === 0 && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#E8A217] text-white font-syne text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">
                    Couverture
                  </span>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {images.length > 0 && (
        <p className="font-dm text-[11px] text-charcoal/30">
          Glissez les vignettes pour réordonner · La première image sera la couverture
        </p>
      )}
    </div>
  )
}
