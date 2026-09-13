import { useEffect, useState } from 'react'
import { Plus, X, AlertCircle, Package } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useB2BReferenceData } from '../../hooks/useB2BReferenceData'
import { B2B_ROLE_META, OFFER_STATUS_LABEL, REQUEST_STATUS_LABEL } from './roleMeta'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

export default function ListingsTab({ effectiveRole }) {
  const { user } = useAuth()
  const { regions: CI_REGIONS, products: RICE_PRODUCTS, units: RICE_UNITS } = useB2BReferenceData()
  const meta = B2B_ROLE_META[effectiveRole || user.role]
  const isOffer = meta.kind === 'offer'
  const endpoint = isOffer ? '/b2b/offers' : '/b2b/requests'
  const statusLabels = isOffer ? OFFER_STATUS_LABEL : REQUEST_STATUS_LABEL

  const isCooperative = (effectiveRole || user.role) === 'COOPERATIVE'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ product: 'Riz paddy', quantity: '', unit: 'tonne', region: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [members, setMembers] = useState([]) // LOT AUDIT-OWN-01 : membres actifs, pour le sélecteur de propriétaire

  const load = async () => {
    setLoading(true)
    try {
      const key = isOffer ? 'offers' : 'requests'
      const data = await api.get(`${endpoint}/mine`)
      setItems(data[key] || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (isCooperative && isOffer) {
      api.get('/b2b/cooperative/members?active=true').then(d => setMembers(d.members || [])).catch(() => {})
    }
  }, [isCooperative, isOffer])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.quantity || Number(form.quantity) <= 0) return setFormError('Quantité invalide.')
    if (!form.region) return setFormError('La région est requise.')
    setSubmitting(true)
    try {
      await api.post(endpoint, {
        ...form,
        quantity: Number(form.quantity),
        minOrderQty: form.minOrderQty ? Number(form.minOrderQty) : undefined,
        ownerProducerId: form.ownerProducerId ? Number(form.ownerProducerId) : undefined,
      })
      setShowForm(false)
      setForm({ product: 'Riz paddy', quantity: '', unit: 'tonne', region: '' })
      load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const disable = async (id) => {
    setBusyId(id)
    try {
      await api.delete(`${endpoint}/${id}`)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  // LOT B2B-DEBLOCAGE (phase 1 post-audit) : PUT /offers/:id acceptait déjà
  // status=AVAILABLE (aucun changement backend requis), mais rien dans cette
  // vue ne le proposait — une offre RESERVED (déclaration partielle, stock
  // restant > 0) devient invisible dans GET /b2b/offers (filtré sur
  // status=AVAILABLE) et y restait indéfiniment, sans action de déblocage.
  const unlock = async (id) => {
    setBusyId(id)
    try {
      await api.put(`${endpoint}/${id}`, { status: 'AVAILABLE' })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-playfair text-2xl font-bold text-charcoal">
          Mes {isOffer ? 'offres' : 'demandes'}
        </h1>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 bg-forest text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-2xl hover:bg-forest-dark transition-colors">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Annuler' : `Publier une ${meta.listingLabel}`}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border-2 border-charcoal/10 rounded-3xl p-6 space-y-4">
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="font-dm text-sm text-red-600">{formError}</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Produit</label>
              <select value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))}
                className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm">
                {RICE_PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Unité</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm">
                {RICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Quantité</label>
              <input type="number" min="0" step="0.1" required value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm" />
            </div>
            <div>
              <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Région</label>
              <input required list="regions" value={form.region}
                onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm" />
              <datalist id="regions">{CI_REGIONS.map(r => <option key={r} value={r} />)}</datalist>
            </div>
          </div>
          {isOffer ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Variété (optionnel)</label>
                <input value={form.variety || ''} onChange={e => setForm(f => ({ ...f, variety: e.target.value }))}
                  className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm" />
              </div>
              <div>
                <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Prix / unité (optionnel)</label>
                <input type="number" min="0" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm" />
              </div>
              <div>
                <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">MOQ — quantité minimale de commande (optionnel)</label>
                <input type="number" min="0" step="0.1" value={form.minOrderQty || ''} onChange={e => setForm(f => ({ ...f, minOrderQty: e.target.value }))}
                  placeholder={`Ex : 500`}
                  className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm" />
                <p className="font-dm text-[11px] text-charcoal/40 mt-1">En {form.unit} — un acheteur ne peut pas commander moins que ce seuil.</p>
              </div>
              {/* LOT AUDIT-OWN-01 (audit XXX RIZ) : gap confirmé — une offre
                  coopérative n'avait aucun moyen d'indiquer qu'elle appartient
                  à un membre précis plutôt qu'à la coopérative elle-même. */}
              {isCooperative && (
                <div className="sm:col-span-2">
                  <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Propriétaire de la marchandise</label>
                  <select value={form.ownerProducerId || ''} onChange={e => setForm(f => ({ ...f, ownerProducerId: e.target.value }))}
                    className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm">
                    <option value="">Coopérative</option>
                    {members.map(m => <option key={m.producer.id} value={m.producer.id}>{m.producer.user?.name} ({m.producer.region})</option>)}
                  </select>
                  <p className="font-dm text-[11px] text-charcoal/40 mt-1">Laissez "Coopérative" si la marchandise n'appartient pas à un membre en particulier.</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Exigences (optionnel)</label>
              <textarea rows={2} value={form.requirements || ''} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
                className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm resize-none" />
            </div>
          )}
          <button type="submit" disabled={submitting}
            className="bg-forest text-cream font-syne font-bold px-6 py-3 rounded-2xl hover:bg-forest-dark transition-colors disabled:opacity-50">
            {submitting ? 'Publication…' : 'Publier'}
          </button>
        </form>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <Package className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucune {meta.listingLabel} publiée pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-charcoal/10 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-syne font-bold text-charcoal">{item.product} — {fmt(item.quantity)} {item.unit}</p>
                <p className="font-dm text-sm text-charcoal/40">
                  {item.region}
                  {item.minOrderQty != null && ` · MOQ ${fmt(item.minOrderQty)} ${item.unit}`}
                  {isCooperative && isOffer && ` · Propriétaire : ${item.ownerProducer ? item.ownerProducer.user.name : 'Coopérative'}`}
                </p>
                {isOffer && item.moderationStatus === 'PENDING_REVIEW' && (
                  <p className="mt-1 font-syne text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 inline-block">
                    ⏳ En attente de validation admin
                  </p>
                )}
                {isOffer && item.moderationStatus === 'REJECTED' && (
                  <p className="mt-1 font-dm text-[10px] text-red-500">✕ Refusé : {item.rejectionReason}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-syne text-xs font-bold px-3 py-1.5 rounded-full bg-charcoal/5 text-charcoal/60">
                  {statusLabels[item.status] || item.status}
                </span>
                {isOffer && item.status === 'RESERVED' && item.quantity > 0 && (
                  <button onClick={() => unlock(item.id)} disabled={busyId === item.id}
                    className="font-syne text-xs font-bold text-forest hover:text-forest-dark disabled:opacity-50">
                    {busyId === item.id ? '…' : 'Remettre disponible'}
                  </button>
                )}
                {!['DISABLED', 'CANCELLED', 'SOLD', 'FULFILLED'].includes(item.status) && (
                  <button onClick={() => disable(item.id)} disabled={busyId === item.id}
                    className="font-syne text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50">
                    {busyId === item.id ? '…' : 'Désactiver'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
