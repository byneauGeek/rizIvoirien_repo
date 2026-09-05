import { useEffect, useState, useCallback, useRef, Fragment } from 'react'
import { ChevronLeft, ChevronRight, Truck, AlertCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../api/client'
import { STATUS_LABELS, STATUS_COLORS, STATUS_DOT, fmt, fmtDate, fmtOrderId } from '../../utils/status'

const STATUSES = ['', 'PENDING', 'CONFIRMED', 'EN_PREPARATION', 'PRET', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']
const LIMIT = 20
const ASSIGN_FILTER = '__to_assign__'

const rateBarColor = r =>
  r >= 0.7 ? 'bg-forest-light' : r >= 0.5 ? 'bg-amber-400' : r >= 0.3 ? 'bg-orange-500' : 'bg-red-500'

// ── Modal d'assignation ────────────────────────────────────────────────────

function AssignmentModal({ order, onClose, onSuccess }) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading]       = useState(true)
  const [assigning, setAssigning]   = useState(false)
  const [error, setError]           = useState(null)
  const [groupMode, setGroupMode]   = useState(false)
  const [groupOrders, setGroupOrders] = useState([])

  useEffect(() => {
    api.get(`/admin/orders/${order.id}/candidates`)
      .then(d => setCandidates(d.candidates ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [order.id])

  useEffect(() => {
    if (!order.groupId) return
    api.get(`/admin/orders?groupId=${order.groupId}&limit=20&offset=0`)
      .then(d => {
        const siblings = (d.orders ?? []).filter(o => o.id !== order.id && !o.driverId)
        setGroupOrders(siblings)
      })
      .catch(() => {})
  }, [order.groupId, order.id])

  const assign = async (driverId) => {
    setAssigning(true); setError(null)
    try {
      if (groupMode && order.groupId) {
        await api.post('/admin/orders/assign-group', { groupId: order.groupId, driverId })
      } else {
        await api.post(`/admin/orders/${order.id}/assign`, { driverId })
      }
      onSuccess(); onClose()
    } catch (e) { setError(e.message) }
    finally { setAssigning(false) }
  }

  const hasGroup = order.groupId && groupOrders.length > 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-playfair text-2xl font-bold text-charcoal">Assigner un livreur</h2>
            <p className="font-dm text-sm text-charcoal/50 mt-0.5">
              {fmtOrderId(order.id, order.createdAt)} · {order.shop?.name} ·{' '}
              <span className={`font-syne text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="text-charcoal/30 hover:text-charcoal transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          {/* Colonne gauche — détails commande */}
          <div className="w-72 shrink-0 border-r border-gray-100 overflow-y-auto p-6 space-y-5">
            <div>
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-2">Client</p>
              <p className="font-syne text-sm font-bold text-charcoal">{order.buyer?.name}</p>
              <p className="font-dm text-xs text-charcoal/50">{order.buyer?.phone}</p>
              <p className="font-dm text-xs text-charcoal/50 mt-1">{order.address}</p>
            </div>

            <div>
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-2">Articles</p>
              {order.items?.map(item => (
                <div key={item.id} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <p className="font-dm text-xs text-charcoal">{item.quantity}× {item.name || item.product?.name}</p>
                  <p className="font-syne text-xs font-bold text-charcoal">{fmt(item.price * item.quantity)} F</p>
                </div>
              ))}
              <p className="font-syne text-xs font-bold text-charcoal mt-2 pt-2 border-t border-gray-100">
                Total : {fmt(order.total)} F + {fmt(order.deliveryFee)} F livraison
              </p>
            </div>

            {/* Groupe multi-boutiques */}
            {hasGroup && (
              <div className="bg-safran/10 border border-safran/20 rounded-2xl p-4">
                <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-safran-dark mb-3">
                  Panier multi-boutiques
                </p>
                <div className="space-y-2 mb-4">
                  {groupOrders.map(go => (
                    <div key={go.id} className="flex justify-between text-xs">
                      <span className="font-syne font-bold text-charcoal">{fmtOrderId(go.id, go.createdAt)} {go.shop?.name}</span>
                      <span className="font-dm text-charcoal/50">{fmt(go.total)} F</span>
                    </div>
                  ))}
                </div>
                <div className="flex rounded-xl overflow-hidden border border-safran/30">
                  <button
                    onClick={() => setGroupMode(false)}
                    className={`flex-1 py-2 font-syne text-xs font-bold transition-colors ${
                      !groupMode ? 'bg-safran text-white' : 'bg-white text-charcoal/60 hover:bg-safran/10'
                    }`}
                  >
                    Individuel
                  </button>
                  <button
                    onClick={() => setGroupMode(true)}
                    className={`flex-1 py-2 font-syne text-xs font-bold transition-colors ${
                      groupMode ? 'bg-safran text-white' : 'bg-white text-charcoal/60 hover:bg-safran/10'
                    }`}
                  >
                    Tout le groupe ({groupOrders.length + 1})
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl p-3">
                <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="font-dm text-xs text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Colonne droite — candidats */}
          <div className="flex-1 overflow-y-auto p-6">
            <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-4">
              Livreurs disponibles {candidates.length ? `(${candidates.length})` : ''}
            </p>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <AlertCircle size={28} className="text-charcoal/20 mb-3" />
                <p className="font-syne text-sm font-bold text-charcoal/40">Aucun livreur disponible</p>
                <p className="font-dm text-xs text-charcoal/30 mt-1">Aucun livreur actif en ligne en ce moment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.map(driver => (
                  <button
                    key={driver.id}
                    onClick={() => assign(driver.id)}
                    disabled={assigning}
                    className="w-full text-left bg-white border-2 border-gray-100 rounded-2xl p-4 hover:border-forest hover:bg-forest/2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-syne text-sm font-bold text-charcoal group-hover:text-forest transition-colors">
                            {driver.user?.name}
                          </p>
                          <span className={`font-syne text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            driver.plan === 'PREMIUM'
                              ? 'bg-safran/15 text-safran-dark'
                              : 'bg-charcoal/8 text-charcoal/50'
                          }`}>
                            {driver.plan}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" title="En ligne" />
                        </div>
                        <p className="font-dm text-xs text-charcoal/40 mb-3">{driver.user?.phone}</p>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="font-playfair text-base font-bold text-charcoal">{driver.rating?.toFixed(1)}</p>
                            <p className="font-syne text-[9px] text-charcoal/40 uppercase tracking-wide">Note ★</p>
                          </div>
                          <div>
                            <p className="font-playfair text-base font-bold text-charcoal">{driver.totalDeliveries}</p>
                            <p className="font-syne text-[9px] text-charcoal/40 uppercase tracking-wide">Livraisons</p>
                          </div>
                          <div>
                            <p className={`font-playfair text-base font-bold ${
                              driver.acceptanceRate >= 0.7 ? 'text-forest' :
                              driver.acceptanceRate >= 0.5 ? 'text-amber-600' : 'text-red-500'
                            }`}>
                              {Math.round(driver.acceptanceRate * 100)}%
                            </p>
                            <p className="font-syne text-[9px] text-charcoal/40 uppercase tracking-wide">Acceptation</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${rateBarColor(driver.acceptanceRate)} transition-all`}
                              style={{ width: `${Math.round(driver.acceptanceRate * 100)}%` }}
                            />
                          </div>
                          <span className="font-syne text-[10px] font-bold text-charcoal/50 shrink-0">
                            Score {Math.round(driver.score)}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center self-center">
                        <div className="w-9 h-9 rounded-xl bg-forest/8 group-hover:bg-forest flex items-center justify-center transition-colors">
                          {assigning
                            ? <div className="w-3.5 h-3.5 border-2 border-forest/30 border-t-forest group-hover:border-white/30 group-hover:border-t-white rounded-full animate-spin" />
                            : <Truck size={16} className="text-forest group-hover:text-white transition-colors" />
                          }
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Onglet principal ───────────────────────────────────────────────────────

export default function OrdersAdminTab() {
  const [orders, setOrders]       = useState([])
  const [total, setTotal]         = useState(0)
  const [filter, setFilter]       = useState('')
  const [page, setPage]           = useState(0)
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState(null)
  const [assignOrder, setAssignOrder] = useState(null)
  const [cancelPrompt, setCancelPrompt] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState(null)

  const totalPages = Math.ceil(total / LIMIT)

  const load = useCallback(async (s, p) => {
    setLoading(true)
    try {
      if (s === ASSIGN_FILTER) {
        const [esc, pret] = await Promise.all([
          api.get('/admin/orders?status=ESCALATED&limit=50&offset=0'),
          api.get('/admin/orders?status=PRET&limit=50&offset=0'),
        ])
        const pretNoDriver = (pret.orders ?? []).filter(o => !o.driverId)
        const combined = [...(esc.orders ?? []), ...pretNoDriver]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setOrders(combined)
        setTotal(combined.length)
      } else {
        const qs = new URLSearchParams({ limit: LIMIT, offset: p * LIMIT })
        if (s) qs.set('status', s)
        const d = await api.get(`/admin/orders?${qs}`)
        setOrders(d.orders ?? [])
        setTotal(d.total ?? 0)
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    load(filter, page)
  }, [filter, page, load])

  const handleFilter = (s) => {
    setFilter(s)
    setPage(0)
    setExpanded(null)
  }

  const goPage = (p) => {
    setPage(p)
    setExpanded(null)
  }

  // Annulation admin — restocke via le Stock Engine (LOT 4). Gap comblé :
  // avant ce lot, aucune UI n'exposait d'annulation admin.
  const confirmCancel = async (orderId) => {
    setCancelling(true)
    setError(null)
    try {
      await api.put(`/orders/${orderId}/status`, { status: 'CANCELLED', note: cancelReason.trim() || undefined })
      setCancelPrompt(null)
      setCancelReason('')
      load(filter, page)
    } catch (e) {
      setError(e.message)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Gestion</p>
        <h1 className="font-playfair text-3xl font-bold text-charcoal">
          Commandes <span className="text-charcoal/25">({total})</span>
        </h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 font-bold text-xs underline">Fermer</button>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {/* Filtre virtuel "À assigner" */}
        <button onClick={() => handleFilter(ASSIGN_FILTER)}
          className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
            filter === ASSIGN_FILTER
              ? 'bg-red-600 border-red-600 text-white'
              : 'border-red-200 text-red-500 hover:border-red-400'
          }`}>
          ⚠ À assigner
        </button>

        {STATUSES.map(s => (
          <button key={s} onClick={() => handleFilter(s)}
            className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
              filter === s
                ? 'bg-charcoal border-charcoal text-white'
                : 'border-gray-200 text-charcoal/60 hover:border-gray-400'
            }`}>
            {s ? (STATUS_LABELS[s] || s) : 'Toutes'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['#', 'Date', 'Client', 'Boutique', 'Total', 'Statut', 'Livreur', 'Action'].map(h => (
                    <th key={h} className="px-5 py-4 text-left font-syne text-[10px] font-bold tracking-widest uppercase text-charcoal/35">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center font-dm text-charcoal/40">
                      Aucune commande trouvée
                    </td>
                  </tr>
                ) : orders.map(o => (
                  <Fragment key={o.id}>
                    <tr className="hover:bg-charcoal/3 cursor-pointer transition-colors"
                      onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                      <td className="px-5 py-4 font-syne font-bold text-charcoal text-sm">
                        {fmtOrderId(o.id, o.createdAt)}
                        {o.groupId && (
                          <span className="ml-1.5 font-syne text-[9px] font-bold bg-safran/15 text-safran-dark px-1.5 py-0.5 rounded-full">
                            GROUPE
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-dm text-xs text-charcoal/50">{fmtDate(o.createdAt)}</td>
                      <td className="px-5 py-4">
                        <p className="font-syne text-sm font-semibold text-charcoal">{o.buyer?.name}</p>
                        <p className="font-dm text-xs text-charcoal/40">{o.buyer?.phone}</p>
                      </td>
                      <td className="px-5 py-4 font-dm text-sm text-charcoal/70">{o.shop?.name}</td>
                      <td className="px-5 py-4 font-playfair text-lg font-bold text-charcoal">{fmt(o.total)} F</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 font-syne text-[10px] font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[o.status] || 'bg-gray-400'}`} />
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-dm text-sm text-charcoal/50">{o.driver?.user?.name || '—'}</td>
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {['PRET', 'ESCALATED'].includes(o.status) && !o.driverId && (
                            <button
                              onClick={() => setAssignOrder(o)}
                              className="flex items-center gap-1.5 bg-forest text-white font-syne text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-forest-light transition-colors"
                            >
                              <Truck size={12} /> Assigner
                            </button>
                          )}
                          {!['CANCELLED', 'DELIVERED'].includes(o.status) && (
                            <button
                              onClick={() => { setCancelPrompt(cancelPrompt === o.id ? null : o.id); setCancelReason('') }}
                              className="flex items-center gap-1.5 bg-red-50 text-red-600 font-syne text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-red-100 transition-colors"
                            >
                              <X size={12} /> Annuler
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Confirmation d'annulation — restocke les articles via le Stock Engine */}
                    {cancelPrompt === o.id && (
                      <tr className="bg-red-50/50">
                        <td colSpan={8} className="px-5 py-4" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-dm text-sm text-charcoal/70">
                              Annuler {fmtOrderId(o.id, o.createdAt)} et remettre les articles en stock :
                            </span>
                            <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Motif (optionnel)"
                              className="flex-1 min-w-[200px] bg-white border border-gray-200 rounded-xl px-3 py-1.5 font-dm text-sm" />
                            <button disabled={cancelling} onClick={() => confirmCancel(o.id)}
                              className="bg-red-600 text-white font-syne text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50">
                              {cancelling ? 'Annulation…' : 'Confirmer l\'annulation'}
                            </button>
                            <button onClick={() => setCancelPrompt(null)} className="font-dm text-xs text-charcoal/40">Fermer</button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Rangée expandée */}
                    {expanded === o.id && (
                      <tr className="bg-charcoal/2">
                        <td colSpan={8} className="px-5 py-5">
                          <div className="grid grid-cols-3 gap-6">
                            <div>
                              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-2">Articles</p>
                              {o.items?.map(item => (
                                <p key={item.id} className="font-dm text-sm text-charcoal mb-1">
                                  {item.quantity}× {item.product?.name || item.name || '—'}
                                  <span className="text-charcoal/40"> — {fmt(item.price)} F</span>
                                </p>
                              ))}
                              <p className="font-syne text-xs font-bold text-charcoal mt-2 pt-2 border-t border-gray-200">
                                Total: {fmt(o.total)} F + livraison {fmt(o.deliveryFee)} F
                              </p>
                            </div>
                            <div>
                              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-2">Adresse de livraison</p>
                              <p className="font-dm text-sm text-charcoal">{o.address || '—'}</p>
                              {o.note && (
                                <p className="font-dm text-xs text-charcoal/50 italic mt-2 bg-amber-50 px-3 py-2 rounded-xl">
                                  Note : "{o.note}"
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-2">Historique</p>
                              {o.statusHistory?.map(h => (
                                <div key={h.id} className="flex items-start gap-2 mb-2">
                                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${STATUS_DOT[h.status] || 'bg-gray-300'}`} />
                                  <div>
                                    <p className="font-syne text-xs font-bold text-charcoal">{STATUS_LABELS[h.status] || h.status}</p>
                                    <p className="font-dm text-[10px] text-charcoal/40">{fmtDate(h.createdAt)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination (pas affichée en mode ASSIGN_FILTER) */}
          {totalPages > 1 && filter !== ASSIGN_FILTER && (
            <div className="flex items-center justify-between">
              <p className="font-dm text-sm text-charcoal/50">
                {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} sur {total} commandes
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => goPage(page - 1)} disabled={page === 0}
                  className="p-2 rounded-xl border border-gray-200 text-charcoal hover:border-gray-400 disabled:opacity-30 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                  const p = totalPages <= 7 ? i : Math.max(0, Math.min(page - 3, totalPages - 7)) + i
                  return (
                    <button key={p} onClick={() => goPage(p)}
                      className={`w-9 h-9 rounded-xl font-syne text-sm font-bold border transition-all ${
                        p === page
                          ? 'bg-forest border-forest text-white'
                          : 'border-gray-200 text-charcoal hover:border-gray-400'
                      }`}>
                      {p + 1}
                    </button>
                  )
                })}
                <button onClick={() => goPage(page + 1)} disabled={page >= totalPages - 1}
                  className="p-2 rounded-xl border border-gray-200 text-charcoal hover:border-gray-400 disabled:opacity-30 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal d'assignation */}
      <AnimatePresence>
        {assignOrder && (
          <AssignmentModal
            order={assignOrder}
            onClose={() => setAssignOrder(null)}
            onSuccess={() => load(filter, page)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
