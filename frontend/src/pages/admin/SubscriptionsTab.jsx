import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/client'
import { fmt, fmtDate, fmtShopId, fmtDriverId } from '../../utils/status'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Edit2, Trash2, Check, AlertCircle, CreditCard, XCircle, Crown, CheckCircle, Clock } from 'lucide-react'

const PLAN_BADGE = {
  CERTIFIED: 'bg-[#E8A217]/15 text-[#E8A217]',
  BASIC:     'bg-gray-100 text-gray-500',
}

const STATUS_BADGE = {
  ACTIVE:    'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-50 text-red-500',
  EXPIRED:   'bg-gray-100 text-gray-400',
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ sub, onClose, onSaved }) {
  const [plan, setPlan]     = useState(sub.plan)
  const [status, setStatus] = useState(sub.status)
  const [amount, setAmount] = useState(sub.amount)
  const [endDate, setEndDate] = useState(sub.endDate ? sub.endDate.slice(0, 10) : '')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const updated = await api.put(`/admin/subscriptions/${sub.id}`, { plan, status, amount: Number(amount), endDate: endDate || null })
      onSaved(updated)
      onClose()
    } catch (e) {
      setError(e.message || 'Erreur')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-playfair text-xl font-bold text-charcoal">Modifier l'abonnement</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
            <X size={14} />
          </button>
        </div>
        <p className="font-syne text-sm font-bold text-charcoal/60">{sub.shop?.name}</p>

        <div className="space-y-4">
          <div>
            <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1.5">Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest">
              <option value="BASIC">BASIC</option>
              <option value="CERTIFIED">CERTIFIED</option>
            </select>
          </div>
          <div>
            <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1.5">Statut</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest">
              <option value="ACTIVE">ACTIVE</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="EXPIRED">EXPIRED</option>
            </select>
          </div>
          <div>
            <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1.5">Montant (FCFA)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
          </div>
          <div>
            <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1.5">Date d'expiration</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="font-dm text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-syne text-sm font-bold text-charcoal/60 hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-forest text-white font-syne text-sm font-bold hover:bg-forest/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={15} />}
            Enregistrer
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Create Modal ──────────────────────────────────────────────────────────────
function CreateModal({ shops, planPrices, onClose, onCreated }) {
  const [shopId, setShopId]   = useState('')
  const [plan, setPlan]       = useState('CERTIFIED')
  const [amount, setAmount]   = useState(planPrices.certifiedPlanPrice ?? 15000)
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  const handlePlanChange = (p) => {
    setPlan(p)
    setAmount(p === 'CERTIFIED' ? (planPrices.certifiedPlanPrice ?? 15000) : (planPrices.basicPlanPrice ?? 0))
  }

  const save = async () => {
    if (!shopId) return setError('Sélectionnez une boutique')
    setSaving(true); setError(null)
    try {
      const sub = await api.post('/admin/subscriptions', { shopId: Number(shopId), plan, amount: Number(amount), endDate: endDate || null })
      onCreated(sub)
      onClose()
    } catch (e) {
      setError(e.message || 'Erreur')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-playfair text-xl font-bold text-charcoal">Nouvel abonnement</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1.5">Boutique</label>
            <select value={shopId} onChange={e => setShopId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest">
              <option value="">— Sélectionner —</option>
              {shops.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1.5">Plan</label>
            <select value={plan} onChange={e => handlePlanChange(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest">
              <option value="BASIC">BASIC (gratuit)</option>
              <option value="CERTIFIED">CERTIFIED ({fmt(planPrices.certifiedPlanPrice ?? 15000)} FCFA/an)</option>
            </select>
          </div>
          <div>
            <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1.5">Montant (FCFA)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
          </div>
          <div>
            <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1.5">Date d'expiration (optionnel)</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="font-dm text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-syne text-sm font-bold text-charcoal/60 hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-forest text-white font-syne text-sm font-bold hover:bg-forest/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={15} />}
            Créer
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const REQ_STATUS_BADGE = {
  PENDING:  'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
}
const REQ_STATUS_LABEL = { PENDING: 'En attente', APPROVED: 'Approuvée', REJECTED: 'Refusée' }

// ─── Approve Modal ──────────────────────────────────────────────────────────────
function ApproveModal({ request, onClose, onDone }) {
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const confirm = async () => {
    setSaving(true); setError(null)
    try {
      await api.put(`/admin/plan-requests/${request.id}/approve`, { adminNote: note || undefined })
      onDone(); onClose()
    } catch (e) { setError(e.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const isShop   = request.type === 'SHOP'
  const name     = isShop ? request.shop?.name : (request.driver?.user?.name || fmtDriverId(request.driverId))
  const ownerName  = isShop ? request.shop?.user?.name  : request.driver?.user?.name
  const ownerEmail = isShop ? request.shop?.user?.email : request.driver?.user?.email
  const ownerPhone = isShop ? (request.shop?.user?.phone || request.shop?.phone) : request.driver?.user?.phone
  const location   = isShop ? request.shop?.location : null
  const vehicle    = !isShop ? [request.driver?.vehicleType, request.driver?.vehiclePlate].filter(Boolean).join(' · ') : null
  const entityId   = isShop ? fmtShopId(request.shopId) : fmtDriverId(request.driverId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-playfair text-xl font-bold text-charcoal">Approuver la demande</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={14} /></button>
        </div>

        {/* Résumé de la demande */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-syne text-sm font-bold text-charcoal">{name}</p>
              <p className="font-dm text-xs text-charcoal/50">{entityId}</p>
            </div>
            <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full ${isShop ? 'bg-forest/10 text-forest' : 'bg-blue-100 text-blue-700'}`}>
              {isShop ? 'Boutique' : 'Livreur'}
            </span>
          </div>
          <div className="border-t border-green-200 pt-3 grid grid-cols-2 gap-2 text-xs font-dm text-charcoal/60">
            {ownerName  && <div><span className="font-syne font-bold uppercase tracking-wider text-charcoal/30 text-[10px] block">Propriétaire</span>{ownerName}</div>}
            {ownerPhone && <div><span className="font-syne font-bold uppercase tracking-wider text-charcoal/30 text-[10px] block">Téléphone</span>{ownerPhone}</div>}
            {ownerEmail && <div className="col-span-2"><span className="font-syne font-bold uppercase tracking-wider text-charcoal/30 text-[10px] block">Email</span>{ownerEmail}</div>}
            {location   && <div className="col-span-2"><span className="font-syne font-bold uppercase tracking-wider text-charcoal/30 text-[10px] block">Localisation</span>{location}</div>}
            {vehicle    && <div className="col-span-2"><span className="font-syne font-bold uppercase tracking-wider text-charcoal/30 text-[10px] block">Véhicule</span>{vehicle}</div>}
          </div>
          <div className="border-t border-green-200 pt-3 flex items-center justify-between">
            <span className="font-syne text-xs text-charcoal/50">{request.fromPlan} → <strong className="text-charcoal">{request.toPlan}</strong></span>
            <span className="font-playfair font-bold text-charcoal">{fmt(request.amount)} FCFA/{request.billingPeriod === 'annual' ? 'an' : 'mois'}</span>
          </div>
          {request.note && (
            <div className="bg-white rounded-xl px-3 py-2 border border-green-200">
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/30 mb-1">Message du demandeur</p>
              <p className="font-dm text-xs text-charcoal/70 italic">"{request.note}"</p>
            </div>
          )}
        </div>

        <div>
          <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-2">Note de confirmation (optionnelle)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Message envoyé au vendeur/livreur..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-forest resize-none" />
        </div>
        {error && <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2"><AlertCircle size={14} className="text-red-500 shrink-0" /><p className="font-dm text-sm text-red-600">{error}</p></div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-syne text-sm font-bold text-charcoal/60 hover:bg-gray-50 transition-colors">Annuler</button>
          <button onClick={confirm} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-syne text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={15} />}
            Confirmer le paiement et approuver
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Reject Modal ──────────────────────────────────────────────────────────────
function RejectModal({ request, onClose, onDone }) {
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  const confirm = async () => {
    if (!adminNote.trim()) return setError('Le motif de refus est requis.')
    setSaving(true); setError(null)
    try {
      await api.put(`/admin/plan-requests/${request.id}/reject`, { adminNote })
      onDone(); onClose()
    } catch (e) { setError(e.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const name = request.type === 'SHOP' ? request.shop?.name : (request.driver?.user?.name || fmtDriverId(request.driverId))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-playfair text-xl font-bold text-charcoal">Refuser la demande</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={14} /></button>
        </div>
        <div className="bg-red-50 rounded-2xl p-4">
          <p className="font-syne text-sm font-bold text-charcoal">{name}</p>
          <p className="font-dm text-xs text-charcoal/50 mt-0.5">
            {request.type === 'SHOP' ? 'Boutique' : 'Livreur'} · {request.fromPlan} → {request.toPlan} · {fmt(request.amount)} FCFA/{request.billingPeriod === 'annual' ? 'an' : 'mois'}
          </p>
        </div>
        <div>
          <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-2">
            Motif du refus <span className="text-red-400">*</span>
          </label>
          <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={3}
            placeholder="Ex : Paiement non reçu, document manquant..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-red-400 resize-none" />
        </div>
        {error && <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2"><AlertCircle size={14} className="text-red-500 shrink-0" /><p className="font-dm text-sm text-red-600">{error}</p></div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-syne text-sm font-bold text-charcoal/60 hover:bg-gray-50 transition-colors">Annuler</button>
          <button onClick={confirm} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-syne text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <XCircle size={15} />}
            Refuser
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Requests Sub-tab ──────────────────────────────────────────────────────────
function PlanRequestsTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [statusF, setStatusF]   = useState('PENDING')
  const [typeF, setTypeF]       = useState('')
  const [approving, setApproving] = useState(null)
  const [rejecting, setRejecting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusF) params.set('status', statusF)
      if (typeF)   params.set('type', typeF)
      const data = await api.get(`/admin/plan-requests?${params}`)
      setRequests(data.requests ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [statusF, typeF])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setStatusF(s)}
            className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${statusF === s ? 'bg-charcoal text-white border-charcoal' : 'border-charcoal/15 text-charcoal/50 hover:border-charcoal/30'}`}>
            {s === '' ? 'Tous les statuts' : REQ_STATUS_LABEL[s]}
          </button>
        ))}
        <div className="w-px h-5 bg-charcoal/15 mx-1" />
        {['', 'SHOP', 'DRIVER'].map(t => (
          <button key={t} onClick={() => setTypeF(t)}
            className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${typeF === t ? 'bg-charcoal text-white border-charcoal' : 'border-charcoal/15 text-charcoal/50 hover:border-charcoal/30'}`}>
            {t === '' ? 'Tous' : t === 'SHOP' ? 'Boutiques' : 'Livreurs'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal/6">
                {['Demandeur', 'Type', 'Plan demandé', 'Montant', 'Message', 'Date', 'Statut', ''].map(h => (
                  <th key={h} className="px-5 py-4 text-left font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {requests.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-16 text-center font-dm text-charcoal/40">Aucune demande</td></tr>
              ) : requests.map(r => {
                const name = r.type === 'SHOP'
                  ? r.shop?.name || fmtShopId(r.shopId)
                  : r.driver?.user?.name || fmtDriverId(r.driverId)
                const email = r.type === 'SHOP' ? r.shop?.user?.email : r.driver?.user?.email
                return (
                  <tr key={r.id} className="hover:bg-charcoal/2 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-syne text-sm font-bold text-charcoal">{name}</p>
                      {email && <p className="font-dm text-xs text-charcoal/40">{email}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full ${r.type === 'SHOP' ? 'bg-forest/10 text-forest' : 'bg-blue-100 text-blue-700'}`}>
                        {r.type === 'SHOP' ? 'Boutique' : 'Livreur'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-syne text-xs font-bold">
                        {r.fromPlan} → <span className="text-safran">{r.toPlan}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-playfair font-bold text-charcoal">{r.amount ? `${fmt(r.amount)} F` : '—'}</span>
                      {r.billingPeriod && <span className="ml-1 font-dm text-[10px] text-charcoal/40">/{r.billingPeriod === 'annual' ? 'an' : 'mois'}</span>}
                    </td>
                    <td className="px-5 py-4 font-dm text-xs text-charcoal/50 max-w-[140px] truncate">{r.note || '—'}</td>
                    <td className="px-5 py-4 font-dm text-xs text-charcoal/50">{fmtDate(r.createdAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full ${REQ_STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-500'}`}>
                        {REQ_STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {r.status === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setApproving(r)}
                            className="flex items-center gap-1.5 bg-green-50 text-green-700 font-syne text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors">
                            <CheckCircle size={12} /> Approuver
                          </button>
                          <button onClick={() => setRejecting(r)}
                            className="flex items-center gap-1.5 bg-red-50 text-red-600 font-syne text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                            <XCircle size={12} /> Refuser
                          </button>
                        </div>
                      )}
                      {r.status === 'REJECTED' && r.adminNote && (
                        <p className="font-dm text-xs text-charcoal/40 max-w-[140px] truncate" title={r.adminNote}>{r.adminNote}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {approving && <ApproveModal request={approving} onClose={() => setApproving(null)} onDone={load} />}
        {rejecting && <RejectModal  request={rejecting} onClose={() => setRejecting(null)} onDone={load} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Tab ──────────────────────────────────────────────────────────────────
export default function SubscriptionsTab() {
  const [view, setView]           = useState('subs')
  const [subs, setSubs]           = useState([])
  const [shops, setShops]         = useState([])
  const [planPrices, setPlanPrices] = useState({ basicPlanPrice: 0, certifiedPlanPrice: 15000 })
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(null)
  const [creating, setCreating]   = useState(false)
  const [cancelling, setCancelling] = useState(null)
  const [cancelError, setCancelError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [subsData, shopsData, prices] = await Promise.all([
        api.get('/admin/subscriptions'),
        api.get('/admin/shops'),
        api.get('/admin/settings/plans'),
      ])
      setSubs(subsData)
      setShops((shopsData.shops || []).filter(s => s.status === 'ACTIVE'))
      setPlanPrices(prices)
    } catch (e) {
      console.error('Subscriptions load error:', e)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCancel = async (id) => {
    setCancelling(id); setCancelError(null)
    try {
      await api.delete(`/admin/subscriptions/${id}`)
      setSubs(prev => prev.map(s => s.id === id ? { ...s, status: 'CANCELLED' } : s))
    } catch (e) {
      setCancelError(e.message || 'Erreur lors de l\'annulation')
    } finally { setCancelling(null) }
  }

  const handleSaved = (updated) => {
    setSubs(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  const handleCreated = (sub) => {
    load()
  }

  const active  = subs.filter(s => s.status === 'ACTIVE')
  const total   = active.reduce((sum, s) => sum + s.amount, 0)
  const certified = subs.filter(s => s.plan === 'CERTIFIED' && s.status === 'ACTIVE').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Revenus</p>
          <h1 className="font-playfair text-4xl font-bold text-charcoal">Abonnements</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle */}
          <div className="flex items-center bg-charcoal/6 rounded-xl p-1 gap-1">
            <button onClick={() => setView('subs')}
              className={`font-syne text-xs font-bold px-4 py-2 rounded-lg transition-all ${view === 'subs' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/50 hover:text-charcoal'}`}>
              Abonnements
            </button>
            <button onClick={() => setView('requests')}
              className={`font-syne text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${view === 'requests' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/50 hover:text-charcoal'}`}>
              <Crown size={12} /> Demandes de plan
            </button>
          </div>
          {view === 'subs' && <button onClick={() => setCreating(true)}
              className="flex items-center gap-2 bg-forest text-white font-syne text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-forest/90 transition-colors">
              <Plus size={16} />
              Nouvel abonnement
            </button>}
        </div>
      </div>

      {view === 'requests' && <PlanRequestsTab />}
      {view !== 'requests' && (<>

      {cancelError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <XCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{cancelError}</p>
          <button onClick={() => setCancelError(null)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}

      {/* Plan prices info */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-6">
        <CreditCard size={16} className="text-charcoal/30 shrink-0" />
        <div className="flex gap-8">
          <div>
            <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40">Plan BASIC</p>
            <p className="font-playfair font-bold text-charcoal">{planPrices.basicPlanPrice === 0 ? 'Gratuit' : `${fmt(planPrices.basicPlanPrice)} FCFA/an`}</p>
          </div>
          <div>
            <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40">Plan CERTIFIED</p>
            <p className="font-playfair font-bold text-[#E8A217]">{fmt(planPrices.certifiedPlanPrice)} FCFA/an</p>
          </div>
          <div>
            <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40">Abonnement livreur</p>
            <p className="font-playfair font-bold text-charcoal">{fmt(planPrices.driverSubPrice)} FCFA/mois</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Actifs',       value: active.length,            color: 'text-green-600' },
          { label: 'Total annuel', value: `${fmt(total)} FCFA`,     color: 'text-forest' },
          { label: 'Certifiés',   value: certified,                 color: 'text-gold' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-3xl p-6 shadow-card">
            <p className="font-syne text-xs font-bold uppercase tracking-widest text-charcoal/40 mb-2">{label}</p>
            <p className={`font-playfair text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal/6">
                {['Boutique', 'Propriétaire', 'Plan', 'Montant', 'Statut', 'Début', 'Fin', ''].map(h => (
                  <th key={h} className="px-5 py-4 text-left font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {subs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center font-dm text-charcoal/40">Aucun abonnement</td>
                </tr>
              ) : subs.map(s => (
                <tr key={s.id} className="hover:bg-charcoal/2 transition-colors">
                  <td className="px-5 py-4 font-syne text-sm font-bold text-charcoal">{s.shop?.name}</td>
                  <td className="px-5 py-4">
                    <p className="font-dm text-sm text-charcoal">{s.shop?.user?.name}</p>
                    <p className="font-dm text-xs text-charcoal/40">{s.shop?.user?.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${PLAN_BADGE[s.plan] || 'bg-gray-100 text-gray-500'}`}>
                      {s.plan}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-playfair text-lg font-bold text-charcoal">{fmt(s.amount)} F</td>
                  <td className="px-5 py-4">
                    <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${STATUS_BADGE[s.status] || 'bg-gray-100 text-gray-400'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-dm text-xs text-charcoal/50">{fmtDate(s.startDate)}</td>
                  <td className="px-5 py-4 font-dm text-xs text-charcoal/50">{s.endDate ? fmtDate(s.endDate) : '—'}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditing(s)} title="Modifier"
                        className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-forest/10 hover:text-forest flex items-center justify-center transition-colors">
                        <Edit2 size={13} />
                      </button>
                      {s.status === 'ACTIVE' && (
                        <button onClick={() => handleCancel(s.id)} disabled={cancelling === s.id} title="Annuler"
                          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors disabled:opacity-50">
                          {cancelling === s.id
                            ? <div className="w-3 h-3 border border-red-300 border-t-red-500 rounded-full animate-spin" />
                            : <Trash2 size={13} />
                          }
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <EditModal
            sub={editing}
            onClose={() => setEditing(null)}
            onSaved={handleSaved}
          />
        )}
        {creating && (
          <CreateModal
            shops={shops}
            planPrices={planPrices}
            onClose={() => setCreating(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
      </>)}
    </div>
  )
}
