import { useEffect, useState, useRef, useMemo } from 'react'
import {
  Plus, Upload, Edit2, Trash2, X, Check, ImagePlus,
  Search, ArrowLeft, Sparkles, GripVertical, Package, AlertCircle,
} from 'lucide-react'
import { api, uploadCsv, uploadImages } from '../../api/client'
import { fmt } from '../../utils/status'
import { parseImages } from '../../utils/images'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Constantes ───────────────────────────────────────────────────────────────
const EMPTY = {
  name: '', category: 'Riz Parfumé', price: '', unit: '5kg',
  stock: '', description: '', badge: '', origin: '', harvest: '', saleType: 'BOTH',
}

const SALE_TYPES = [
  {
    value: 'RETAIL',
    label: 'Vente au détail',
    sub: 'Particuliers, petites quantités',
    icon: '🛒',
    color: 'border-blue-400 bg-blue-50 text-blue-800',
    activeColor: 'border-blue-500 bg-blue-500 text-white',
  },
  {
    value: 'WHOLESALE',
    label: 'Vente en gros',
    sub: 'Revendeurs, restaurateurs, grossistes',
    icon: '📦',
    color: 'border-amber-400 bg-amber-50 text-amber-800',
    activeColor: 'border-amber-500 bg-amber-500 text-white',
  },
  {
    value: 'BOTH',
    label: 'Gros & Détail',
    sub: 'Ouvert à tous les acheteurs',
    icon: '✅',
    color: 'border-forest/30 bg-forest/5 text-forest',
    activeColor: 'border-forest bg-forest text-white',
  },
]
const CATEGORIES = [
  'Riz Parfumé', 'Riz Étuvé', 'Riz Blanc',
  'Riz Complet', 'Riz Brisé', 'Riz Spécial',
]
const UNITS = ['1kg', '2kg', '5kg', '10kg', '25kg', '50kg']

// ─── Moteur de génération local ───────────────────────────────────────────────
function generateSuggestion({ category, origin, unit, price, harvest }) {
  const cat = category || 'Riz'
  const hasOrigin  = origin  && origin.trim()
  const hasHarvest = harvest && harvest.trim()
  const hasUnit    = unit    && unit.trim()
  const hasPrice   = price   && Number(price) > 0

  /* ── Titre ── */
  const titleParts = [cat]
  if (hasOrigin) titleParts.push(`de ${origin.trim()}`)
  if (hasUnit)   titleParts.push(`— Sac ${unit}`)
  const suggestedName = titleParts.join(' ')

  /* ── Description ── */
  const sentences = []

  // Phrase d'accroche
  if (hasOrigin) {
    sentences.push(
      `Découvrez notre ${cat.toLowerCase()} authentique, soigneusement cultivé dans les rizières de ${origin.trim()} et sélectionné pour sa qualité exceptionnelle.`
    )
  } else {
    sentences.push(
      `Découvrez notre ${cat.toLowerCase()} de qualité supérieure, sélectionné avec soin pour vous garantir un grain parfait à chaque cuisson.`
    )
  }

  // Récolte
  if (hasHarvest) {
    sentences.push(
      `Issu de la récolte ${harvest.trim()}, ce riz bénéficie d'une fraîcheur optimale qui préserve toutes ses qualités nutritionnelles et gustatives.`
    )
  }

  // Caractéristique propre à la catégorie
  const catDesc = {
    'Riz Parfumé': `Son arôme délicat et sa texture fondante en font le compagnon idéal de vos plats de fête comme du quotidien.`,
    'Riz Étuvé':   `Le procédé d'étuvage lui confère une excellente tenue à la cuisson, des grains bien séparés et une valeur nutritive préservée.`,
    'Riz Blanc':   `Sa blancheur immaculée, sa légèreté et sa polyvalence en cuisine en font un incontournable de la table ivoirienne.`,
    'Riz Complet': `Riche en fibres et en nutriments essentiels, il est le choix idéal pour une alimentation saine et équilibrée.`,
    'Riz Brisé':   `Idéal pour la préparation du garba, des bouillies et des recettes traditionnelles ivoiriennes.`,
    'Riz Spécial': `Une sélection premium pour les amateurs de riz d'exception, alliant qualité supérieure et goût raffiné.`,
  }
  if (catDesc[cat]) sentences.push(catDesc[cat])

  // Conditionnement
  if (hasUnit) {
    sentences.push(
      `Conditionné en sac de ${unit}, il répond aussi bien aux besoins des familles qu'aux commandes des restaurateurs et grossistes.`
    )
  }

  // Prix
  if (hasPrice) {
    sentences.push(
      `Disponible au prix de ${Number(price).toLocaleString('fr-FR')} FCFA le sac de ${unit || ''}.`.replace('  ', ' ')
    )
  }

  // Call to action
  sentences.push(
    `Livraison rapide à Abidjan et dans toute la Côte d'Ivoire — commandez dès maintenant et profitez de la fraîcheur garantie.`
  )

  return { name: suggestedName, description: sentences.join(' ') }
}

// ─── Composant label section ──────────────────────────────────────────────────
function SLabel({ children }) {
  return (
    <p className="font-syne text-[10px] font-bold tracking-widest uppercase text-charcoal/40 mb-3">
      {children}
    </p>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50">
          {label}
        </label>
        {hint && <span className="font-dm text-[10px] text-charcoal/30">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const INPUT = 'w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm text-charcoal focus:outline-none focus:border-forest/50 transition-colors bg-white'

// ─── Vue formulaire ───────────────────────────────────────────────────────────
function ProductForm({ initial, initialImages, isNew, onSave, onCancel }) {
  const [form, setForm]             = useState(initial)
  const [formImages, setFormImages] = useState(initialImages)
  const [imgUploading, setImgUploading] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [generating, setGenerating] = useState(false)
  const [flashName, setFlashName]   = useState(false)
  const [flashDesc, setFlashDesc]   = useState(false)
  const [imgError, setImgError]     = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const imgRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleImgUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setImgUploading(true)
    setImgError(null)
    try {
      const urls = await uploadImages(files)
      setFormImages(prev => [...prev, ...urls].slice(0, 8))
    } catch (err) { setImgError(err.message || 'Erreur lors du téléversement') }
    finally { setImgUploading(false); e.target.value = '' }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    // Petite pause pour l'effet visuel
    await new Promise(r => setTimeout(r, 700))
    const { name, description } = generateSuggestion(form)
    setForm(f => ({ ...f, name, description }))
    setGenerating(false)
    // Flash vert temporaire sur les champs remplis
    setFlashName(true); setFlashDesc(true)
    setTimeout(() => setFlashName(false), 1800)
    setTimeout(() => setFlashDesc(false), 1800)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSubmitError(null)
    try {
      await onSave({
        ...form,
        price:  Number(form.price),
        stock:  Number(form.stock),
        images: JSON.stringify(formImages),
      })
    } catch (err) { setSubmitError(err.message || 'Erreur lors de la sauvegarde') }
    finally { setSaving(false) }
  }

  const canGenerate = form.category || form.origin || form.unit || form.price || form.harvest

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22 }}
    >
      <form onSubmit={handleSubmit}>
        {/* ── En-tête ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="w-10 h-10 rounded-2xl bg-charcoal/6 flex items-center justify-center text-charcoal/50 hover:bg-charcoal/12 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">
                {isNew ? 'Nouveau produit' : 'Modifier le produit'}
              </p>
              <h1 className="font-playfair text-3xl font-bold text-charcoal leading-tight">
                {isNew ? 'Ajouter un produit' : (form.name || 'Modifier')}
              </h1>
            </div>
          </div>

          {/* Bouton génération IA */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-syne font-bold text-sm transition-all
              ${generating
                ? 'bg-amber-50 border-2 border-amber-200 text-amber-600 cursor-wait'
                : canGenerate
                  ? 'bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white shadow-lg shadow-forest/20 hover:shadow-xl hover:shadow-forest/30 hover:-translate-y-0.5'
                  : 'bg-charcoal/6 text-charcoal/30 cursor-not-allowed border-2 border-transparent'
              }`}
          >
            {generating
              ? <div className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-500 rounded-full animate-spin" />
              : <Sparkles size={16} className={canGenerate ? 'text-amber-300' : 'text-charcoal/30'} />
            }
            {generating ? 'Génération en cours…' : 'Générer titre & description'}
          </button>
        </div>

        {/* ── Grille principale ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ════ Colonne gauche (2/3) ════ */}
          <div className="lg:col-span-2 space-y-5">

            {/* Card : Informations principales */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 space-y-5">
              <SLabel>Informations principales</SLabel>

              {/* Nom du produit */}
              <Field label="Nom du produit" hint="Titre affiché aux acheteurs">
                <div className="relative">
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    required
                    placeholder="Ex : Riz Parfumé de Gagnoa — Sac 25kg"
                    className={`${INPUT} pr-4 transition-all duration-500 ${flashName ? 'border-forest/50 bg-forest/3 ring-2 ring-forest/10' : ''}`}
                  />
                  {flashName && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-forest"
                    >
                      <Sparkles size={15} />
                    </motion.span>
                  )}
                </div>
              </Field>

              {/* Catégorie */}
              <Field label="Catégorie">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c} type="button"
                      onClick={() => set('category', c)}
                      className={`font-syne text-xs font-bold px-3.5 py-2 rounded-xl border-2 transition-all ${
                        form.category === c
                          ? 'bg-forest border-forest text-white'
                          : 'border-charcoal/12 text-charcoal/60 hover:border-forest/30 hover:text-forest'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Prix + Unité */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Prix (FCFA)" hint="Par unité">
                  <input
                    type="number" min="0" value={form.price}
                    onChange={e => set('price', e.target.value)}
                    required placeholder="0"
                    className={INPUT}
                  />
                </Field>
                <Field label="Unité / conditionnement">
                  <div className="flex flex-wrap gap-2">
                    {UNITS.map(u => (
                      <button
                        key={u} type="button"
                        onClick={() => set('unit', u)}
                        className={`font-syne text-xs font-bold px-3 py-2 rounded-xl border-2 transition-all ${
                          form.unit === u
                            ? 'bg-[#E8A217] border-[#E8A217] text-white'
                            : 'border-charcoal/12 text-charcoal/60 hover:border-[#E8A217]/40 hover:text-[#E8A217]'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* Stock */}
              <Field label="Stock disponible" hint="Nombre de sacs">
                <input
                  type="number" min="0" value={form.stock}
                  onChange={e => set('stock', e.target.value)}
                  required placeholder="0"
                  className={`${INPUT} max-w-[180px]`}
                />
              </Field>

              {/* Type de vente */}
              <Field label="Type de vente" hint="Qui peut acheter ce produit ?">
                <div className="grid grid-cols-3 gap-3">
                  {SALE_TYPES.map(st => {
                    const active = form.saleType === st.value
                    return (
                      <button
                        key={st.value}
                        type="button"
                        onClick={() => set('saleType', st.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-center ${
                          active ? st.activeColor : 'border-charcoal/10 text-charcoal/60 hover:border-charcoal/25 bg-white'
                        }`}
                      >
                        <span className="text-xl leading-none">{st.icon}</span>
                        <span className="font-syne text-[11px] font-bold leading-tight">{st.label}</span>
                        <span className={`font-dm text-[10px] leading-tight ${active ? 'opacity-80' : 'text-charcoal/40'}`}>
                          {st.sub}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>

            {/* Card : Description */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 space-y-4">
              <div className="flex items-center justify-between">
                <SLabel>Description du produit</SLabel>
                <span className={`font-syne text-[10px] font-bold transition-colors ${
                  (form.description || '').length > 450 ? 'text-amber-500' : 'text-charcoal/30'
                }`}>
                  {(form.description || '').length} caractères
                </span>
              </div>

              <div className="relative">
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  rows={7}
                  placeholder="Décrivez votre produit : origine, qualité, utilisation recommandée, mode de cuisson…"
                  className={`${INPUT} resize-none transition-all duration-500 ${
                    flashDesc ? 'border-forest/50 bg-forest/3 ring-2 ring-forest/10' : ''
                  }`}
                />
                {flashDesc && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-forest text-white text-[11px] font-syne font-bold px-2.5 py-1 rounded-lg"
                  >
                    <Sparkles size={11} />
                    Généré par IA
                  </motion.div>
                )}
              </div>

              {/* Tip si pas encore générée */}
              {!form.description && (
                <p className="font-dm text-xs text-charcoal/35 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-forest/50 shrink-0" />
                  Remplissez au moins la catégorie et l'origine, puis cliquez sur « Générer titre &amp; description » en haut.
                </p>
              )}
            </div>

          </div>

          {/* ════ Colonne droite (1/3) ════ */}
          <div className="space-y-5">

            {/* Card : Photos */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 space-y-4">
              <SLabel>Photos du produit</SLabel>
              <input ref={imgRef} type="file" accept="image/*" multiple onChange={handleImgUpload} className="hidden" />

              {/* Grille images */}
              <div className="grid grid-cols-3 gap-2">
                {formImages.map((url, i) => (
                  <div key={i} className={`relative rounded-2xl overflow-hidden group ${i === 0 ? 'col-span-3 h-40' : 'h-20'}`}>
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {i === 0 && (
                      <div className="absolute top-2 left-2 bg-forest text-white font-syne text-[10px] font-bold px-2 py-0.5 rounded-lg">
                        Principale
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setFormImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <X size={16} className="text-white" />
                    </button>
                  </div>
                ))}

                {formImages.length < 8 && (
                  <button
                    type="button"
                    onClick={() => imgRef.current?.click()}
                    disabled={imgUploading}
                    className={`${formImages.length === 0 ? 'col-span-3 h-36' : 'h-20'} rounded-2xl border-2 border-dashed border-charcoal/15 flex flex-col items-center justify-center gap-2 text-charcoal/35 hover:border-forest/40 hover:text-forest hover:bg-forest/3 transition-all disabled:opacity-50`}
                  >
                    {imgUploading
                      ? <div className="w-5 h-5 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
                      : <ImagePlus size={22} />
                    }
                    {formImages.length === 0 && (
                      <span className="font-syne text-xs font-bold">Ajouter des photos</span>
                    )}
                  </button>
                )}
              </div>
              <p className="font-dm text-[11px] text-charcoal/35">
                Max 8 photos · La première sera l'image principale
              </p>
            </div>

            {/* Card : Détails supplémentaires */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 space-y-5">
              <SLabel>Détails supplémentaires</SLabel>

              <Field label="Origine" hint="Région ou pays">
                <input
                  type="text" value={form.origin}
                  onChange={e => set('origin', e.target.value)}
                  placeholder="Ex : Gagnoa, Côte d'Ivoire"
                  className={INPUT}
                />
              </Field>

              <Field label="Récolte" hint="Saison ou année">
                <input
                  type="text" value={form.harvest}
                  onChange={e => set('harvest', e.target.value)}
                  placeholder="Ex : Novembre 2024"
                  className={INPUT}
                />
              </Field>

              <Field label="Badge promotionnel">
                <input
                  type="text" value={form.badge}
                  onChange={e => set('badge', e.target.value)}
                  placeholder="Ex : Best-seller, Nouveau, Promo"
                  className={INPUT}
                />
                {form.badge && (
                  <div className="mt-2">
                    <span className="font-syne text-[11px] font-bold bg-[#E8A217]/15 text-[#E8A217] px-3 py-1 rounded-full">
                      {form.badge}
                    </span>
                  </div>
                )}
              </Field>
            </div>

            {/* Boutons action */}
            <div className="space-y-3">
              {(submitError || imgError) && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 font-dm text-sm">
                  <AlertCircle size={15} className="shrink-0" />
                  <span className="flex-1">{submitError || imgError}</span>
                  <button type="button" onClick={() => { setSubmitError(null); setImgError(null) }}><X size={13} /></button>
                </div>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-[#1B4332] text-white font-syne font-bold text-sm py-4 rounded-2xl hover:bg-[#2D6A4F] transition-colors disabled:opacity-60 shadow-lg shadow-forest/20"
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Check size={16} />
                }
                {saving ? 'Enregistrement…' : (isNew ? 'Créer le produit' : 'Enregistrer les modifications')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="w-full border-2 border-charcoal/12 font-syne font-semibold text-sm py-3.5 rounded-2xl text-charcoal/60 hover:bg-charcoal/5 transition-colors"
              >
                Annuler
              </button>
            </div>

          </div>
        </div>
      </form>
    </motion.div>
  )
}

// ─── Vue liste ────────────────────────────────────────────────────────────────
export default function ProductsTab() {
  const PAGE = 20

  const [products,   setProducts]   = useState([])
  const [total,      setTotal]      = useState(0)
  const [offset,     setOffset]     = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState('list')
  const [editTarget, setEditTarget] = useState(null)
  const [search,     setSearch]     = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvResult,  setCsvResult]  = useState(null)
  const [csvError,   setCsvError]   = useState(null)
  const fileRef = useRef()

  const buildQs = (off = 0, s = search, c = catFilter) => {
    const p = new URLSearchParams({ limit: PAGE, offset: off })
    if (s) p.set('search', s)
    if (c) p.set('category', c)
    return p.toString()
  }

  const load = async (resetOffset = true) => {
    const off = resetOffset ? 0 : offset
    if (resetOffset) { setLoading(true); setOffset(0) }
    try {
      const data = await api.get(`/products/shop/mine?${buildQs(off)}`)
      if (resetOffset) {
        setProducts(data.products)
      } else {
        setProducts(prev => [...prev, ...data.products])
      }
      setTotal(data.total)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => { load(true) }, [])

  // Recharge côté serveur quand search ou catégorie change
  const handleSearch = (val) => { setSearch(val); setTimeout(() => load(true), 0) }
  const handleCat    = (val) => { setCatFilter(val); setTimeout(() => load(true), 0) }

  const loadMore = async () => {
    const next = offset + PAGE
    setOffset(next)
    setLoadingMore(true)
    const data = await api.get(`/products/shop/mine?${buildQs(next)}`)
    setProducts(prev => [...prev, ...data.products])
    setTotal(data.total)
    setLoadingMore(false)
  }

  const openAdd  = () => { setEditTarget(null); setView('form') }
  const openEdit = (p) => { setEditTarget(p);   setView('form') }
  const closeForm = () => { setView('list'); setEditTarget(null) }

  const handleSave = async (payload) => {
    if (editTarget) {
      await api.put(`/products/${editTarget.id}`, payload)
    } else {
      await api.post('/products', payload)
    }
    await load(true)
    closeForm()
  }

  const handleDelete = async (id) => {
    if (!confirm('Désactiver ce produit ?')) return
    await api.delete(`/products/${id}`)
    setProducts(ps => ps.filter(p => p.id !== id))
    setTotal(t => t - 1)
  }

  const handleCsv = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvLoading(true); setCsvResult(null); setCsvError(null)
    try {
      const result = await uploadCsv('/products/import-csv', file)
      setCsvResult(result)
      await load(true)
    } catch (err) { setCsvError(err.message || 'Erreur lors de l\'import') }
    finally { setCsvLoading(false); e.target.value = '' }
  }

  // Filtrage côté serveur — products est déjà filtré
  const filtered = products

  // ── Vue formulaire ──
  if (view === 'form') {
    const initial      = editTarget
      ? { name: editTarget.name, category: editTarget.category, price: editTarget.price, unit: editTarget.unit, stock: editTarget.stock, description: editTarget.description || '', badge: editTarget.badge || '', origin: editTarget.origin || '', harvest: editTarget.harvest || '' }
      : EMPTY
    const initialImages = editTarget ? parseImages(editTarget.images) : []

    return (
      <ProductForm
        key={editTarget?.id ?? 'new'}
        initial={initial}
        initialImages={initialImages}
        isNew={!editTarget}
        onSave={handleSave}
        onCancel={closeForm}
      />
    )
  }

  // ── Vue liste ──
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="list"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Inventaire</p>
            <h1 className="font-playfair text-4xl font-bold text-charcoal">Mes produits</h1>
          </div>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCsv} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={csvLoading}
              className="flex items-center gap-2 border-2 border-forest/20 text-forest font-syne text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-forest/5 transition-colors disabled:opacity-50"
            >
              <Upload size={15} />
              {csvLoading ? 'Import…' : 'Importer CSV'}
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-forest text-cream font-syne text-sm font-bold px-5 py-2.5 rounded-full hover:bg-[#2D6A4F] transition-colors shadow-sm"
            >
              <Plus size={15} />
              Ajouter un produit
            </button>
          </div>
        </div>

        {/* CSV error */}
        {csvError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 font-dm text-sm">
            <AlertCircle size={15} className="shrink-0" />
            <span className="flex-1">{csvError}</span>
            <button onClick={() => setCsvError(null)}><X size={13} /></button>
          </div>
        )}

        {/* CSV result */}
        {csvResult && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center justify-between">
            <p className="font-dm text-sm text-green-700">
              <span className="font-semibold">{csvResult.created}</span> produits importés
              {csvResult.failed > 0 && `, ${csvResult.failed} erreurs`}
            </p>
            <button onClick={() => setCsvResult(null)}><X size={14} className="text-green-400" /></button>
          </div>
        )}

        {/* Search + filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/30" />
            <input
              value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Rechercher un produit…"
              className="w-full pl-9 pr-4 py-2.5 rounded-full border-2 border-charcoal/10 font-dm text-sm focus:outline-none focus:border-forest/40"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleCat('')}
              className={`shrink-0 font-syne text-xs font-bold px-3 py-2 rounded-full border-2 transition-all ${!catFilter ? 'bg-forest border-forest text-cream' : 'border-charcoal/15 text-charcoal hover:border-charcoal/30'}`}
            >
              Toutes
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c} onClick={() => handleCat(c)}
                className={`shrink-0 font-syne text-xs font-bold px-3 py-2 rounded-full border-2 transition-all ${catFilter === c ? 'bg-forest border-forest text-cream' : 'border-charcoal/15 text-charcoal hover:border-charcoal/30'}`}
              >
                {c}
              </button>
            ))}
          </div>
          {/* Compteur résultats */}
          {total > 0 && (
            <p className="font-dm text-xs text-charcoal/40 ml-auto shrink-0">
              {products.length} / {total} produit{total > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-4 text-charcoal/30">
                <Package size={40} strokeWidth={1.5} />
                <p className="font-dm text-sm">
                  {products.length === 0
                    ? 'Aucun produit pour l\'instant — commencez par en ajouter un.'
                    : 'Aucun résultat pour cette recherche.'}
                </p>
                {products.length === 0 && (
                  <button
                    onClick={openAdd}
                    className="flex items-center gap-2 bg-forest text-cream font-syne text-sm font-bold px-5 py-2.5 rounded-full hover:bg-[#2D6A4F] transition-colors mt-2"
                  >
                    <Plus size={15} />
                    Ajouter mon premier produit
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-charcoal/6">
                    {['Produit', 'Catégorie', 'Prix', 'Stock', 'Statut', ''].map(h => (
                      <th key={h} className="px-6 py-4 text-left font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5">
                  {filtered.map(p => {
                    const imgs = parseImages(p.images)
                    return (
                      <tr key={p.id} className="hover:bg-charcoal/[0.02] transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-cream overflow-hidden shrink-0 border border-charcoal/6">
                              {imgs[0]
                                ? <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-charcoal/20" /></div>
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="font-syne text-sm font-semibold text-charcoal truncate max-w-[200px]">{p.name}</p>
                              {p.badge && (
                                <span className="font-syne text-[10px] font-bold text-[#E8A217] bg-[#E8A217]/10 px-2 py-0.5 rounded-full">
                                  {p.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-syne text-xs font-bold text-charcoal/50">{p.category}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-playfair text-lg font-bold text-charcoal">{fmt(p.price)}</p>
                          <p className="font-dm text-xs text-charcoal/40">FCFA / {p.unit}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-syne text-sm font-bold ${
                            p.stock < 10 ? 'text-red-500' : p.stock < 30 ? 'text-amber-500' : 'text-green-600'
                          }`}>
                            {p.stock}
                          </span>
                          <p className="font-dm text-[10px] text-charcoal/30">sacs</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full ${
                            p.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {p.active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(p)}
                              className="flex items-center gap-1.5 bg-forest/8 text-forest font-syne text-xs font-bold px-3 py-2 rounded-xl hover:bg-forest/15 transition-colors"
                            >
                              <Edit2 size={13} />
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="w-8 h-8 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-colors flex items-center justify-center"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Bouton charger plus */}
        {!loading && products.length < total && (
          <div className="flex justify-center pt-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 border-2 border-charcoal/12 font-syne text-sm font-bold px-6 py-3 rounded-full text-charcoal/60 hover:border-forest/30 hover:text-forest transition-all disabled:opacity-50"
            >
              {loadingMore
                ? <div className="w-4 h-4 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
                : null
              }
              {loadingMore ? 'Chargement…' : `Charger plus (${total - products.length} restants)`}
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
