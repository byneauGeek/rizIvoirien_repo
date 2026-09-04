import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { STATUS_LABELS, STATUS_COLORS, STATUS_DOT, fmt, fmtDate, fmtOrderId } from '../../utils/status'
import { ChevronRight, AlertCircle, X } from 'lucide-react'

const FILTERS = [
  { value: '',              label: 'Toutes' },
  { value: 'CONFIRMED',    label: 'Confirmées' },
  { value: 'EN_PREPARATION', label: 'En préparation' },
  { value: 'PRET',         label: 'Prêtes' },
  { value: 'IN_TRANSIT',   label: 'En route' },
  { value: 'DELIVERED',    label: 'Livrées' },
]

const NEXT_ACTION = {
  CONFIRMED:    'Démarrer la préparation',
  EN_PREPARATION: 'Marquer comme prête',
}

export default function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(null)
  const [advanceError, setAdvanceError] = useState(null)

  const load = (status = filter) => {
    const qs = status ? `?status=${status}` : ''
    api.get(`/orders/shop/list${qs}`)
      .then(d => { setOrders(d.orders || []); setTotal(d.total || 0) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    load()
    const iv = setInterval(() => load(), 30000)
    return () => clearInterval(iv)
  }, [filter])

  const advanceStatus = async (order) => {
    setAdvancing(order.id)
    setAdvanceError(null)
    try {
      await api.put(`/orders/${order.id}/status`, {})
      load()
    } catch (err) {
      setAdvanceError(err.message || 'Erreur lors de la mise à jour')
    } finally {
      setAdvancing(null)
    }
  }

  return (
    <div className="space-y-6">
      {advanceError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 font-dm text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{advanceError}</span>
          <button onClick={() => setAdvanceError(null)}><X size={14} /></button>
        </div>
      )}
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Gestion</p>
        <h1 className="font-playfair text-4xl font-bold text-charcoal">Commandes</h1>
        <p className="font-dm text-charcoal/50 mt-1">{total} commandes au total</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 font-syne text-sm font-semibold px-4 py-2 rounded-full border-2 transition-all ${
              filter === f.value ? 'bg-forest border-forest text-cream' : 'border-charcoal/15 text-charcoal hover:border-charcoal/30'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-3xl p-6 shadow-card">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-syne font-bold text-charcoal">{fmtOrderId(order.id, order.createdAt)}</span>
                    <span className={`inline-flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1 rounded-full border ${STATUS_COLORS[order.status]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[order.status]}`} />
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <p className="font-dm text-sm text-charcoal/50">{fmtDate(order.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-playfair text-2xl font-bold text-charcoal">{fmt(order.total)} F</p>
                  <p className="font-dm text-xs text-charcoal/40">+ {fmt(order.deliveryFee)} F livraison</p>
                </div>
              </div>

              {/* Buyer + items */}
              <div className="flex items-center gap-4 py-4 border-y border-charcoal/6">
                <div className="flex-1 min-w-0">
                  <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-1">Client</p>
                  <p className="font-syne text-sm font-semibold text-charcoal">{order.buyer?.name}</p>
                  <p className="font-dm text-xs text-charcoal/50">{order.buyer?.phone}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-1">Articles</p>
                  {order.items?.map(item => (
                    <p key={item.id} className="font-dm text-sm text-charcoal truncate">
                      {item.quantity}× {item.name}
                    </p>
                  ))}
                </div>
              </div>

              {/* Buyer note */}
              {order.note && (
                <div className="mt-3 px-4 py-3 bg-safran/8 rounded-2xl">
                  <p className="font-syne text-xs font-bold text-charcoal/40 mb-0.5">Note du client</p>
                  <p className="font-dm text-sm text-charcoal italic">"{order.note}"</p>
                </div>
              )}

              {/* Action */}
              {NEXT_ACTION[order.status] && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => advanceStatus(order)}
                    disabled={advancing === order.id}
                    className="flex items-center gap-2 bg-forest text-cream font-syne text-sm font-bold px-5 py-2.5 rounded-full hover:bg-forest-light transition-colors disabled:opacity-60"
                  >
                    {advancing === order.id
                      ? <div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                      : <ChevronRight size={15} />
                    }
                    {NEXT_ACTION[order.status]}
                  </button>
                </div>
              )}
            </div>
          ))}
          {!orders.length && (
            <div className="bg-white rounded-3xl p-16 shadow-card text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-playfair text-xl font-bold text-charcoal mb-1">Aucune commande</p>
              <p className="font-dm text-charcoal/40 text-sm">Les commandes apparaîtront ici dès leur réception.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
