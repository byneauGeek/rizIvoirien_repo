/**
 * ProductFormView — Formulaire pleine page création / édition produit.
 * Layout 2 colonnes : formulaire (gauche) + aperçu live (droite).
 *
 * Props :
 *   product   {object|null}   Produit existant (null = création)
 *   shopName  {string}        Nom de la boutique pour l'aperçu
 *   onBack    {fn}            Retour à la liste
 *   onSaved   {fn}            Après sauvegarde réussie
 */
import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Save, AlertTriangle, CheckCircle, History, ChevronDown, ArrowRight, Plus, Trash2, Power } from 'lucide-react'
import { api } from '../../api/client'
import { motion, AnimatePresence } from 'framer-motion'
import AIGeneratorPanel   from './AIGeneratorPanel'
import ImageDragDrop      from './ImageDragDrop'
import ProductPreviewCard from './ProductPreviewCard'

const CATEGORIES = [
  'Riz local', 'Riz importé', 'Riz étuvé', 'Riz brisé',
  'Riz parfumé', 'Riz gluant', 'Autre',
]
const BADGES = ['', 'Best-seller', 'Nouveau', 'Bio', 'Édition Limitée', 'Économique']
const SALE_TYPES = [
  { value: 'BOTH',      label: '🛒 Détail & Gros' },
  { value: 'RETAIL',    label: '🛒 Détail seulement' },
  { value: 'WHOLESALE', label: '📦 Gros seulement' },
]

const parseImages = (raw) => {
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw || '[]') } catch { return [] }
}

const EMPTY = {
  name: '', description: '', category: 'Riz local',
  price: '', unit: '5kg', stock: '',
  images: [], badge: '', origin: '', harvest: '', saleType: 'BOTH',
  wholesalePrice: '', minWholesaleQty: '',
  active: true,
}

export default function ProductFormView({ product, shopName, shopRating = 0, onBack, onSaved }) {
  const [form, setForm] = useState(() =>
    product
      ? { ...EMPTY, ...product, images: parseImages(product.images) }
      : { ...EMPTY }
  )
  const [saving,      setSaving]      = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error,       setError]       = useState(null)
  const [saved,       setSaved]       = useState(false)

  /* ── Historique ── */
  const [history,        setHistory]        = useState([])
  const [historyOpen,    setHistoryOpen]    = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    if (!product?.id) return
    setHistoryLoading(true)
    try {
      const data = await api.get(`/products/${product.id}/history`)
      setHistory(data || [])
    } catch {}
    finally { setHistoryLoading(false) }
  }, [product?.id])

  useEffect(() => { loadHistory() }, [loadHistory])

  const set = (key) => (value) => setForm(f => ({ ...f, [key]: value }))
  const setE = (key) => (e) => set(key)(e.target.value)

  /* ── IA callback ── */
  const handleGenerated = ({ name, description }) => {
    setForm(f => ({ ...f, name, description }))
  }

  /* ── Sauvegarde ── */
  const doSave = async (publish) => {
    if (!form.name.trim()) { setError('Le nom est requis.'); return }
    if (!form.price)       { setError('Le prix est requis.'); return }
    if (!form.category)    { setError('La catégorie est requise.'); return }

    publish ? setSaving(true) : setSavingDraft(true)
    setError(null)
    try {
      const payload = {
        ...form,
        price:           Number(form.price),
        wholesalePrice:  form.wholesalePrice  ? Number(form.wholesalePrice)  : null,
        minWholesaleQty: form.minWholesaleQty ? Number(form.minWholesaleQty) : null,
        active:          publish,
      }
      if (product) {
        // Le stock ne se modifie plus depuis ce formulaire (Stock Engine,
        // LOT 5) — ajustez-le depuis la liste des produits, avec un motif.
        delete payload.stock
        await api.put(`/products/${product.id}`, payload)
      } else {
        payload.stock = Number(form.stock) || 0
        await api.post('/products', payload)
      }
      setSaved(true)
      await loadHistory()
      setTimeout(() => { setSaved(false); onSaved() }, 1000)
    } catch (e) {
      setError(e.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false); setSavingDraft(false)
    }
  }

  const save      = () => doSave(true)
  const saveDraft = () => doSave(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-charcoal/10 bg-white font-syne text-sm font-bold text-charcoal/50 hover:text-charcoal hover:border-charcoal/20 transition-colors"
          >
            <ArrowLeft size={15} /> Retour
          </button>
          <div>
            <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/30">
              Boutique · {product ? 'Modifier' : 'Nouveau produit'}
            </p>
            <h1 className="font-playfair text-2xl font-bold text-charcoal leading-none">
              {product ? (form.name || product.name) : 'Nouveau produit'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Brouillon */}
          {!product?.active && (
            <button onClick={saveDraft} disabled={savingDraft || saving || saved}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-charcoal/15 bg-white font-syne text-sm font-bold text-charcoal/60 hover:text-charcoal transition-colors disabled:opacity-50">
              {savingDraft && <span className="w-3.5 h-3.5 border-2 border-charcoal/20 border-t-charcoal/60 rounded-full animate-spin" />}
              Brouillon
            </button>
          )}
          {/* Publier */}
          <button onClick={save} disabled={saving || savingDraft || saved}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-syne text-sm font-bold transition-all ${
              saved ? 'bg-green-500 text-white' : 'bg-[#E8A217] text-white hover:bg-[#d4901a] disabled:opacity-50'
            }`}>
            {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saved  && <CheckCircle size={15} />}
            {!saving && !saved && <Save size={15} />}
            {saved ? 'Enregistré !' : saving ? 'Publication…' : (product?.active === false ? 'Publier' : 'Enregistrer')}
          </button>
        </div>
      </div>

      {/* Erreur globale */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Layout 2 colonnes */}
      <div className="flex gap-6 items-start">

        {/* ── Colonne gauche : formulaire ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Panneau IA */}
          <AIGeneratorPanel onGenerated={handleGenerated} />

          {/* Images drag & drop */}
          <Section title="Photos du produit">
            <ImageDragDrop images={form.images} onChange={set('images')} />
          </Section>

          {/* Informations principales */}
          <Section title="Informations">
            <div className="space-y-4">

              <Field label="Nom du produit *">
                <input
                  value={form.name}
                  onChange={setE('name')}
                  placeholder="ex : Riz jasmin parfumé premium"
                  className={inputCls}
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={setE('description')}
                  placeholder="Décrivez votre produit : origine, qualité, bienfaits…"
                  rows={4}
                  className={`${inputCls} resize-none`}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Catégorie *">
                  <select value={form.category} onChange={setE('category')} className={inputCls}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>

                <Field label="Type de vente">
                  <select value={form.saleType} onChange={setE('saleType')} className={inputCls}>
                    {SALE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Prix (FCFA) *">
                  <input
                    type="number"
                    value={form.price}
                    onChange={setE('price')}
                    placeholder="ex : 12500"
                    className={inputCls}
                  />
                </Field>

                <Field label="Unité">
                  <input
                    value={form.unit}
                    onChange={setE('unit')}
                    placeholder="ex : 5kg, 25kg, sac"
                    className={inputCls}
                  />
                </Field>

                {product ? (
                  <Field label="Stock (sacs)">
                    <div className={`${inputCls} bg-charcoal/3 text-charcoal/60 flex items-center justify-between`}>
                      <span>{product.stock} sac{product.stock > 1 ? 's' : ''}</span>
                      <span className="font-syne text-[10px] font-bold text-charcoal/35 uppercase tracking-wider">Ajuster depuis la liste</span>
                    </div>
                  </Field>
                ) : (
                  <Field label="Stock initial (sacs)">
                    <input
                      type="number"
                      value={form.stock}
                      onChange={setE('stock')}
                      placeholder="ex : 50"
                      className={inputCls}
                    />
                  </Field>
                )}

                <Field label="Badge promo">
                  <select value={form.badge} onChange={setE('badge')} className={inputCls}>
                    {BADGES.map(b => <option key={b} value={b}>{b || '— Aucun —'}</option>)}
                  </select>
                </Field>

                <Field label="Origine">
                  <input
                    value={form.origin}
                    onChange={setE('origin')}
                    placeholder="ex : Côte d'Ivoire"
                    className={inputCls}
                  />
                </Field>

                <Field label="Récolte">
                  <input
                    value={form.harvest}
                    onChange={setE('harvest')}
                    placeholder="ex : 2024, Saison sèche"
                    className={inputCls}
                  />
                </Field>

                {(form.saleType === 'WHOLESALE' || form.saleType === 'BOTH') && (
                  <>
                    <Field label="Prix en gros (FCFA / sac)">
                      <input
                        type="number"
                        value={form.wholesalePrice}
                        onChange={setE('wholesalePrice')}
                        placeholder="ex : 45000"
                        className={inputCls}
                      />
                    </Field>

                    <Field label="Quantité minimale (sacs)">
                      <input
                        type="number"
                        value={form.minWholesaleQty}
                        onChange={setE('minWholesaleQty')}
                        placeholder="ex : 10"
                        className={inputCls}
                      />
                    </Field>
                  </>
                )}
              </div>
            </div>
          </Section>

          {/* ── Tailles supplémentaires (LOT VARIANTS, retour utilisateur, édition uniquement) ── */}
          {product && <VariantsSection product={product} />}

          {/* ── Historique des modifications (édition uniquement) ── */}
          {product && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
              {/* Accordéon header */}
              <button
                onClick={() => setHistoryOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-charcoal/6 flex items-center justify-center">
                    <History size={14} className="text-charcoal/40" />
                  </div>
                  <div className="text-left">
                    <p className="font-syne text-sm font-bold text-charcoal">Historique des modifications</p>
                    {!historyOpen && (
                      <p className="font-dm text-xs text-charcoal/35">
                        {historyLoading ? 'Chargement…' : history.length === 0 ? 'Aucune modification enregistrée' : `${history.length} modification${history.length > 1 ? 's' : ''}`}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-charcoal/30 transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {historyOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-charcoal/6 px-5 py-4">
                      {historyLoading ? (
                        <div className="flex justify-center py-6">
                          <div className="w-5 h-5 border-2 border-[#E8A217]/20 border-t-[#E8A217] rounded-full animate-spin" />
                        </div>
                      ) : history.length === 0 ? (
                        <p className="font-dm text-sm text-charcoal/35 text-center py-6">
                          Aucune modification enregistrée pour ce produit.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {history.map((entry, i) => (
                            <div key={entry.id} className={`relative pl-6 ${i < history.length - 1 ? 'pb-4 border-b border-charcoal/5' : ''}`}>
                              {/* Timeline dot */}
                              <span className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full border-2 border-[#E8A217] bg-white" />
                              {i < history.length - 1 && (
                                <span className="absolute left-[4px] top-3.5 w-px h-full bg-charcoal/8" />
                              )}

                              {/* Metadata */}
                              <div className="flex items-baseline justify-between gap-2 mb-2">
                                <p className="font-syne text-xs font-bold text-charcoal">{entry.actorName}</p>
                                <p className="font-dm text-[10px] text-charcoal/35 shrink-0">
                                  {new Date(entry.createdAt).toLocaleDateString('fr-FR', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              </div>

                              {/* Champs modifiés */}
                              <div className="space-y-1.5">
                                {entry.changes.map((c, j) => (
                                  <div key={j} className="flex items-center gap-2 flex-wrap">
                                    <span className="font-syne text-[10px] font-bold text-charcoal/40 uppercase tracking-wider w-20 shrink-0">
                                      {c.label}
                                    </span>
                                    <span className="font-dm text-xs text-charcoal/50 bg-red-50 px-2 py-0.5 rounded-lg max-w-[120px] truncate" title={String(c.from)}>
                                      {c.from === true ? 'Publié' : c.from === false ? 'Brouillon' : String(c.from || '—')}
                                    </span>
                                    <ArrowRight size={10} className="text-charcoal/25 shrink-0" />
                                    <span className="font-dm text-xs text-charcoal font-medium bg-green-50 px-2 py-0.5 rounded-lg max-w-[120px] truncate" title={String(c.to)}>
                                      {c.to === true ? 'Publié' : c.to === false ? 'Brouillon' : String(c.to || '—')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Colonne droite : aperçu sticky ── */}
        <div className="w-72 shrink-0 sticky top-6">
          <ProductPreviewCard form={form} shopName={shopName} shopRating={shopRating} />
        </div>

      </div>
    </motion.div>
  )
}

/* ── Helpers ── */
const inputCls = 'w-full px-4 py-2.5 rounded-2xl border border-charcoal/10 bg-white font-dm text-sm text-charcoal placeholder:text-charcoal/25 focus:outline-none focus:ring-2 focus:ring-[#E8A217]/30 transition-shadow'

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 space-y-4">
      <p className="font-syne text-sm font-bold text-charcoal">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

// LOT VARIANTS (retour utilisateur) : un produit peut proposer d'autres
// tailles de sac que sa taille de base (ex. 50kg en plus du 25kg déjà
// renseigné ci-dessus) — chacune avec son propre prix et stock. Gestion
// séparée du formulaire principal : une variante n'existe qu'une fois le
// produit lui-même déjà créé (elle référence son productId).
function VariantsSection({ product }) {
  const [variants, setVariants] = useState(product.variants || [])
  const [showForm, setShowForm] = useState(false)
  const [newVariant, setNewVariant] = useState({ unit: '', price: '', stock: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    try {
      const data = await api.get('/products/shop/mine')
      const fresh = (data.products || []).find(p => p.id === product.id)
      if (fresh) setVariants(fresh.variants || [])
    } catch {}
  }

  const addVariant = async () => {
    setError(null)
    if (!newVariant.unit.trim() || !newVariant.price) { setError('Taille et prix requis'); return }
    setSaving(true)
    try {
      await api.post(`/products/${product.id}/variants`, {
        unit: newVariant.unit.trim(),
        price: Number(newVariant.price),
        stock: Number(newVariant.stock) || 0,
      })
      setNewVariant({ unit: '', price: '', stock: '' })
      setShowForm(false)
      await reload()
    } catch (e) {
      setError(e.message || 'Erreur lors de la création')
    } finally { setSaving(false) }
  }

  const toggleActive = async (variant) => {
    await api.put(`/products/${product.id}/variants/${variant.id}`, { active: !variant.active })
    await reload()
  }

  const removeVariant = async (variant) => {
    if (!window.confirm(`Retirer la taille "${variant.unit}" ?`)) return
    await api.delete(`/products/${product.id}/variants/${variant.id}`)
    await reload()
  }

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-syne text-sm font-bold text-charcoal">Tailles supplémentaires</p>
          <p className="font-dm text-xs text-charcoal/40 mt-0.5">
            En plus de la taille de base ({product.unit}) — chaque taille a son propre prix et stock.
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 font-syne text-xs font-bold text-[#E8A217] hover:text-[#d4901a]">
          <Plus size={13} /> Ajouter
        </button>
      </div>

      {variants.length > 0 && (
        <div className="space-y-2">
          {variants.map(v => (
            <div key={v.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${v.active ? 'border-charcoal/8' : 'border-charcoal/8 opacity-50'}`}>
              <div className="flex-1 min-w-0">
                <p className="font-syne text-sm font-bold text-charcoal">{v.unit}</p>
                <p className="font-dm text-xs text-charcoal/40">{Number(v.price).toLocaleString('fr-FR')} FCFA · {v.stock} sac{v.stock > 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => toggleActive(v)} title={v.active ? 'Désactiver' : 'Activer'}
                className={`p-2 rounded-xl transition-colors ${v.active ? 'text-green-600 hover:bg-green-50' : 'text-charcoal/30 hover:bg-charcoal/5'}`}>
                <Power size={14} />
              </button>
              <button onClick={() => removeVariant(v)} className="p-2 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="grid grid-cols-3 gap-3 pt-2">
              <Field label="Taille">
                <input value={newVariant.unit} onChange={e => setNewVariant(v => ({ ...v, unit: e.target.value }))}
                  placeholder="ex : 50kg" className={inputCls} />
              </Field>
              <Field label="Prix (FCFA)">
                <input type="number" value={newVariant.price} onChange={e => setNewVariant(v => ({ ...v, price: e.target.value }))}
                  placeholder="ex : 24000" className={inputCls} />
              </Field>
              <Field label="Stock initial">
                <input type="number" value={newVariant.stock} onChange={e => setNewVariant(v => ({ ...v, stock: e.target.value }))}
                  placeholder="ex : 20" className={inputCls} />
              </Field>
            </div>
            {error && <p className="font-dm text-xs text-red-500 mt-2">{error}</p>}
            <button onClick={addVariant} disabled={saving}
              className="mt-3 flex items-center gap-2 bg-[#E8A217] text-white font-syne text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-[#d4901a] transition-colors disabled:opacity-50">
              {saving ? 'Ajout…' : 'Ajouter cette taille'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
