import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/client'
import { Plus, Pencil, Trash2, Package, Search, AlertTriangle, X, ChevronDown,
         CheckSquare, Square, Eye, EyeOff, CheckCircle2, AlertCircle, Boxes, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ProductFormView from './ProductFormView'

const LIMIT = 20
const fmt = n => Number(n || 0).toLocaleString('fr-FR')

const parseImages = (raw) => {
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw || '[]') } catch { return [] }
}

/* ── Modal de confirmation suppression ── */
function DeleteModal({ count, productName, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <div className="text-center">
          <p className="font-syne text-base font-bold text-charcoal">
            {count > 1 ? `Désactiver ${count} produits ?` : 'Désactiver ce produit ?'}
          </p>
          <p className="font-dm text-sm text-charcoal/50 mt-1">
            {count > 1
              ? `Ces ${count} produits seront masqués de la marketplace. Vous pourrez les réactiver.`
              : <><span className="font-bold text-charcoal">"{productName}"</span> sera masqué de la marketplace. Vous pourrez le réactiver depuis l'édition.</>
            }
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-2xl border border-charcoal/10 font-syne text-sm font-bold text-charcoal/60 hover:text-charcoal transition-colors">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-2xl bg-red-500 text-white font-syne text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Désactiver
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/* ── Ajustement de stock (Stock Engine, LOT 5) ── */
const ADJUST_TYPES = [
  { value: 'RECEPTION', label: 'Réception de marchandise', hint: 'Livraison fournisseur, réapprovisionnement' },
  { value: 'LOSS', label: 'Perte / casse', hint: 'Sacs endommagés, périmés, volés' },
  { value: 'ADJUSTMENT', label: 'Correction', hint: 'Erreur de comptage — peut être négative' },
]

function StockAdjustModal({ product, onClose, onSaved }) {
  const [type, setType] = useState('RECEPTION')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [movements, setMovements] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    api.get(`/products/${product.id}/stock-movements?limit=10`)
      .then(d => setMovements(d.movements || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [product.id])

  const submit = async () => {
    setError(null)
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty === 0) return setError('Quantité invalide.')
    if (type !== 'ADJUSTMENT' && qty < 0) return setError('Utilisez une quantité positive pour ce type.')
    if (!reason.trim()) return setError('Un motif est requis.')

    setSaving(true)
    try {
      await api.post(`/products/${product.id}/adjust-stock`, { type, quantity: qty, reason: reason.trim() })
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">Ajuster le stock</p>
            <p className="font-playfair text-lg font-bold text-charcoal">{product.name}</p>
            <p className="font-dm text-xs text-charcoal/40 mt-0.5">Stock actuel : {product.stock} sac{product.stock > 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-charcoal/30 hover:text-charcoal p-1"><X size={18} /></button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl px-3 py-2.5">
            <AlertTriangle size={13} className="text-red-500 shrink-0" />
            <p className="font-dm text-xs text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-1.5">Type de mouvement</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl border border-charcoal/10 bg-white font-dm text-sm">
              {ADJUST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="font-dm text-[11px] text-charcoal/35 mt-1">{ADJUST_TYPES.find(t => t.value === type)?.hint}</p>
          </div>
          <div>
            <label className="block font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-1.5">
              {type === 'ADJUSTMENT' ? 'Delta (peut être négatif)' : 'Quantité (sacs)'}
            </label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
              placeholder={type === 'ADJUSTMENT' ? 'ex : -3 ou 5' : 'ex : 20'}
              className="w-full px-4 py-2.5 rounded-2xl border border-charcoal/10 bg-white font-dm text-sm" />
          </div>
          <div>
            <label className="block font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-1.5">Motif *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="Obligatoire — ex : Livraison du 05/09, sacs mouillés en entrepôt…"
              className="w-full px-4 py-2.5 rounded-2xl border border-charcoal/10 bg-white font-dm text-sm resize-none" />
          </div>
        </div>

        <button onClick={submit} disabled={saving}
          className="w-full py-2.5 rounded-2xl bg-[#E8A217] text-white font-syne text-sm font-bold hover:bg-[#d4901a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Enregistrer le mouvement
        </button>

        <div className="pt-2 border-t border-charcoal/6">
          <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-2 flex items-center gap-1.5">
            <Clock size={11} /> Mouvements récents
          </p>
          {loadingHistory ? (
            <p className="font-dm text-xs text-charcoal/30">Chargement…</p>
          ) : movements.length === 0 ? (
            <p className="font-dm text-xs text-charcoal/30 italic">Aucun mouvement enregistré</p>
          ) : (
            <div className="space-y-1.5">
              {movements.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-charcoal/3 rounded-xl px-3 py-2">
                  <div>
                    <p className="font-dm text-xs text-charcoal">{m.type}{m.reason ? ` — ${m.reason}` : ''}</p>
                    <p className="font-dm text-[10px] text-charcoal/35">{new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className={`font-syne text-xs font-bold ${m.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

/* ── Barre d'actions en masse (flottante) ── */
function BulkActionBar({ count, onActivate, onDraft, onDelete, onClear, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
      style={{ marginLeft: 120 }} /* compense sidebar 240px / 2 */
    >
      <div className="flex items-center gap-3 bg-[#0F1923] text-white rounded-2xl px-4 py-3 shadow-2xl">
        {/* Compteur */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/15">
          <span className="w-6 h-6 rounded-lg bg-[#E8A217] flex items-center justify-center font-syne text-xs font-bold text-white shrink-0">
            {count}
          </span>
          <span className="font-syne text-sm font-semibold whitespace-nowrap">
            sélectionné{count > 1 ? 's' : ''}
          </span>
        </div>

        {/* Actions */}
        <button onClick={onActivate} disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 font-syne text-xs font-bold transition-colors disabled:opacity-40 whitespace-nowrap">
          <Eye size={13} /> Activer
        </button>
        <button onClick={onDraft} disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 font-syne text-xs font-bold transition-colors disabled:opacity-40 whitespace-nowrap">
          <EyeOff size={13} /> Brouillon
        </button>
        <button onClick={onDelete} disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-syne text-xs font-bold transition-colors disabled:opacity-40 whitespace-nowrap">
          <Trash2 size={13} /> Supprimer
        </button>

        {/* Spinner si en cours */}
        {loading && (
          <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        )}

        {/* Fermer */}
        <button onClick={onClear} disabled={!!loading}
          className="ml-1 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>
    </motion.div>
  )
}

export default function VendorProductsTab() {
  /* ── État global ── */
  const [view, setView]               = useState('list')
  const [editProduct, setEditProduct] = useState(null)
  const [shopName, setShopName]       = useState('')
  const [shopRating, setShopRating]   = useState(0)
  const [shopPlan, setShopPlan]       = useState('BASIC')
  const [activeCount, setActiveCount] = useState(0)
  const [productLimit, setProductLimit] = useState(0)

  /* ── Liste ── */
  const [products, setProducts] = useState([])
  const [total, setTotal]       = useState(0)
  const [offset, setOffset]     = useState(0)
  const [loading, setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch]     = useState('')
  const [saleFilter, setSaleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')

  /* ── Suppression ── */
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  /* ── Ajustement de stock ── */
  const [adjustTarget, setAdjustTarget] = useState(null)

  /* ── Sélection en masse ── */
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(null) // 'activate' | 'draft' | 'delete' | null
  const [productError, setProductError] = useState(null)

  const load = useCallback(async (reset = true) => {
    const isReset = reset
    isReset ? setLoading(true) : setLoadingMore(true)
    const currentOffset = isReset ? 0 : offset
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(currentOffset) })
      if (search)     params.set('search', search)
      if (saleFilter) params.set('saleType', saleFilter)
      const [data, dash] = await Promise.all([
        api.get(`/products/shop/mine?${params}`),
        api.get('/shops/my/dashboard').catch(() => null),
      ])
      const newProducts = data.products || []
      setProducts(prev => isReset ? newProducts : [...prev, ...newProducts])
      setTotal(data.total || 0)
      if (isReset) setOffset(LIMIT)
      else setOffset(o => o + LIMIT)
      if (dash?.shop?.name)   setShopName(dash.shop.name)
      if (dash?.shop?.rating) setShopRating(dash.shop.rating)
      if (dash?.shop?.plan)   setShopPlan(dash.shop.plan)
      if (dash?.kpis?.activeProducts !== undefined) setActiveCount(dash.kpis.activeProducts)
      if (dash?.basicMaxProducts !== undefined) setProductLimit(dash.basicMaxProducts)
    } catch {}
    finally { isReset ? setLoading(false) : setLoadingMore(false) }
  }, [search, offset])

  useEffect(() => {
    setOffset(0)
    setSelectedIds(new Set())
    load(true)
  }, [search, saleFilter, statusFilter]) // eslint-disable-line

  /* ── Actions individuelles ── */
  const openNew    = () => { setEditProduct(null); setView('form') }
  const openEdit   = (p) => { setEditProduct(p);   setView('form') }
  const backToList = () => { setView('list') }
  const onSaved    = () => { setView('list'); load(true) }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setProductError(null)
    try { await api.delete(`/products/${deleteTarget.id}`); await load(true) }
    catch (e) { setProductError(e.message || 'Erreur lors de la suppression') }
    finally { setDeleting(false); setDeleteTarget(null) }
  }

  /* ── Sélection ── */
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const selectAll = () => setSelectedIds(new Set(visibleProducts.map(p => p.id)))
  const clearSelection = () => setSelectedIds(new Set())

  /* ── Actions en masse ── */
  const bulkActivate = async () => {
    setBulkLoading('activate')
    setProductError(null)
    try {
      await Promise.all([...selectedIds].map(id => api.put(`/products/${id}`, { active: true })))
      clearSelection()
      await load(true)
    } catch (e) { setProductError(e.message || 'Erreur lors de la mise à jour') }
    finally { setBulkLoading(null) }
  }

  const bulkDraft = async () => {
    setBulkLoading('draft')
    setProductError(null)
    try {
      await Promise.all([...selectedIds].map(id => api.put(`/products/${id}`, { active: false })))
      clearSelection()
      await load(true)
    } catch (e) { setProductError(e.message || 'Erreur lors de la mise à jour') }
    finally { setBulkLoading(null) }
  }

  const bulkDelete = async () => {
    setBulkLoading('delete')
    setProductError(null)
    try {
      await Promise.all([...selectedIds].map(id => api.delete(`/products/${id}`)))
      clearSelection()
      await load(true)
    } catch (e) { setProductError(e.message || 'Erreur lors de la suppression') }
    finally { setBulkLoading(null) }
  }

  // Filtrage client-side par statut
  const visibleProducts = products.filter(p => {
    if (statusFilter === 'active') return p.active
    if (statusFilter === 'draft')  return !p.active
    return true
  })
  const lowStockProducts = products.filter(p => p.active && p.stock > 0 && p.stock < 10)
  const hasMore = products.length < total
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every(p => selectedIds.has(p.id))

  /* ── Rendu ── */
  return (
    <AnimatePresence mode="wait">
      {/* Modal suppression individuelle */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            count={1}
            productName={deleteTarget.name}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
            loading={deleting}
          />
        )}
      </AnimatePresence>

      {/* Modal d'ajustement de stock */}
      <AnimatePresence>
        {adjustTarget && (
          <StockAdjustModal
            product={adjustTarget}
            onClose={() => setAdjustTarget(null)}
            onSaved={() => { setAdjustTarget(null); load(true) }}
          />
        )}
      </AnimatePresence>

      {/* Barre d'actions en masse */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <BulkActionBar
            count={selectedIds.size}
            loading={bulkLoading}
            onActivate={bulkActivate}
            onDraft={bulkDraft}
            onDelete={bulkDelete}
            onClear={clearSelection}
          />
        )}
      </AnimatePresence>

      {view === 'form' ? (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ProductFormView
            product={editProduct}
            shopName={shopName}
            shopRating={shopRating}
            onBack={backToList}
            onSaved={onSaved}
          />
        </motion.div>
      ) : (
        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Boutique</p>
              <h1 className="font-playfair text-3xl font-bold text-charcoal">
                Produits
                {total > 0 && <span className="font-dm text-lg font-normal text-charcoal/30 ml-2">{total}</span>}
              </h1>
              {productLimit > 0 && shopPlan === 'BASIC' && (
                <div className={`mt-1 flex items-center gap-1.5 font-syne text-xs font-bold ${
                  activeCount >= productLimit ? 'text-red-500' : activeCount / productLimit >= 0.8 ? 'text-amber-600' : 'text-charcoal/50'
                }`}>
                  <span>{activeCount} / {productLimit} produits actifs</span>
                  {activeCount >= productLimit
                    ? <AlertCircle size={12} className="text-red-500" />
                    : activeCount / productLimit >= 0.8 && <AlertCircle size={12} className="text-amber-500" />
                  }
                </div>
              )}
            </div>
            {productLimit > 0 && shopPlan === 'BASIC' && activeCount >= productLimit ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 font-syne text-xs font-bold text-red-600">
                <AlertCircle size={13} className="shrink-0" />
                Limite atteinte — passez en plan Certifié
              </div>
            ) : (
              <button onClick={openNew}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#E8A217] text-white rounded-2xl font-syne text-sm font-bold hover:bg-[#d4901a] transition-colors">
                <Plus size={15} /> Nouveau produit
              </button>
            )}
          </div>

          {/* Error banner */}
          {productError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 font-dm text-sm">
              <AlertCircle size={16} className="shrink-0" />
              <span className="flex-1">{productError}</span>
              <button onClick={() => setProductError(null)}><X size={14} /></button>
            </div>
          )}

          {/* Alerte stock faible */}
          <AnimatePresence>
            {lowStockProducts.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <p className="font-dm text-sm text-amber-800 flex-1">
                  <span className="font-bold">{lowStockProducts.length} produit{lowStockProducts.length > 1 ? 's' : ''}</span> en stock faible (moins de 10 sacs) :{' '}
                  {lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}
                  {lowStockProducts.length > 3 && `…`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Statut */}
            {[
              { v: 'active', label: 'Publiés' },
              { v: 'draft',  label: 'Brouillons' },
              { v: 'all',    label: 'Tous' },
            ].map(({ v, label }) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                className={`px-3.5 py-1.5 rounded-xl font-syne text-xs font-bold transition-colors ${
                  statusFilter === v ? 'bg-charcoal text-cream' : 'bg-white border border-charcoal/10 text-charcoal/50 hover:text-charcoal'
                }`}>
                {label}
              </button>
            ))}

            <div className="w-px bg-charcoal/10 mx-1 self-stretch" />

            {/* Type de vente */}
            {[
              { v: '',          label: 'Tout type' },
              { v: 'RETAIL',    label: '🛒 Détail' },
              { v: 'WHOLESALE', label: '📦 Gros' },
              { v: 'BOTH',      label: 'Détail & Gros' },
            ].map(({ v, label }) => (
              <button key={v} onClick={() => setSaleFilter(v)}
                className={`px-3.5 py-1.5 rounded-xl font-syne text-xs font-bold transition-colors ${
                  saleFilter === v ? 'bg-[#E8A217] text-white' : 'bg-white border border-charcoal/10 text-charcoal/50 hover:text-charcoal'
                }`}>
                {label}
              </button>
            ))}

            {/* Tout sélectionner — apparaît seulement si des produits sont visibles */}
            {visibleProducts.length > 0 && (
              <>
                <div className="w-px bg-charcoal/10 mx-1 self-stretch" />
                <button
                  onClick={allVisibleSelected ? clearSelection : selectAll}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-syne text-xs font-bold transition-colors ${
                    allVisibleSelected
                      ? 'bg-charcoal/10 text-charcoal'
                      : 'bg-white border border-charcoal/10 text-charcoal/50 hover:text-charcoal'
                  }`}>
                  {allVisibleSelected
                    ? <CheckSquare size={13} />
                    : <Square size={13} />
                  }
                  {allVisibleSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </>
            )}
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/30 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit…"
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl border border-charcoal/10 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A217]/30"
            />
          </div>

          {/* Contenu */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-[#E8A217]/20 border-t-[#E8A217] rounded-full animate-spin" />
            </div>
          ) : visibleProducts.length === 0 ? (
            <EmptyState onNew={openNew} />
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleProducts.map((p, i) => (
                  <ProductListCard key={p.id} product={p} index={i}
                    selected={selectedIds.has(p.id)}
                    onToggleSelect={() => toggleSelect(p.id)}
                    onEdit={() => openEdit(p)}
                    onDelete={() => setDeleteTarget(p)}
                    onAdjustStock={() => setAdjustTarget(p)}
                  />
                ))}
              </div>

              {/* Pagination "Afficher plus" */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button onClick={() => load(false)} disabled={loadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-charcoal/10 rounded-2xl font-syne text-sm font-bold text-charcoal/60 hover:text-charcoal hover:border-charcoal/20 transition-colors disabled:opacity-50">
                    {loadingMore
                      ? <span className="w-4 h-4 border-2 border-charcoal/20 border-t-charcoal/60 rounded-full animate-spin" />
                      : <ChevronDown size={15} />
                    }
                    {loadingMore ? 'Chargement…' : `Afficher plus (${total - products.length} restants)`}
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── Carte produit dans la liste ── */
function ProductListCard({ product, index, selected, onToggleSelect, onEdit, onDelete, onAdjustStock }) {
  const images = parseImages(product.images)
  const cover  = images[0] || ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`bg-white rounded-3xl shadow-sm border overflow-hidden group transition-all ${
        selected ? 'border-[#E8A217] ring-2 ring-[#E8A217]/20' : 'border-gray-50'
      }`}
    >
      {/* Image */}
      <div className="relative h-36 bg-gray-50">
        {cover ? (
          <img src={cover} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={28} className="text-charcoal/15" />
          </div>
        )}

        {/* Checkbox sélection — visible au survol ou quand sélectionné */}
        <button
          onClick={e => { e.stopPropagation(); onToggleSelect() }}
          className={`absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center transition-all z-10 ${
            selected
              ? 'opacity-100 bg-[#E8A217] shadow-md'
              : 'opacity-0 group-hover:opacity-100 bg-white/90 shadow'
          }`}
        >
          {selected
            ? <CheckCircle2 size={14} className="text-white" />
            : <Square size={14} className="text-charcoal/50" />
          }
        </button>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.badge && (
            <span className="bg-[#E8A217] text-white font-syne text-[9px] font-bold px-2 py-0.5 rounded-full">
              {product.badge}
            </span>
          )}
          {!product.active && (
            <span className="bg-black/60 text-white font-syne text-[9px] font-bold px-2 py-0.5 rounded-full">
              Désactivé
            </span>
          )}
          {product.active && product.stock > 0 && product.stock < 10 && (
            <span className="bg-amber-500 text-white font-syne text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
              ⚠ Stock faible
            </span>
          )}
          {product.active && product.stock === 0 && (
            <span className="bg-red-500 text-white font-syne text-[9px] font-bold px-2 py-0.5 rounded-full">
              Rupture
            </span>
          )}
        </div>

        {/* Actions au survol */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-end justify-center gap-2 pb-2 opacity-0 group-hover:opacity-100">
          <button onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl font-syne text-xs font-bold text-charcoal shadow-sm hover:shadow transition-shadow">
            <Pencil size={12} /> Modifier
          </button>
          <button onClick={onAdjustStock}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl font-syne text-xs font-bold text-charcoal shadow-sm hover:shadow transition-shadow">
            <Boxes size={12} /> Stock
          </button>
          <button onClick={onDelete}
            className="p-1.5 bg-white rounded-xl text-red-500 shadow-sm hover:shadow transition-shadow">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Infos */}
      <div className="p-3.5">
        <p className="font-syne text-sm font-bold text-charcoal truncate">{product.name}</p>
        <p className="font-dm text-xs text-charcoal/40 mt-0.5 truncate">{product.category} · {product.unit}</p>

        <div className="flex items-center justify-between mt-3">
          <p className="font-playfair text-base font-bold text-charcoal">
            {fmt(product.price)} <span className="font-dm text-xs font-normal text-charcoal/40">FCFA</span>
          </p>
          <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full ${
            product.stock === 0    ? 'bg-red-50 text-red-500' :
            product.stock < 10    ? 'bg-amber-50 text-amber-600' :
                                    'bg-green-50 text-green-600'
          }`}>
            {product.stock === 0 ? 'Rupture' : `${product.stock} sac${product.stock > 1 ? 's' : ''}`}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/* ── État vide ── */
function EmptyState({ onNew }) {
  return (
    <div className="bg-white rounded-3xl p-14 text-center shadow-sm border border-gray-50">
      <div className="w-16 h-16 rounded-2xl bg-[#E8A217]/8 flex items-center justify-center mx-auto mb-4">
        <Package size={28} className="text-[#E8A217]/50" />
      </div>
      <p className="font-playfair text-xl font-bold text-charcoal mb-1">Aucun produit</p>
      <p className="font-dm text-sm text-charcoal/40 mb-6">Ajoutez votre premier produit pour commencer à vendre.</p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#E8A217] text-white rounded-2xl font-syne text-sm font-bold hover:bg-[#d4901a] transition-colors"
      >
        <Plus size={14} /> Créer un produit
      </button>
    </div>
  )
}
