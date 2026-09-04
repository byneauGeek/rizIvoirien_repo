import { useState, useEffect, useCallback, Fragment } from 'react'
import { Phone, X, Check, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { api } from '../../api/client'
import { STATUS_LABELS, STATUS_COLORS, STATUS_DOT, fmt, fmtDate, fmtOrderId } from '../../utils/status'

const STATUSES = ['ALL', 'PENDING_VALIDATION', 'CONFIRMED', 'EN_PREPARATION', 'PRET', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'ESCALATED']
const LIMIT = 20

// ─── File de validation ──────────────────────────────────────────────────────

function ValidationQueue({ onRefreshKpis }) {
  const [orders, setOrders]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [acting, setActing]         = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [error, setError]           = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await api.get('/commercial/orders/pending-validation')
      setOrders(data.orders ?? [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 20000)
    return () => clearInterval(iv)
  }, [load])

  const validate = async (orderId) => {
    setActing(orderId); setError(null)
    try {
      await api.post(`/commercial/orders/${orderId}/validate`)
      setOrders(o => o.filter(x => x.id !== orderId))
      onRefreshKpis?.()
    } catch (e) { setError(e.message) }
    finally { setActing(null) }
  }

  const doCancel = async () => {
    setCancelling(true); setError(null)
    try {
      await api.post(`/commercial/orders/${cancelTarget.id}/cancel`, { reason: cancelReason.trim() || undefined })
      setOrders(o => o.filter(x => x.id !== cancelTarget.id))
      setCancelTarget(null)
      setCancelReason('')
      onRefreshKpis?.()
    } catch (e) { setError(e.message) }
    finally { setCancelling(false) }
  }

  const waitMin = (createdAt) => Math.round((Date.now() - new Date(createdAt)) / 60000)

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  if (orders.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-charcoal/40">
      <span className="text-5xl mb-4">✓</span>
      <p className="font-syne font-bold text-lg text-charcoal/50">File vide</p>
      <p className="font-dm text-sm mt-1">Aucune commande en attente de validation</p>
    </div>
  )

  return (
    <>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 font-dm text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {orders.map(order => {
          const wait = waitMin(order.createdAt)
          const phone = order.buyer?.phone?.replace(/\s/g, '')
          const waPhone = phone?.replace(/^\+/, '')

          return (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-charcoal/8">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-charcoal/8">
                <div>
                  <span className="font-syne font-bold text-sm text-charcoal">{fmtOrderId(order.id, order.createdAt)}</span>
                  <span className="ml-2 font-dm text-xs text-charcoal/40">{order.shop?.name}</span>
                </div>
                <span className={`font-syne text-xs font-bold px-2 py-0.5 rounded-full ${
                  wait >= 30 ? 'bg-red-100 text-red-700' : wait >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                }`}>
                  ⏱ {wait < 60 ? `${wait} min` : `${Math.floor(wait / 60)}h${wait % 60 > 0 ? String(wait % 60).padStart(2, '0') : ''}`}
                </span>
              </div>

              {/* Contact zone */}
              <div className="mx-4 my-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="font-syne text-sm font-bold text-charcoal">{order.buyer?.name}</p>
                {order.buyer?.phone && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <a href={`tel:${order.buyer.phone}`}
                      className="flex items-center gap-1.5 font-dm text-sm text-blue-700 hover:text-blue-900 font-medium">
                      <Phone size={13} /> {order.buyer.phone}
                    </a>
                    {waPhone && (
                      <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer"
                        className="ml-auto flex items-center gap-1 bg-green-500 text-white font-syne text-xs font-bold px-2.5 py-1 rounded-lg hover:bg-green-600 transition-colors">
                        WhatsApp
                      </a>
                    )}
                  </div>
                )}
                {order.buyer?.email && (
                  <p className="font-dm text-xs text-charcoal/50 mt-1">{order.buyer.email}</p>
                )}
              </div>

              {/* Items */}
              <div className="px-4 pb-3 space-y-0.5">
                {(order.items ?? []).slice(0, 3).map(item => (
                  <p key={item.id} className="font-dm text-xs text-charcoal/60">
                    {item.quantity}× {item.product?.name}
                  </p>
                ))}
                {(order.items?.length ?? 0) > 3 && (
                  <p className="font-dm text-xs text-charcoal/40">+{order.items.length - 3} article(s)…</p>
                )}
                <p className="font-syne text-sm font-bold text-charcoal pt-1">{fmt(order.total)} FCFA</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 px-4 pb-4">
                <button
                  onClick={() => validate(order.id)}
                  disabled={acting === order.id}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-forest text-white font-syne text-sm font-bold py-2.5 rounded-xl hover:bg-forest/80 disabled:opacity-50 transition-colors"
                >
                  <Check size={15} /> Valider
                </button>
                <button
                  onClick={() => { setCancelTarget(order); setCancelReason('') }}
                  disabled={acting === order.id}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-600 font-syne text-sm font-bold py-2.5 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  <X size={15} /> Annuler
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cancel modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setCancelTarget(null); setError(null) }} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-playfair text-lg font-bold text-charcoal mb-1">Annuler la commande</h3>
            <p className="font-dm text-sm text-charcoal/60 mb-4">
              {fmtOrderId(cancelTarget.id, cancelTarget.createdAt)} · {cancelTarget.buyer?.name}
            </p>
            <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 block mb-2">
              Motif d'annulation (optionnel)
            </label>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Ex : client injoignable, doublon, produit indisponible…"
              className="w-full font-dm text-sm border border-charcoal/20 rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-400 resize-none mb-4"
            />
            {error && <p className="font-dm text-sm text-red-500 mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setCancelTarget(null); setError(null) }} className="font-syne text-sm font-bold text-charcoal/60 px-4 py-2.5 rounded-xl hover:bg-charcoal/5 transition-colors">
                Retour
              </button>
              <button onClick={doCancel} disabled={cancelling} className="font-syne text-sm font-bold bg-red-600 text-white px-5 py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-60 transition-colors">
                {cancelling ? 'Annulation…' : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Toutes les commandes ─────────────────────────────────────────────────────

function AllOrdersList() {
  const [orders, setOrders]   = useState([])
  const [total, setTotal]     = useState(0)
  const [status, setStatus]   = useState('ALL')
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: page * LIMIT })
      if (status !== 'ALL') params.set('status', status)
      const data = await api.get(`/commercial/orders?${params}`)
      setOrders(data.orders ?? [])
      setTotal(data.total ?? 0)
    } catch {}
    finally { setLoading(false) }
  }, [status, page])

  useEffect(() => { load() }, [load])

  const handleStatus = (s) => { setStatus(s); setPage(0) }
  const pages = Math.ceil(total / LIMIT)

  return (
    <div>
      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUSES.map(s => (
          <button key={s} onClick={() => handleStatus(s)}
            className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
              status === s ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-charcoal/20 text-charcoal/60 hover:border-charcoal/40'
            }`}>
            {s === 'ALL' ? 'Tous' : STATUS_LABELS[s] ?? s}
          </button>
        ))}
        <button onClick={load} className="p-1.5 rounded-full border-2 border-charcoal/20 text-charcoal/40 hover:border-charcoal/40 hover:text-charcoal/60 transition-colors ml-auto">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-charcoal/40">
          <p className="font-dm text-sm">Aucune commande pour ce filtre</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-charcoal/8">
                  {['Référence', 'Acheteur', 'Boutique', 'Total', 'Statut', 'Date'].map(h => (
                    <th key={h} className="px-5 py-4 text-left font-syne text-xs font-bold text-charcoal/50 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <Fragment key={o.id}>
                    <tr
                      onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                      className="border-b border-charcoal/5 hover:bg-charcoal/2 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono text-sm font-bold text-charcoal">{fmtOrderId(o.id, o.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-syne text-sm font-semibold text-charcoal">{o.buyer?.name}</p>
                        {o.buyer?.phone && <p className="font-dm text-xs text-charcoal/50">{o.buyer.phone}</p>}
                      </td>
                      <td className="px-5 py-3.5 font-dm text-sm text-charcoal/70">{o.shop?.name}</td>
                      <td className="px-5 py-3.5 font-syne text-sm font-bold text-charcoal">{fmt(o.total)} <span className="font-dm font-normal text-charcoal/50 text-xs">FCFA</span></td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 font-syne text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[o.status] ?? 'bg-gray-400'}`} />
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-dm text-xs text-charcoal/50">{fmtDate(o.createdAt)}</td>
                    </tr>
                    {expanded === o.id && (
                      <tr className="bg-charcoal/2 border-b border-charcoal/5">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="flex gap-8">
                            <div>
                              <p className="font-syne text-xs font-bold text-charcoal/50 uppercase tracking-wider mb-2">Articles</p>
                              <div className="space-y-1">
                                {(o.items ?? []).map(item => (
                                  <p key={item.id} className="font-dm text-sm text-charcoal">
                                    {item.quantity}× {item.name ?? item.product?.name} — {fmt(item.price)} FCFA
                                  </p>
                                ))}
                              </div>
                            </div>
                            {o.address && (
                              <div>
                                <p className="font-syne text-xs font-bold text-charcoal/50 uppercase tracking-wider mb-2">Adresse</p>
                                <p className="font-dm text-sm text-charcoal">{o.address}</p>
                              </div>
                            )}
                            {o.driver && (
                              <div>
                                <p className="font-syne text-xs font-bold text-charcoal/50 uppercase tracking-wider mb-2">Livreur</p>
                                <p className="font-dm text-sm text-charcoal">{o.driver?.user?.name}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="font-dm text-sm text-charcoal/50">{total} commande{total !== 1 ? 's' : ''}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                  className="p-2 rounded-xl border border-charcoal/20 text-charcoal/50 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <span className="font-syne text-sm font-bold text-charcoal">{page + 1} / {pages}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= pages - 1}
                  className="p-2 rounded-xl border border-charcoal/20 text-charcoal/50 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CommandesTab({ onRefreshKpis }) {
  const [view, setView] = useState('validation')

  return (
    <div>
      {/* Header + toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-playfair text-2xl font-bold text-charcoal">Commandes</h2>
          <p className="font-dm text-sm text-charcoal/50 mt-0.5">
            {view === 'validation' ? 'Appeler les clients pour valider leurs commandes' : 'Historique complet des commandes'}
          </p>
        </div>
        <div className="flex items-center bg-charcoal/8 p-1 rounded-xl">
          <button onClick={() => setView('validation')}
            className={`font-syne text-sm font-bold px-4 py-2 rounded-lg transition-all ${view === 'validation' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/50 hover:text-charcoal/70'}`}>
            File de validation
          </button>
          <button onClick={() => setView('all')}
            className={`font-syne text-sm font-bold px-4 py-2 rounded-lg transition-all ${view === 'all' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/50 hover:text-charcoal/70'}`}>
            Toutes les commandes
          </button>
        </div>
      </div>

      {view === 'validation' ? (
        <ValidationQueue onRefreshKpis={onRefreshKpis} />
      ) : (
        <AllOrdersList />
      )}
    </div>
  )
}
