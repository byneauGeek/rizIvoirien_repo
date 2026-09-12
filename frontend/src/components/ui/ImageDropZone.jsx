/**
 * ImageDropZone — Zone de dépôt d'image avec aperçu
 *
 * Props :
 *   url          {string}   URL actuelle de l'image (pour prévisualisation)
 *   onUpload     {fn}       Callback appelée avec la nouvelle URL après upload
 *   label        {string}   Texte affiché dans la zone vide
 *   hint         {string}   Sous-texte (type de fichier, dimensions…)
 *   shape        {string}   'round' | 'rect' (défaut 'rect')
 *   aspect       {string}   Classe h-* Tailwind pour la hauteur (défaut 'h-36')
 *   accent       {string}   Couleur de highlight ('forest' | 'safran')
 *   authRequired {bool}     false pour les formulaires d'inscription (pas de
 *                           token encore) — utilise l'endpoint public. Défaut true.
 */

import { useState, useRef, useCallback } from 'react'
import { Upload, X, ImagePlus } from 'lucide-react'
import { uploadImages, uploadImagesPublic } from '../../api/client'
import { motion, AnimatePresence } from 'framer-motion'

export default function ImageDropZone({
  url       = '',
  onUpload,
  label     = 'Déposer une image',
  hint      = 'JPG, PNG, WEBP · max 5 Mo',
  shape     = 'rect',
  aspect    = 'h-36',
  accent    = 'forest',
  authRequired = true,
}) {
  const [dragging, setDragging]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const inputRef = useRef()

  const accentClasses = {
    forest: { border: 'border-forest/50',   bg: 'bg-forest/5',   text: 'text-forest',   ring: 'ring-forest/20' },
    safran: { border: 'border-safran/50',   bg: 'bg-safran/5',   text: 'text-safran',   ring: 'ring-safran/20' },
  }[accent] || { border: 'border-forest/50', bg: 'bg-forest/5', text: 'text-forest', ring: 'ring-forest/20' }

  const doUpload = useCallback(async (files) => {
    const file = files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Fichier non supporté'); return }
    if (file.size > 5 * 1024 * 1024)   { setError('Fichier trop lourd (max 5 Mo)'); return }

    setError(''); setUploading(true)
    try {
      const urls = await (authRequired ? uploadImages([file]) : uploadImagesPublic([file]))
      onUpload(urls[0])
    } catch (e) {
      setError(e.message || 'Erreur upload')
    } finally {
      setUploading(false)
    }
  }, [onUpload, authRequired])

  // ── Drag events ───────────────────────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const onDrop      = (e) => {
    e.preventDefault(); setDragging(false)
    doUpload(Array.from(e.dataTransfer.files))
  }

  const rounded = shape === 'round' ? 'rounded-full' : 'rounded-2xl'

  return (
    <div className="relative">
      {/* Zone principale */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          relative ${aspect} ${rounded} border-2 cursor-pointer overflow-hidden transition-all duration-200
          ${url
            ? 'border-transparent'
            : dragging
              ? `border-dashed ${accentClasses.border} ${accentClasses.bg} ring-4 ${accentClasses.ring}`
              : 'border-dashed border-charcoal/20 hover:border-charcoal/40 hover:bg-charcoal/2'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => doUpload(Array.from(e.target.files))}
        />

        {/* Aperçu image */}
        {url && !uploading && (
          <>
            <img src={url} alt="" className={`w-full h-full object-cover ${rounded}`} />
            {/* Overlay hover */}
            <div className={`absolute inset-0 ${rounded} bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100`}>
              <div className="flex flex-col items-center gap-1 text-white">
                <Upload size={20} />
                <span className="font-syne text-xs font-bold">Changer</span>
              </div>
            </div>
          </>
        )}

        {/* État upload en cours */}
        {uploading && (
          <div className={`absolute inset-0 ${rounded} bg-white/80 flex flex-col items-center justify-center gap-2`}>
            <div className="w-6 h-6 border-2 border-charcoal/20 border-t-forest rounded-full animate-spin" />
            <span className="font-dm text-xs text-charcoal/50">Téléversement…</span>
          </div>
        )}

        {/* Zone vide */}
        {!url && !uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <AnimatePresence mode="wait">
              {dragging ? (
                <motion.div key="drag"
                  initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-2xl ${accentClasses.bg} ${accentClasses.border} border-2 flex items-center justify-center`}>
                    <ImagePlus size={22} className={accentClasses.text} />
                  </div>
                  <span className={`font-syne text-sm font-bold ${accentClasses.text}`}>Relâchez ici</span>
                </motion.div>
              ) : (
                <motion.div key="idle"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-xl bg-charcoal/6 flex items-center justify-center">
                    <Upload size={18} className="text-charcoal/40" />
                  </div>
                  <div>
                    <p className="font-syne text-xs font-bold text-charcoal/60">{label}</p>
                    <p className="font-dm text-[10px] text-charcoal/35 mt-0.5">{hint}</p>
                    <p className="font-dm text-[10px] text-charcoal/30 mt-0.5">ou cliquez pour parcourir</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Bouton supprimer */}
      {url && !uploading && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onUpload('') }}
          className={`absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors z-10`}
        >
          <X size={12} />
        </button>
      )}

      {/* Erreur */}
      {error && (
        <p className="mt-1.5 font-dm text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
