import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Eye } from 'lucide-react'
import { api } from '../../api/client'
import { fmt, fmtDate, fmtOrderId } from '../../utils/status'

const STATUSES = [
  { value: '',                 label: 'Tous' },
  { value: 'OPEN',             label: 'Ouverts' },
  { value: 'UNDER_REVIEW',     label: 'En examen' },
  { value: 'RESOLVED_REFUND',  label: 'Remboursés' },
  { value: 'RESOLVED_REJECTED',label: 'Refusés' },
  { value: 'CLOSED',           label: 'Clôturés' },
]

const STATUS_UI = {
  OPEN:              { label: 'Ouvert',           color: 'bg-orange-100 text-orange-700',  dot: 'bg-orange-500',  icon: AlertTriangle },
  UNDER_REVIEW:      { label: 'En examen',        color: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500',    icon: Clock },
  RESOLVED_REFUND:   { label: 'Remboursé',        color: 'bg-green-100 text-green-700',    dot: 'bg-green-500',   icon: CheckCircle },
  RESOLVED_REJECTED: { label: 'Refusé',           color: 'bg-red-100 text-red-700',        dot: 'bg-red-500',     icon: XCircle },
  CLOSED:            { label: 'Clôturé',          color: 'bg-charcoal/8 text-charcoal/60',      dot: 'bg-gray-400',    icon: X },
}

const REASONS = {
  PRODUCT_NOT_RECEIVED: 'Produit non reçu',
  PRODUCT_DAMAGED:      'Produit endommagé',
  WRONG_PRODUCT:        'Mauvais produit livré',
  DELIVERY_ISSUE:       'Problème de livraison',
  OTHER:                'Autre',
}

const RESOLVE_STATUSES = [
  { value: 'UNDER_REVIEW',      label: '🔍 Passer en examen' },
  { value: 'RESOLVED_REFUND',   label: '💰 Accorder un remboursement' },
  { value: 'RESOLVED_REJECTED', label: '❌ Refuser le litige' },
  { value: 'CLOSED',            label: '🔒 Clôturer' },
]

// ── Modal résolution ──────────────────────────────────────────────────────────
function ResolveModal({ dispute, onClose, onSaved }) {
  const [status, setStatus]           = useState(dispute.status === 'OPEN' ? 'UNDER_REVIEW' : dispute.status)
  const [refundAmount, setRefundAmount] = useState(dispute.refundAmount || 0)
  const [resolution, setResolution]   = useState(dispute.resolution || '')
  const [restock, setRestock]         = useState(null) // true | false | null (pas encore choisi)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  const needsRefund = status === 'RESOLVED_REFUND'
  // Le choix de restockage n'a d'effet qu'à la PREMIÈRE résolution en
  // remboursement — déjà résolu = on ne fait qu'éditer montant/note, le
  // stock (déjà traité) n'est jamais rejoué.
  const alreadyResolved = Boolean(dispute.resolvedAt)
  const needsRestockChoice = needsRefund && !alreadyResolved

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (needsRefund && (!refundAmount || Number(refundAmount) <= 0)) {
      setError('Saisissez un montant de remboursement positif.')
      return
    }
    if (needsRestockChoice && restock === null) {
      setError('Précisez si l\'article doit être remis en stock.')
      return
    }
    setLoading(true); setError('')
    try {
      await api.put(`/disputes/${dispute.id}/resolve`, {
        status,
        refundAmount: needsRefund ? Number(refundAmount) : 0,
        resolution: resolution.trim() || null,
        ...(needsRestockChoice ? { restock } : {}),
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal/6">
          <div>
            <p className="text-xs text-charcoal/40 font-medium">Litige #{dispute.id} · Commande {fmtOrderId(dispute.orderId)}</p>
            <h3 className="font-bold text-charcoal">Traiter le litige</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-charcoal/8 rounded-lg transition-colors">
            <X size={18} className="text-charcoal/50" />
          </button>
        </div>

        {/* Recap */}
        <div className="px-6 py-4 bg-orange-50 border-b border-orange-100">
          <p className="text-sm font-bold text-orange-800 mb-0.5">{REASONS[dispute.reason]}</p>
          <p className="text-xs text-orange-700/80 leading-relaxed">{dispute.description}</p>
          <div className="flex gap-4 mt-3 text-xs text-orange-700/70">
            <span>Acheteur : <strong>{dispute.buyer?.name}</strong></span>
            <span>Boutique : <strong>{dispute.order?.shop?.name}</strong></span>
            <span>Total cde : <strong>{fmt(dispute.order?.total)} F</strong></span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nouveau statut */}
          <div>
            <label className="block text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-2">Décision *</label>
            <div className="space-y-2">
              {RESOLVE_STATUSES.map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  status === opt.value ? 'border-forest bg-forest/5' : 'border-charcoal/10 hover:border-gray-300'
                }`}>
                  <input type="radio" name="status" value={opt.value}
                    checked={status === opt.value} onChange={() => setStatus(opt.value)}
                    className="sr-only" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    status === opt.value ? 'border-forest' : 'border-gray-300'
                  }`}>
                    {status === opt.value && <div className="w-2 h-2 rounded-full bg-forest" />}
                  </div>
                  <span className="text-sm text-charcoal/80">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Montant remboursement */}
          <AnimatePresence>
            {needsRefund && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <label className="block text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-2">
                  Montant à rembourser (FCFA) *
                </label>
                <div className="relative">
                  <input type="number" min="1" max={dispute.order?.total || 999999}
                    value={refundAmount}
                    onChange={e => setRefundAmount(e.target.value)}
                    placeholder="Ex: 5000"
                    className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-forest transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-charcoal/40 font-bold">FCFA</span>
                </div>
                <p className="text-xs text-charcoal/40 mt-1">Total de la commande : {fmt(dispute.order?.total)} F</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Restockage — décision explicite, jamais automatique selon le motif */}
          <AnimatePresence>
            {needsRestockChoice && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <label className="block text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-2">
                  L'article doit-il être remis en stock ? *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    restock === true ? 'border-forest bg-forest/5 text-forest' : 'border-charcoal/10 text-charcoal/60 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="restock" checked={restock === true} onChange={() => setRestock(true)} className="sr-only" />
                    <span className="text-sm font-bold">Oui, article retourné</span>
                  </label>
                  <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    restock === false ? 'border-red-400 bg-red-50 text-red-600' : 'border-charcoal/10 text-charcoal/60 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="restock" checked={restock === false} onChange={() => setRestock(false)} className="sr-only" />
                    <span className="text-sm font-bold">Non {dispute.reason === 'PRODUCT_DAMAGED' ? '(endommagé)' : ''}</span>
                  </label>
                </div>
                <p className="text-xs text-charcoal/40 mt-1.5">
                  {dispute.reason === 'PRODUCT_DAMAGED'
                    ? 'Un produit endommagé n\'est normalement pas remis en vente.'
                    : 'Ce choix est définitif : il ne pourra pas être rejoué en modifiant la décision ensuite.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {alreadyResolved && needsRefund && (
            <div className="bg-charcoal/3 rounded-xl p-3">
              <p className="text-xs text-charcoal/50">
                Le stock a déjà été traité pour ce litige ({dispute.resolvedAt ? 'résolu le ' + fmtDate(dispute.resolvedAt) : ''}) — modifier le montant ou la note n'y touchera pas.
              </p>
            </div>
          )}

          {/* Note de résolution */}
          <div>
            <label className="block text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-2">
              Note de résolution <span className="text-charcoal/30 normal-case font-normal">(optionnel)</span>
            </label>
            <textarea rows={3}
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              placeholder="Message affiché à l'acheteur dans sa notification…"
              className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-forest transition-colors"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-forest text-white font-bold py-3 rounded-xl hover:bg-forest-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enregistrement…</>
              : 'Valider la décision'
            }
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Ligne de litige ───────────────────────────────────────────────────────────
function DisputeRow({ dispute, onResolve }) {
  const [open, setOpen] = useState(false)
  const s = STATUS_UI[dispute.status] || STATUS_UI.OPEN
  const StatusIcon = s.icon

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-charcoal/6 overflow-hidden">
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-charcoal/2 transition-colors" onClick={() => setOpen(v => !v)}>
        {/* Status */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${s.color}`}>
          <StatusIcon size={12} />
          {s.label}
        </div>

        {/* Info principale */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-charcoal text-sm">#{dispute.id} · {fmtOrderId(dispute.orderId)}</span>
            <span className="text-xs text-charcoal/40 truncate hidden sm:block">— {REASONS[dispute.reason]}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-charcoal/50">{dispute.buyer?.name}</span>
            <span className="text-xs text-charcoal/40">·</span>
            <span className="text-xs text-charcoal/50">{dispute.order?.shop?.name}</span>
            <span className="text-xs text-charcoal/40">·</span>
            <span className="text-xs text-charcoal/40">{fmtDate(dispute.createdAt)}</span>
          </div>
        </div>

        {/* Montant */}
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-sm font-bold text-charcoal">{fmt(dispute.order?.total)} F</p>
          {dispute.refundAmount > 0 && (
            <p className="text-xs text-green-600 font-bold">Remb. {fmt(dispute.refundAmount)} F</p>
          )}
        </div>

        {/* Toggle */}
        <div className="shrink-0 text-charcoal/40">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-charcoal/6 pt-4 space-y-4">
              {/* Détails acheteur */}
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="font-bold text-charcoal/40 tracking-wider uppercase mb-1">Acheteur</p>
                  <p className="text-charcoal/80 font-bold">{dispute.buyer?.name}</p>
                  <p className="text-charcoal/50">{dispute.buyer?.email}</p>
                  {dispute.buyer?.phone && <p className="text-charcoal/50">{dispute.buyer.phone}</p>}
                </div>
                <div>
                  <p className="font-bold text-charcoal/40 tracking-wider uppercase mb-1">Commande</p>
                  <p className="text-charcoal/80 font-bold">{fmtOrderId(dispute.orderId)}</p>
                  <p className="text-charcoal/50">Total : {fmt(dispute.order?.total)} F</p>
                  <p className="text-charcoal/50">Livraison : {fmt(dispute.order?.deliveryFee)} F</p>
                </div>
                <div>
                  <p className="font-bold text-charcoal/40 tracking-wider uppercase mb-1">Motif</p>
                  <p className="text-charcoal/80 font-bold">{REASONS[dispute.reason]}</p>
                  <p className="text-charcoal/40 mt-1">Ouvert le {fmtDate(dispute.createdAt)}</p>
                  {dispute.resolvedAt && <p className="text-charcoal/40">Résolu le {fmtDate(dispute.resolvedAt)}</p>}
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-bold text-charcoal/40 tracking-wider uppercase mb-1">Description du problème</p>
                <p className="text-sm text-charcoal/80 leading-relaxed bg-charcoal/3 rounded-xl p-3">{dispute.description}</p>
              </div>

              {/* Résolution existante */}
              {dispute.resolution && (
                <div>
                  <p className="text-xs font-bold text-charcoal/40 tracking-wider uppercase mb-1">Note de résolution</p>
                  <p className="text-sm text-charcoal/80 italic bg-green-50 rounded-xl p-3">"{dispute.resolution}"</p>
                </div>
              )}

              {/* Action */}
              {!['RESOLVED_REFUND', 'RESOLVED_REJECTED', 'CLOSED'].includes(dispute.status) ? (
                <button onClick={() => onResolve(dispute)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-forest text-white rounded-xl text-sm font-bold hover:bg-forest-light transition-colors">
                  <Eye size={14} /> Traiter ce litige
                </button>
              ) : (
                <button onClick={() => onResolve(dispute)}
                  className="flex items-center gap-2 px-5 py-2.5 border-2 border-charcoal/10 text-charcoal/60 rounded-xl text-sm font-bold hover:border-gray-300 transition-colors">
                  Modifier la décision
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────
export default function DisputesAdminTab() {
  const [disputes, setDisputes]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('')
  const [resolving, setResolving] = useState(null) // dispute sélectionné

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = filter ? `?status=${filter}` : ''
      const data = await api.get(`/disputes${qs}`)
      setDisputes(data.disputes || [])
    } catch {
      setDisputes([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  // Counts par statut pour les badges de filtre
  const counts = disputes.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1
    return acc
  }, {})

  const openCount = disputes.filter(d => d.status === 'OPEN').length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-charcoal">Litiges & remboursements</h2>
          <p className="text-sm text-charcoal/50 mt-0.5">
            {disputes.length} litige{disputes.length !== 1 ? 's' : ''}
            {openCount > 0 && <span className="ml-2 bg-orange-100 text-orange-700 font-bold text-xs px-2 py-0.5 rounded-full">{openCount} ouvert{openCount > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-charcoal/10 rounded-xl text-sm font-bold text-charcoal/60 hover:bg-charcoal/3 transition-colors shadow-sm">
          🔄 Rafraîchir
        </button>
      </div>

      {/* Filtres par statut */}
      <div className="flex gap-2 flex-wrap mb-6">
        {STATUSES.map(s => (
          <button key={s.value} onClick={() => setFilter(s.value)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
              filter === s.value
                ? 'bg-forest text-white border-forest'
                : 'bg-white text-charcoal/60 border-charcoal/10 hover:border-gray-300'
            }`}>
            {s.label}
            {s.value && counts[s.value] ? (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                filter === s.value ? 'bg-white/20 text-white' : 'bg-charcoal/8 text-charcoal/50'
              }`}>{counts[s.value]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Ouverts',    count: disputes.filter(d => d.status === 'OPEN').length,              color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'En examen',  count: disputes.filter(d => d.status === 'UNDER_REVIEW').length,      color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Remboursés', count: disputes.filter(d => d.status === 'RESOLVED_REFUND').length,   color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Refusés',    count: disputes.filter(d => d.status === 'RESOLVED_REJECTED').length, color: 'text-red-600',    bg: 'bg-red-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-4`}>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
            <p className="text-xs text-charcoal/50 font-bold mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-20 animate-pulse border border-charcoal/6" />
          ))}
        </div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-20">
          <AlertTriangle size={40} className="mx-auto text-gray-200 mb-4" />
          <p className="font-bold text-charcoal/40">Aucun litige{filter ? ' pour ce filtre' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map(d => (
            <DisputeRow key={d.id} dispute={d} onResolve={setResolving} />
          ))}
        </div>
      )}

      {/* Modal résolution */}
      <AnimatePresence>
        {resolving && (
          <ResolveModal
            dispute={resolving}
            onClose={() => setResolving(null)}
            onSaved={() => { setResolving(null); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
