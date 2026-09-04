import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { fmt, fmtDate } from '../../utils/status'
import { TrendingUp, Package, ShoppingBag, AlertTriangle } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '../../context/AuthContext'

const KPICard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-white rounded-3xl p-6 shadow-card">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${color}`}>
      <Icon size={22} className="text-white" />
    </div>
    <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40 mb-1">{label}</p>
    <p className="font-playfair text-3xl font-bold text-charcoal">{value}</p>
    {sub && <p className="font-dm text-xs text-charcoal/50 mt-1">{sub}</p>}
  </div>
)

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-charcoal rounded-2xl px-4 py-3 shadow-xl">
      <p className="font-syne text-xs text-cream/50 mb-1">{label}</p>
      <p className="font-playfair text-xl font-bold text-safran">{fmt(payload[0].value)} FCFA</p>
    </div>
  )
}

export default function OverviewTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    api.get('/shops/my/dashboard').then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
    </div>
  )

  const { kpis, monthlyRevenue, topProducts } = data || {}

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Dashboard</p>
        <h1 className="font-playfair text-4xl font-bold text-charcoal mt-1">
          Bonjour, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="font-dm text-charcoal/50 mt-1">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard icon={TrendingUp}    label="Revenu ce mois"   value={`${fmt(kpis?.monthRevenue)} F`}     sub={`Total: ${fmt(kpis?.totalRevenue)} FCFA`}    color="bg-forest" />
        <KPICard icon={ShoppingBag}   label="Commandes mois"   value={kpis?.monthOrders ?? 0}             sub={`En attente: ${kpis?.pendingOrders ?? 0}`}    color="bg-safran" />
        <KPICard icon={Package}       label="Produits actifs"  value={kpis?.totalProducts ?? 0}           sub={`Stock faible: ${kpis?.lowStockProducts ?? 0}`} color="bg-terra" />
        <KPICard icon={AlertTriangle} label="À préparer"       value={kpis?.pendingOrders ?? 0}           sub="commandes en attente"                           color="bg-gold" />
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-3xl p-6 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Évolution</p>
            <h2 className="font-playfair text-2xl font-bold text-charcoal">Revenus sur 6 mois</h2>
          </div>
          <div className="text-right">
            <p className="font-syne text-xs text-charcoal/40">Ce mois</p>
            <p className="font-playfair text-2xl font-bold text-forest">{fmt(kpis?.monthRevenue)} F</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={monthlyRevenue}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1B4332" />
                <stop offset="100%" stopColor="#E8A217" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontFamily: 'Syne', fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontFamily: 'DM Sans', fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="revenue" stroke="url(#revenueGrad)" strokeWidth={3} dot={{ fill: '#1B4332', r: 5, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="bg-white rounded-3xl p-6 shadow-card">
          <h2 className="font-playfair text-xl font-bold text-charcoal mb-5">Top produits</h2>
          <div className="space-y-3">
            {topProducts?.slice(0, 5).map((tp, i) => (
              <div key={tp.productId} className="flex items-center gap-3">
                <span className="font-playfair text-2xl font-bold text-charcoal/20 w-7 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-syne text-sm font-semibold text-charcoal truncate">{tp.product?.name}</p>
                  <p className="font-dm text-xs text-charcoal/40">{tp._sum?.quantity} unités vendues</p>
                </div>
                <div className="text-right">
                  <p className="font-syne text-xs font-bold text-forest">{fmt(tp._count?.productId)} cmd</p>
                </div>
              </div>
            ))}
            {!topProducts?.length && (
              <p className="font-dm text-sm text-charcoal/40 text-center py-6">Aucune vente pour l'instant</p>
            )}
          </div>
        </div>

        {/* Commandes récentes */}
        <div className="bg-white rounded-3xl p-6 shadow-card">
          <h2 className="font-playfair text-xl font-bold text-charcoal mb-5">Stock faible</h2>
          <div className="space-y-3">
            {data?.products?.filter(p => p.stock < 20).slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-syne text-sm font-semibold text-charcoal truncate">{p.name}</p>
                  <p className="font-dm text-xs text-charcoal/40">{p.category}</p>
                </div>
                <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${p.stock < 5 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                  {p.stock} restants
                </span>
              </div>
            ))}
            {!data?.products?.filter(p => p.stock < 20).length && (
              <div className="flex items-center gap-2 text-green-600 py-6 justify-center">
                <span>✓</span>
                <span className="font-dm text-sm">Tous les stocks sont OK</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
