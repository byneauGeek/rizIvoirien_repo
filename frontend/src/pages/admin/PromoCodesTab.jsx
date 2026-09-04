import { useState, useEffect } from 'react'
import { Plus, Trash2, X, Check, Tag, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../api/client'

const fmt = n => Number(n).toLocaleString('fr-FR')

const EMPTY = { code: '', description: '', type: 'PERCENT', value: '', minOrder: '', maxUses: 100, active: true, expiresAt: '' }

export default function PromoCodesTab() {
  const [promos, setPromos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = () => api.get('/promo').then(setPromos).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setSaveError(null)
    try {
      const payload = {
        ...form,
        value: Number(form.value),
        minOrder: Number(form.minOrder) || 0,
        maxUses: Number(form.maxUses) || 100,
        code: form.code.trim().toUpperCase(),
        expiresAt: form.expiresAt || undefined,
      }
      await api.post('/promo', payload)
      await load()
      setModal(false)
      setForm(EMPTY)
    } catch (err) { setSaveError(err.message) }
    finally { setSaving(false) }
  }

  const handleToggle = async (promo) => {
    setActionError(null)
    try {
      await api.put(`/promo/${promo.id}`, { active: !promo.active })
      setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, active: !p.active } : p))
    } catch (err) { setActionError(err.message) }
  }

  const handleDelete = async (id) => {
    setConfirmDelete(id)
  }

  const confirmDeleteAction = async () => {
    const id = confirmDelete
    setConfirmDelete(null); setActionError(null)
    try {
      await api.delete(`/promo/${id}`)
      setPromos(prev => prev.filter(p => p.id !== id))
    } catch (err) { setActionError(err.message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Promotions</p>
          <h1 className="font-playfair text-4xl font-bold text-charcoal">Codes promo</h1>
        </div>
        <button onClick={() => { setForm(EMPTY); setModal(true) }}
          className="flex items-center gap-2 bg-safran text-charcoal font-syne text-sm font-bold px-5 py-2.5 rounded-full hover:bg-safran/80 transition-colors">
          <Plus size={15} /> Nouveau code
        </button>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{actionError}</p>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <p className="font-playfair text-xl font-bold text-charcoal">Supprimer ce code promo ?</p>
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

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse shadow-card" />)}</div>
      ) : (
        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal/6">
                {['Code', 'Réduction', 'Usage', 'Commande min', 'Expiration', 'Statut', ''].map(h => (
                  <th key={h} className="px-5 py-4 text-left font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {promos.map(p => (
                <tr key={p.id} className="hover:bg-charcoal/2 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-safran" />
                      <span className="font-syne text-sm font-bold text-charcoal tracking-wider">{p.code}</span>
                    </div>
                    {p.description && <p className="font-dm text-xs text-charcoal/40 mt-0.5">{p.description}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-playfair text-lg font-bold text-charcoal">
                      {p.type === 'PERCENT' ? `${p.value}%` : `${fmt(p.value)} FCFA`}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-dm text-sm text-charcoal">{p.usedCount} / {p.maxUses}</p>
                    <div className="mt-1 h-1.5 w-24 bg-charcoal/10 rounded-full overflow-hidden">
                      <div className="h-full bg-safran rounded-full" style={{ width: `${Math.min(100, (p.usedCount / p.maxUses) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-dm text-sm text-charcoal/60">{p.minOrder > 0 ? `${fmt(p.minOrder)} FCFA` : '—'}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-dm text-sm text-charcoal/60">
                      {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('fr-FR') : 'Aucune'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => handleToggle(p)}
                      className={`font-syne text-xs font-bold px-3 py-1 rounded-full transition-colors ${p.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-charcoal/8 text-charcoal/40 hover:bg-charcoal/15'}`}>
                      {p.active ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => handleDelete(p.id)}
                      className="w-8 h-8 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-colors flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!promos.length && (
                <tr><td colSpan={7} className="px-5 py-16 text-center font-dm text-charcoal/40">Aucun code promo. Créez-en un !</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setModal(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-playfair text-2xl font-bold text-charcoal">Nouveau code promo</h2>
                <button onClick={() => setModal(false)} className="w-8 h-8 rounded-full bg-charcoal/8 flex items-center justify-center text-charcoal/50 hover:bg-charcoal/15">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">Code *</label>
                  <input type="text" required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="SUMMER20" className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-syne text-sm font-bold tracking-wider uppercase focus:outline-none focus:border-safran transition-colors" />
                </div>

                <div>
                  <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">Description</label>
                  <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Promotion été 2025" className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-safran transition-colors" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">Type *</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-safran transition-colors">
                      <option value="PERCENT">Pourcentage (%)</option>
                      <option value="FIXED">Montant fixe (FCFA)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">
                      Valeur * {form.type === 'PERCENT' ? '(%)' : '(FCFA)'}
                    </label>
                    <input type="number" required min={1} value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                      placeholder={form.type === 'PERCENT' ? '10' : '1000'}
                      className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-safran transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">Commande min (FCFA)</label>
                    <input type="number" min={0} value={form.minOrder} onChange={e => setForm(f => ({ ...f, minOrder: e.target.value }))}
                      placeholder="0" className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-safran transition-colors" />
                  </div>
                  <div>
                    <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">Nb utilisations max</label>
                    <input type="number" min={1} value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                      className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-safran transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">Date d'expiration</label>
                  <input type="datetime-local" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-safran transition-colors" />
                </div>

                {saveError && (
                  <div className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2.5">
                    <AlertCircle size={13} className="text-red-500 shrink-0" />
                    <p className="font-dm text-sm text-red-600">{saveError}</p>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setModal(false); setSaveError(null) }}
                    className="flex-1 border-2 border-charcoal/15 font-syne font-semibold text-sm py-3 rounded-xl text-charcoal hover:bg-charcoal/5 transition-colors">
                    Annuler
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-safran text-charcoal font-syne font-bold text-sm py-3 rounded-xl hover:bg-safran/80 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {saving ? <div className="w-4 h-4 border-2 border-charcoal/30 border-t-charcoal rounded-full animate-spin" /> : <Check size={16} />}
                    Créer le code
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
