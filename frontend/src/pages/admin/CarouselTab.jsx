import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Plus, Edit2, Trash2, Eye, EyeOff, X, Check, AlertCircle, Sparkles, Store, Package, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const EMPTY = {
  type: 'promotion', title: '', subtitle: '', badge: '', cta: 'Découvrir',
  ctaLink: '/shop', bg: '#1B4332', accent: '#E8A217', image: '', active: false, position: 0,
}

const fmt = (n) => Number(n).toLocaleString('fr-FR')

function parseImages(raw) {
  try { return JSON.parse(raw) } catch { return [] }
}

function shopToSlide(shop) {
  return {
    type: 'boutique',
    title: shop.name,
    subtitle: shop.description?.slice(0, 80) || `${shop._count?.products ?? 0} produits disponibles`,
    badge: '★ Boutique Certifiée',
    cta: 'Voir la boutique',
    ctaLink: `/shop/${shop.slug}`,
    bg: '#1B4332',
    accent: '#E8A217',
    image: shop.coverImage || shop.avatar || '',
    active: false,
    position: 0,
  }
}

function productToSlide(product) {
  const imgs = parseImages(product.images)
  return {
    type: 'produit',
    title: product.name,
    subtitle: `${product.shop?.name} · ${fmt(product.price)} FCFA / ${product.unit || 'sac'}`,
    badge: '🌾 Produit du moment',
    cta: 'Commander',
    ctaLink: `/product/${product.slug}`,
    bg: '#1B4332',
    accent: '#E8A217',
    image: imgs[0] || '',
    active: false,
    position: 0,
  }
}

// ─── Modale de génération automatique ────────────────────────────────────────

function AutoGenerateModal({ onClose, onDone }) {
  const [suggestions, setSuggestions] = useState(null)
  const [selected, setSelected]       = useState(new Set())
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [error, setError]             = useState(null)
  const [done, setDone]               = useState(0)

  useEffect(() => {
    api.get('/carousel/suggestions')
      .then(data => {
        setSuggestions(data)
        const keys = new Set()
        data.shops.forEach(s => keys.add(`shop-${s.id}`))
        data.products.forEach(p => keys.add(`product-${p.id}`))
        setSelected(keys)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (key) => setSelected(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const selectAll   = () => {
    if (!suggestions) return
    const keys = new Set()
    suggestions.shops.forEach(s => keys.add(`shop-${s.id}`))
    suggestions.products.forEach(p => keys.add(`product-${p.id}`))
    setSelected(keys)
  }
  const deselectAll = () => setSelected(new Set())

  const generate = async () => {
    if (!suggestions || selected.size === 0) return
    setGenerating(true); setError(null)

    const toCreate = [
      ...suggestions.shops.filter(s => selected.has(`shop-${s.id}`)).map(shopToSlide),
      ...suggestions.products.filter(p => selected.has(`product-${p.id}`)).map(productToSlide),
    ]

    let created = 0
    try {
      for (const slide of toCreate) {
        await api.post('/carousel', slide)
        created++
      }
      setDone(created)
      setTimeout(() => { onDone() }, 1200)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const totalItems = suggestions ? suggestions.shops.length + suggestions.products.length : 0

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-8 py-6 border-b border-charcoal/10">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-playfair text-2xl font-bold text-charcoal">Génération automatique</h2>
            <p className="font-dm text-xs text-charcoal/50 mt-0.5">Slides pré-remplis depuis les boutiques certifiées et leurs meilleurs produits</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-charcoal/8 flex items-center justify-center hover:bg-charcoal/15 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-7">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="font-dm text-sm text-red-600">{error}</p>
            </div>
          )}

          {done > 0 && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
              <Check size={14} className="text-green-600 shrink-0" />
              <p className="font-dm text-sm text-green-700">{done} slide{done > 1 ? 's' : ''} créé{done > 1 ? 's' : ''} avec succès !</p>
            </div>
          )}

          {suggestions && !loading && (
            <>
              {/* Controls */}
              <div className="flex items-center justify-between">
                <p className="font-dm text-sm text-charcoal/60">{selected.size} / {totalItems} éléments sélectionnés</p>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="font-syne text-xs font-bold text-indigo-600 hover:underline">Tout sélectionner</button>
                  <span className="text-charcoal/20">·</span>
                  <button onClick={deselectAll} className="font-syne text-xs font-bold text-charcoal/40 hover:underline">Tout désélectionner</button>
                </div>
              </div>

              {/* Boutiques certifiées */}
              {suggestions.shops.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Store size={14} className="text-amber-600" />
                    <h3 className="font-syne text-sm font-bold text-charcoal uppercase tracking-wider">
                      Boutiques certifiées ({suggestions.shops.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {suggestions.shops.map(shop => {
                      const key = `shop-${shop.id}`
                      const isSelected = selected.has(key)
                      return (
                        <button
                          key={shop.id}
                          onClick={() => toggle(key)}
                          className={`relative text-left rounded-2xl overflow-hidden border-2 transition-all ${
                            isSelected ? 'border-amber-400 shadow-md' : 'border-charcoal/10 opacity-60'
                          }`}
                        >
                          {/* Image / cover */}
                          <div className="h-20 bg-charcoal/10 relative">
                            {(shop.coverImage || shop.avatar) && (
                              <img src={shop.coverImage || shop.avatar} alt="" className="w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
                            <div className="absolute bottom-2 left-3">
                              <span className="font-syne text-[10px] font-bold text-amber-300">★ Certifiée</span>
                            </div>
                            {/* Checkbox */}
                            <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-amber-400 border-amber-400' : 'bg-white/80 border-charcoal/20'
                            }`}>
                              {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                            </div>
                          </div>
                          <div className="p-3">
                            <p className="font-syne text-xs font-bold text-charcoal truncate">{shop.name}</p>
                            <p className="font-dm text-[10px] text-charcoal/50 mt-0.5">
                              {shop._count?.products ?? 0} produits · ★ {shop.rating?.toFixed(1)}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Meilleurs produits */}
              {suggestions.products.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={14} className="text-forest" />
                    <h3 className="font-syne text-sm font-bold text-charcoal uppercase tracking-wider">
                      Meilleurs produits ({suggestions.products.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {suggestions.products.map(product => {
                      const key    = `product-${product.id}`
                      const isSelected = selected.has(key)
                      const img    = parseImages(product.images)[0]
                      return (
                        <button
                          key={product.id}
                          onClick={() => toggle(key)}
                          className={`relative text-left rounded-2xl overflow-hidden border-2 transition-all ${
                            isSelected ? 'border-forest/50 shadow-md' : 'border-charcoal/10 opacity-60'
                          }`}
                        >
                          <div className="h-20 bg-charcoal/10 relative">
                            {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
                            <div className="absolute bottom-2 left-3">
                              <span className="font-syne text-[10px] font-bold text-green-300">🌾 Produit</span>
                            </div>
                            <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-forest border-forest' : 'bg-white/80 border-charcoal/20'
                            }`}>
                              {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                            </div>
                          </div>
                          <div className="p-3">
                            <p className="font-syne text-xs font-bold text-charcoal truncate">{product.name}</p>
                            <p className="font-dm text-[10px] text-charcoal/50 mt-0.5">
                              {product.shop?.name} · {fmt(product.price)} FCFA
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {suggestions.shops.length === 0 && suggestions.products.length === 0 && (
                <div className="text-center py-12">
                  <Store size={40} className="mx-auto mb-3 text-charcoal/20" />
                  <p className="font-dm text-sm text-charcoal/40">Aucune boutique certifiée active pour le moment.</p>
                  <p className="font-dm text-xs text-charcoal/30 mt-1">Certifiez des boutiques pour les retrouver ici.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {suggestions && !loading && (
          <div className="border-t border-charcoal/10 px-8 py-5 flex items-center gap-3">
            <p className="font-dm text-xs text-charcoal/50 flex-1">
              Les slides créés seront <strong>inactifs</strong> — vous pourrez les modifier et les activer depuis la liste.
            </p>
            <button onClick={onClose} className="font-syne text-sm font-bold px-5 py-2.5 rounded-xl border-2 border-charcoal/15 text-charcoal hover:bg-charcoal/5 transition-colors">
              Annuler
            </button>
            <button
              onClick={generate}
              disabled={generating || selected.size === 0}
              className="flex items-center gap-2 bg-amber-500 text-white font-syne text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              <Sparkles size={14} />
              {generating ? 'Création…' : `Créer ${selected.size} slide${selected.size > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CarouselTab() {
  const [slides, setSlides]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState(null)       // null | 'add' | slide object
  const [form, setForm]               = useState(EMPTY)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState(null)
  const [actionError, setActionError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [preview, setPreview]         = useState(null)
  const [autoModal, setAutoModal]     = useState(false)

  const load = () => api.get('/carousel/all').then(setSlides).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openAdd  = () => { setForm(EMPTY); setModal('add') }
  const openEdit = (s) => { setForm(s); setModal(s) }

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setSaveError(null)
    try {
      if (modal === 'add') await api.post('/carousel', form)
      else await api.put(`/carousel/${modal.id}`, form)
      await load(); setModal(null)
    } catch (err) { setSaveError(err.message) }
    finally { setSaving(false) }
  }

  const toggleActive = async (slide) => {
    setActionError(null)
    try {
      await api.put(`/carousel/${slide.id}`, { active: !slide.active })
      setSlides(ss => ss.map(s => s.id === slide.id ? { ...s, active: !s.active } : s))
    } catch (err) { setActionError(err.message) }
  }

  const confirmDeleteAction = async () => {
    const id = confirmDelete
    setConfirmDelete(null); setActionError(null)
    try {
      await api.delete(`/carousel/${id}`)
      setSlides(ss => ss.filter(s => s.id !== id))
    } catch (err) { setActionError(err.message) }
  }

  const TYPE_BADGE = {
    boutique:  'bg-amber-100 text-amber-700',
    produit:   'bg-green-100 text-green-700',
    promotion: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="space-y-6">
      {/* ── En-tête ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Contenu</p>
          <h1 className="font-playfair text-4xl font-bold text-charcoal">Carousel</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoModal(true)}
            className="flex items-center gap-2 bg-amber-500 text-white font-syne text-sm font-bold px-5 py-2.5 rounded-full hover:bg-amber-600 transition-colors"
          >
            <Sparkles size={15} /> Générer automatiquement
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-charcoal text-cream font-syne text-sm font-bold px-5 py-2.5 rounded-full hover:bg-charcoal/80 transition-colors"
          >
            <Plus size={15} /> Nouveau slide
          </button>
        </div>
      </div>

      {/* Info génération */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
        <Sparkles size={15} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="font-dm text-xs text-charcoal/60">
          <strong className="text-charcoal">Génération automatique</strong> — créez des slides pré-remplis depuis les boutiques certifiées et leurs meilleurs produits en un clic. Les slides sont créés inactifs pour que vous puissiez les réviser avant publication.
        </p>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{actionError}</p>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}

      {/* ── Confirmation suppression ── */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <p className="font-playfair text-xl font-bold text-charcoal">Supprimer ce slide ?</p>
            <p className="font-dm text-sm text-charcoal/50">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border-2 border-charcoal/15 font-syne font-semibold text-sm py-2.5 rounded-xl text-charcoal hover:bg-charcoal/5 transition-colors">
                Annuler
              </button>
              <button onClick={confirmDeleteAction}
                className="flex-1 bg-red-500 text-white font-syne font-bold text-sm py-2.5 rounded-xl hover:bg-red-600 transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Liste des slides ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map(s => (
            <div key={s.id} className={`bg-white rounded-3xl shadow-card overflow-hidden border-2 transition-colors ${s.active ? 'border-forest/20' : 'border-transparent'}`}>
              <div className="flex items-stretch">
                {/* Thumb */}
                <div className="w-40 h-28 relative shrink-0 overflow-hidden cursor-pointer" onClick={() => setPreview(s)}>
                  {s.image && <img src={s.image} alt="" className="w-full h-full object-cover" />}
                  <div className="absolute inset-0" style={{ background: `${s.bg}CC` }} />
                  <div className="absolute inset-0 flex items-center justify-center p-2">
                    <p className="font-playfair text-xs font-bold text-cream leading-tight text-center">{s.title}</p>
                  </div>
                  <div className="absolute bottom-1.5 right-1.5">
                    <Eye size={11} className="text-white/60" />
                  </div>
                </div>

                {/* Infos */}
                <div className="flex-1 px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${TYPE_BADGE[s.type] || 'bg-charcoal/8 text-charcoal/50'}`}>
                        {s.type}
                      </span>
                      <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full ${s.active ? 'bg-green-100 text-green-600' : 'bg-charcoal/8 text-charcoal/40'}`}>
                        {s.active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <p className="font-playfair text-lg font-bold text-charcoal truncate">{s.title}</p>
                    <p className="font-dm text-xs text-charcoal/50 truncate">{s.subtitle}</p>
                    {s.ctaLink && (
                      <p className="font-dm text-[10px] text-charcoal/30 mt-0.5 flex items-center gap-1">
                        <ChevronRight size={10} /> {s.ctaLink}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex gap-1">
                      <div className="w-5 h-5 rounded-full border-2 border-charcoal/10" style={{ backgroundColor: s.bg }} title="Fond" />
                      <div className="w-5 h-5 rounded-full border-2 border-charcoal/10" style={{ backgroundColor: s.accent }} title="Accent" />
                    </div>
                    <button onClick={() => toggleActive(s)}
                      className={`p-2 rounded-xl transition-colors ${s.active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-charcoal/8 text-charcoal/40 hover:bg-charcoal/15'}`}
                      title={s.active ? 'Désactiver' : 'Activer'}
                    >
                      {s.active ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button onClick={() => openEdit(s)} className="p-2 rounded-xl bg-forest/8 text-forest hover:bg-forest/15 transition-colors" title="Modifier">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setConfirmDelete(s.id)} className="p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-colors" title="Supprimer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!slides.length && (
            <div className="bg-white rounded-3xl p-16 shadow-card text-center space-y-3">
              <Sparkles size={32} className="mx-auto text-charcoal/20" />
              <p className="font-dm text-charcoal/40">Aucun slide. Utilisez la génération automatique ou créez le premier manuellement.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Preview modal ── */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-charcoal/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setPreview(null)}
          >
            <div className="relative w-full max-w-3xl h-80 rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
              {preview.image && <img src={preview.image} alt="" className="w-full h-full object-cover" />}
              <div className="absolute inset-0" style={{ background: `linear-gradient(105deg, ${preview.bg}F0 35%, ${preview.bg}60 100%)` }} />
              <div className="absolute inset-0 flex flex-col justify-center px-12">
                {preview.badge && (
                  <span className="font-syne text-xs font-bold border px-4 py-2 rounded-full w-fit mb-4" style={{ color: preview.accent, borderColor: `${preview.accent}40` }}>
                    {preview.badge}
                  </span>
                )}
                <h2 className="font-playfair text-5xl font-bold text-cream mb-3">{preview.title}</h2>
                <p className="font-dm text-cream/70 mb-6">{preview.subtitle}</p>
                <button className="font-syne font-bold text-sm px-8 py-3 rounded-full w-fit" style={{ backgroundColor: preview.accent, color: preview.bg }}>
                  {preview.cta}
                </button>
              </div>
              <button onClick={() => setPreview(null)} className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-cream">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add/Edit modal ── */}
      <AnimatePresence>
        {modal !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setModal(null)}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-playfair text-2xl font-bold text-charcoal">
                  {modal === 'add' ? 'Nouveau slide' : 'Modifier le slide'}
                </h2>
                <button onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-charcoal/8 flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {/* Type */}
                <div>
                  <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-forest transition-colors bg-white"
                  >
                    <option value="promotion">Promotion</option>
                    <option value="boutique">Boutique</option>
                    <option value="produit">Produit</option>
                  </select>
                </div>

                {[
                  { key: 'title',    label: 'Titre',        required: true },
                  { key: 'subtitle', label: 'Sous-titre' },
                  { key: 'badge',    label: 'Badge (texte court)' },
                  { key: 'cta',      label: 'Texte du bouton' },
                  { key: 'ctaLink',  label: 'Lien du bouton' },
                  { key: 'image',    label: 'URL image de fond' },
                ].map(({ key, label, required }) => (
                  <div key={key}>
                    <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">{label}</label>
                    <input
                      type="text" value={form[key] || ''} required={required}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-forest transition-colors"
                    />
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-4">
                  {[{ key: 'bg', label: 'Couleur fond' }, { key: 'accent', label: 'Couleur accent' }].map(({ key, label }) => (
                    <div key={key}>
                      <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">{label}</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-10 h-10 rounded-xl border-2 border-charcoal/10 cursor-pointer" />
                        <input type="text" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          className="flex-1 border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm focus:outline-none focus:border-forest" />
                      </div>
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${form.active ? 'bg-forest border-forest' : 'border-charcoal/20'}`}>
                    {form.active && <Check size={12} className="text-cream" />}
                  </div>
                  <span className="font-dm text-sm text-charcoal">Activer immédiatement</span>
                </label>

                {saveError && (
                  <div className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2.5">
                    <AlertCircle size={13} className="text-red-500 shrink-0" />
                    <p className="font-dm text-sm text-red-600">{saveError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setModal(null); setSaveError(null) }}
                    className="flex-1 border-2 border-charcoal/15 font-syne font-semibold text-sm py-3 rounded-xl hover:bg-charcoal/5 transition-colors">
                    Annuler
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-charcoal text-cream font-syne font-bold text-sm py-3 rounded-xl disabled:opacity-60 hover:bg-charcoal/80 transition-colors">
                    {saving ? '…' : modal === 'add' ? 'Créer' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modale génération auto ── */}
      <AnimatePresence>
        {autoModal && (
          <AutoGenerateModal
            onClose={() => setAutoModal(false)}
            onDone={() => { setAutoModal(false); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
