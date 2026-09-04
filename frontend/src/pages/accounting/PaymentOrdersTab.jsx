import { useEffect, useState } from 'react'
import { AlertCircle, Package, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../../api/client'
import { fmt, fmtDate } from '../../utils/status'
import { PAYMENT_ORDER_STATUS, badge } from './statusLabels'

function OrderDetail({ order }) {
  return (
    <div className="mt-3 pt-3 border-t border-charcoal/10 space-y-2">
      {order.remuneration && (
        <p className="font-dm text-xs text-charcoal/50">
          Rémunération liée : <span className="font-bold text-charcoal">{order.remuneration.reference}</span> ({fmt(order.remuneration.netAmount)} F net)
        </p>
      )}
      <p className="font-dm text-xs text-charcoal/50">
        Paiements associés : {order.payments?.length || 0}
      </p>
      {order.payments?.map(p => (
        <div key={p.id} className="flex items-center justify-between bg-cream rounded-xl px-3 py-2">
          <span className="font-dm text-xs text-charcoal">{p.reference} · {p.method}</span>
          <span className="font-syne text-xs font-bold text-charcoal/60">{p.status}</span>
        </div>
      ))}
    </div>
  )
}

export default function PaymentOrdersTab() {
  const [status, setStatus] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [detail, setDetail] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      const data = await api.get(`/accounting/payment-orders?${params}`)
      setOrders(data.orders || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = async (order) => {
    if (expandedId === order.id) { setExpandedId(null); return }
    setExpandedId(order.id)
    try {
      const data = await api.get(`/accounting/payment-orders/${order.id}`)
      setDetail(data)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Comptabilité</p>
        <h1 className="font-playfair text-2xl font-bold text-charcoal">Ordres de paiement</h1>
        <p className="font-dm text-sm text-charcoal/50 mt-1">
          La boîte de réception du comptable. Le contrôle et l'exécution du paiement se font ailleurs.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', ...Object.keys(PAYMENT_ORDER_STATUS)].map(s => (
          <button key={s || 'all'} onClick={() => setStatus(s)}
            className={`font-syne text-xs font-bold px-3 py-1.5 rounded-xl ${status === s ? 'bg-charcoal text-cream' : 'bg-white border border-charcoal/10 text-charcoal/50'}`}>
            {s ? badge(PAYMENT_ORDER_STATUS, s).label : 'Tous'}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <Package className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucun ordre de paiement.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => {
            const b = badge(PAYMENT_ORDER_STATUS, order.status)
            return (
              <div key={order.id} className="bg-white border border-charcoal/10 rounded-2xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-syne font-bold text-charcoal text-sm">{order.reference}</p>
                    <p className="font-dm text-xs text-charcoal/40">
                      {order.beneficiaryName || `Utilisateur #${order.beneficiaryUserId}`} · {order.reason} · {fmtDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-playfair text-lg font-bold text-charcoal">{fmt(order.amount)} F</p>
                    <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${b.color}`}>{b.label}</span>
                    <button onClick={() => toggleExpand(order)} className="text-charcoal/40 hover:text-charcoal">
                      {expandedId === order.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>
                {expandedId === order.id && detail?.id === order.id && <OrderDetail order={detail} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
