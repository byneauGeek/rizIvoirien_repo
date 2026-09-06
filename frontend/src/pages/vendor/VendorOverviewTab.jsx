import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { fmtOrderId } from '../../utils/status'
import { TrendingUp, TrendingDown, ShoppingBag, Package, Star, Clock, AlertTriangle } from 'lucide-react'

const fmt = n => Number(n || 0).toLocaleString('fr-FR')

const STATUS_LABEL = {
  PENDING: { label: 'En attente', color: 'text-amber-600 bg-amber-50' },
  CONFIRMED: { label: 'Confirmée', color: 'text-blue-600 bg-blue-50' },
  EN_PREPARATION: { label: 'En prépa.', color: 'text-indigo-600 bg-indigo-50' },
  PRET: { label: 'Prête', color: 'text-purple-600 bg-purple-50' },
  IN_TRANSIT: { label: 'En route', color: 'text-cyan-600 bg-cyan-50' },
  DELIVERED: { label: 'Livrée', color: 'text-green-600 bg-green-50' },
  CANCELLED: { label: 'Annulée', color: 'text-red-500 bg-red-50' },
}

export default function VendorOverviewTab({ shopStatus }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true); setError(null)
    api.get('/shops/my/dashboard')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [shopStatus])

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 border-2 border-[#E8A217]/30 border-t-[#E8A217] rounded-full animate-spin" />
    </div>
  )

  if (error || !data) return (
    <div className="py-20 text-center font-dm text-charcoal/40 space-y-3">
      <p>Impossible de charger le tableau de bord{error ? ` : ${error}` : '.'}</p>
      <button onClick={load} className="text-[#E8A217] font-syne font-bold text-sm underline">Réessayer</button>
    </div>
  )

  const { kpis, topProducts, monthlyRevenue, recentOrders, shop } = data
  const maxRev = Math.max(...monthlyRevenue.map(m => m.revenue), 1)

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Boutique</p>
        <h1 className="font-playfair text-3xl font-bold text-charcoal">{shop.name}</h1>
        {shop.paused && (
          <div className="mt-2 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
            <AlertTriangle size={13} className="text-amber-600" />
            <span className="font-syne text-xs font-bold text-amber-700">Boutique en pause</span>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="CA ce mois" value={`${fmt(kpis.monthRevenue)} FCFA`}
          sub={`Total : ${fmt(kpis.totalRevenue)} FCFA`} icon={TrendingUp} color="text-[#E8A217]" bg="bg-[#E8A217]/10" />
        <KpiCard label="Commandes / mois" value={kpis.monthOrders}
          sub={kpis.growth >= 0 ? `+${kpis.growth}% vs mois dernier` : `${kpis.growth}% vs mois dernier`}
          icon={kpis.growth >= 0 ? TrendingUp : TrendingDown}
          color={kpis.growth >= 0 ? 'text-green-600' : 'text-red-500'}
          bg={kpis.growth >= 0 ? 'bg-green-50' : 'bg-red-50'} />
        <KpiCard label="En attente" value={kpis.pendingOrders}
          sub="commandes à traiter" icon={Clock} color="text-indigo-600" bg="bg-indigo-50" />
        <KpiCard label="Produits actifs" value={kpis.activeProducts}
          sub={kpis.lowStockProducts > 0 ? `${kpis.lowStockProducts} stock faible` : 'Stock OK'}
          icon={Package}
          color={kpis.lowStockProducts > 0 ? 'text-amber-600' : 'text-forest'}
          bg={kpis.lowStockProducts > 0 ? 'bg-amber-50' : 'bg-forest/5'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Monthly revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
          <p className="font-syne text-sm font-bold text-charcoal mb-4">Revenus des 6 derniers mois</p>
          <div className="flex items-end gap-2 h-36">
            {monthlyRevenue.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-lg bg-[#E8A217]/20 hover:bg-[#E8A217]/40 transition-colors relative"
                  style={{ height: `${Math.max(4, (m.revenue / maxRev) * 120)}px` }}>
                  {m.revenue > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-dm text-[9px] text-charcoal/50 whitespace-nowrap">
                      {fmt(m.revenue)}
                    </span>
                  )}
                </div>
                <span className="font-dm text-[10px] text-charcoal/40 capitalize">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
          <p className="font-syne text-sm font-bold text-charcoal mb-4">Top produits</p>
          <div className="space-y-3">
            {topProducts.length === 0 && (
              <p className="font-dm text-sm text-charcoal/40 text-center py-4">Aucune vente</p>
            )}
            {topProducts.map((tp, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-[#E8A217]/15 flex items-center justify-center font-syne text-[10px] font-bold text-[#E8A217] shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-dm text-sm text-charcoal truncate">{tp.product?.name || '—'}</p>
                </div>
                <span className="font-syne text-xs font-bold text-charcoal/50">{tp._sum.quantity} u.</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShoppingBag size={14} className="text-[#E8A217]" />
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">Dernières commandes</p>
        </div>
        <div className="divide-y divide-charcoal/5">
          {recentOrders.length === 0 && (
            <p className="font-dm text-sm text-charcoal/40 text-center py-8">Aucune commande</p>
          )}
          {recentOrders.map(order => {
            const s = STATUS_LABEL[order.status] || { label: order.status, color: 'text-charcoal bg-gray-50' }
            return (
              <div key={order.id} className="flex items-center gap-4 px-6 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="font-syne text-sm font-bold text-charcoal">Commande {fmtOrderId(order.id, order.createdAt)}</p>
                  <p className="font-dm text-xs text-charcoal/40">{order.buyer?.name} · {order.items.length} article{order.items.length > 1 ? 's' : ''}</p>
                </div>
                <span className={`font-syne text-[10px] font-bold px-2.5 py-1 rounded-full ${s.color}`}>{s.label}</span>
                <span className="font-dm text-sm font-bold text-charcoal shrink-0">{fmt(order.total)} FCFA</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rating */}
      {shop.reviewCount > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#E8A217]/10 flex items-center justify-center shrink-0">
            <Star size={20} className="text-[#E8A217]" fill="#E8A217" />
          </div>
          <div>
            <p className="font-playfair text-2xl font-bold text-charcoal">{Number(shop.rating || 0).toFixed(1)} / 5</p>
            <p className="font-dm text-sm text-charcoal/40">{shop.reviewCount} avis client{shop.reviewCount > 1 ? 's' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, icon: Icon, color, bg }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <Icon size={16} className={color} />
      </div>
      <p className="font-playfair text-2xl font-bold text-charcoal leading-none">{value}</p>
      <p className="font-dm text-xs text-charcoal/40 mt-1">{label}</p>
      {sub && <p className={`font-syne text-[10px] font-bold mt-1 ${color}`}>{sub}</p>}
    </div>
  )
}
