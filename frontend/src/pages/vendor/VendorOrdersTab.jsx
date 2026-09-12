import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/client'
import { fmtOrderId } from '../../utils/status'
import { ChevronRight, RefreshCw, Package, ChevronDown, Truck, CheckCircle2, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

const STATUSES = ['', 'CONFIRMED', 'EN_PREPARATION', 'PRET', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']

const STATUS_UI = {
  PENDING:        { label: 'En attente',    color: 'text-amber-600  bg-amber-50',  dot: 'bg-amber-400' },
  CONFIRMED:      { label: 'Confirmée',     color: 'text-blue-600   bg-blue-50',   dot: 'bg-blue-400' },
  EN_PREPARATION: { label: 'En préparation',color: 'text-indigo-600 bg-indigo-50', dot: 'bg-indigo-400' },
  PRET:           { label: 'Prête',         color: 'text-purple-600 bg-purple-50', dot: 'bg-purple-400' },
  IN_TRANSIT:     { label: 'En livraison',  color: 'text-cyan-600   bg-cyan-50',   dot: 'bg-cyan-400' },
  DELIVERED:      { label: 'Livrée',        color: 'text-green-600  bg-green-50',  dot: 'bg-green-400' },
  CANCELLED:      { label: 'Annulée',       color: 'text-red-500    bg-red-50',    dot: 'bg-red-400' },
}

const NEXT_ACTION = {
  CONFIRMED:      'Démarrer la préparation',
  EN_PREPARATION: 'Marquer comme prête',
}

const fmt = n => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

export default function VendorOrdersTab() {
  const [orders, setOrders]   = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus]   = useState('')
  const [advancing, setAdvancing] = useState(null)
  const [advanceError, setAdvanceError] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (status) params.set('status', status)
      const data = await api.get(`/orders/shop/list?${params}`)
      setOrders(data.orders || [])
      setTotal(data.total || 0)
      setLoadError(null)
    } catch (err) {
      setLoadError(err.message || 'Erreur de chargement des commandes')
    }
    finally { setLoading(false) }
  }, [status])

  useEffect(() => {
    load()
    const iv = setInterval(load, 20000)
    return () => clearInterval(iv)
  }, [load])

  const advance = async (orderId) => {
    setAdvancing(orderId); setAdvanceError(null)
    try {
      await api.put(`/orders/${orderId}/status`, {})
      await load()
    } catch (e) { setAdvanceError(e.message || 'Erreur lors de la mise à jour') }
    finally { setAdvancing(null) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Boutique</p>
          <h1 className="font-playfair text-3xl font-bold text-charcoal">Commandes</h1>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-charcoal/10 rounded-2xl font-syne text-sm font-bold text-charcoal/60 hover:text-charcoal transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {advanceError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{advanceError}</p>
          <button onClick={() => setAdvanceError(null)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{loadError}</p>
          <button onClick={load} className="text-red-600 hover:text-red-700 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => {
          const ui = STATUS_UI[s]
          return (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-xl font-syne text-xs font-bold transition-colors ${
                status === s ? 'bg-charcoal text-cream' : 'bg-white border border-charcoal/10 text-charcoal/50 hover:text-charcoal'
              }`}>
              {ui?.label || 'Toutes'}
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">{total} commande{total !== 1 ? 's' : ''}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-[#E8A217]/20 border-t-[#E8A217] rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center">
            <Package size={36} className="mx-auto text-charcoal/20 mb-3" />
            <p className="font-dm text-charcoal/40">Aucune commande</p>
          </div>
        ) : (
          <div className="divide-y divide-charcoal/5">
            {orders.map((order, i) => {
              const ui = STATUS_UI[order.status] || { label: order.status, color: 'text-charcoal bg-gray-50', dot: 'bg-gray-300' }
              const canAdvance = !!NEXT_ACTION[order.status]
              const isExpanded = expanded === order.id

              return (
                <motion.div key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                  <div className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-syne text-sm font-bold text-charcoal">{fmtOrderId(order.id, order.createdAt, order.reference)}</p>
                        <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full ${ui.color}`}>{ui.label}</span>
                      </div>
                      <p className="font-dm text-xs text-charcoal/50 mt-0.5">
                        {order.buyer?.name} · {fmtDate(order.createdAt)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-syne text-sm font-bold text-charcoal">{fmt(order.total)} FCFA</p>
                      <p className="font-dm text-xs text-charcoal/40">{order.items?.length} article{order.items?.length > 1 ? 's' : ''}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Commande PRET → en attente de livreur */}
                      {order.status === 'PRET' && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-xl font-syne text-[10px] font-bold text-purple-600 whitespace-nowrap">
                          <Truck size={11} className="animate-pulse" />
                          En attente de livreur
                        </span>
                      )}
                      {/* Commande livrée → terminée */}
                      {order.status === 'DELIVERED' && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-xl font-syne text-[10px] font-bold text-green-600 whitespace-nowrap">
                          <CheckCircle2 size={11} />
                          Terminée
                        </span>
                      )}
                      {/* Actions disponibles */}
                      {canAdvance && (
                        <button onClick={() => advance(order.id)} disabled={advancing === order.id}
                          className="px-3 py-1.5 bg-[#E8A217] text-white rounded-xl font-syne text-xs font-bold hover:bg-[#d4901a] transition-colors disabled:opacity-50 whitespace-nowrap">
                          {advancing === order.id
                            ? <span className="inline-block w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                            : NEXT_ACTION[order.status]}
                        </button>
                      )}
                      <button onClick={() => setExpanded(isExpanded ? null : order.id)}
                        className="p-1.5 rounded-lg hover:bg-charcoal/5 transition-colors">
                        <ChevronDown size={14} className={`text-charcoal/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-4 bg-gray-50/50 border-t border-charcoal/5">
                      <div className="pt-3 space-y-1.5">
                        <p className="font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-2">Articles</p>
                        {order.items?.map((item, j) => (
                          <div key={j} className="flex items-center justify-between">
                            <span className="font-dm text-sm text-charcoal">{item.name}{item.unitLabel && <span className="text-charcoal/40"> ({item.unitLabel})</span>} × {item.quantity}</span>
                            <span className="font-dm text-sm text-charcoal/60">{fmt(item.price * item.quantity)} FCFA</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-charcoal/10 flex items-center justify-between">
                          <span className="font-syne text-xs font-bold text-charcoal/40">Adresse</span>
                          <span className="font-dm text-xs text-charcoal/60">{order.address}</span>
                        </div>
                        {order.note && (
                          <div className="flex items-start gap-2">
                            <span className="font-syne text-xs font-bold text-charcoal/40">Note</span>
                            <span className="font-dm text-xs text-charcoal/60">{order.note}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
