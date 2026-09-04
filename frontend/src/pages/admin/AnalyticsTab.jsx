import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { fmt } from '../../utils/status'
import { buildAdminInsights } from '../../utils/analytics'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

const C = {
  forest: '#1B4332', forestLight: '#2D6A4F', safran: '#E8A217',
  terra: '#C4501A', muted: '#52796F', safranDark: '#D4A853', gray: '#6B7280', grid: '#f4f4f4',
}
const PIE_COLORS = [C.safran, C.forest, C.terra, C.forestLight, C.muted, C.safranDark, C.gray]
const STATUS_FR = {
  PENDING: 'Attente', CONFIRMED: 'Confirmées', EN_PREPARATION: 'Préparation',
  PRET: 'Prêtes', IN_TRANSIT: 'En livraison', DELIVERED: 'Livrées', CANCELLED: 'Annulées',
  PENDING_VALIDATION: 'En validation',
}

function KPI({ label, value, sub, trend }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-card">
      <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40 mb-2">{label}</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="font-playfair text-3xl font-bold text-charcoal">{value}</p>
        {trend !== undefined && (
          <span className={`text-[10px] font-syne font-bold px-1.5 py-0.5 rounded-full ${
            trend > 0 ? 'bg-green-50 text-green-600' : trend < 0 ? 'bg-red-50 text-red-500' : 'bg-charcoal/5 text-charcoal/30'
          }`}>
            {trend > 0 ? `↑ +${Math.round(trend)}%` : trend < 0 ? `↓ ${Math.round(trend)}%` : '→'}
          </span>
        )}
      </div>
      {sub && <p className="font-dm text-xs text-charcoal/50 mt-1">{sub}</p>}
    </div>
  )
}

function InsightCard({ icon, type, title, body }) {
  const styles = { success: 'bg-green-50 border-green-200', warning: 'bg-amber-50 border-amber-200', info: 'bg-blue-50 border-blue-200' }
  return (
    <div className={`flex items-start gap-3 border rounded-2xl px-4 py-3 ${styles[type] || styles.info}`}>
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="font-syne text-sm font-bold text-charcoal">{title}</p>
        <p className="font-dm text-xs text-charcoal/60 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

export default function AnalyticsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.get('/admin/analytics').then(setData).finally(() => setLoading(false)) }, [])

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
    </div>
  )

  const { kpis, monthlyRevenue = [], byStatus = [], topShops = [], ordersByDow = [], topProducts = [] } = data || {}
  const growth = kpis?.growthRate
  const pieData = byStatus.map(s => ({ name: STATUS_FR[s.status] || s.status, value: s._count?.id }))
  const insights = buildAdminInsights({ kpis, topShops, repeatBuyerRate: kpis?.repeatBuyerRate })
  const bestDow = ordersByDow.length > 0 ? ordersByDow.reduce((a, b) => b.count > a.count ? b : a) : null

  return (
    <div className="space-y-8">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Administration</p>
        <h1 className="font-playfair text-4xl font-bold text-charcoal">Vue d'ensemble</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPI label="Revenu total"      value={`${fmt(kpis?.totalRevenue)} F`} sub={`Commission : ${fmt(kpis?.commission)} FCFA`} />
        <KPI label="Commandes ce mois" value={kpis?.monthOrders ?? 0}         trend={growth} sub={`Mois dernier : ${kpis?.lastMonthOrders ?? 0}`} />
        <KPI label="Utilisateurs"      value={kpis?.totalUsers ?? 0}          sub={`${kpis?.totalShops} boutiques · ${kpis?.totalDrivers} livreurs`} />
        <KPI label="Fidélisation"      value={`${kpis?.repeatBuyerRate ?? 0}%`} sub="Acheteurs récurrents (90j)" />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-playfair text-xl font-bold text-charcoal">Insights</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
          </div>
        </div>
      )}

      {/* Revenue chart */}
      <div className="bg-white rounded-3xl p-6 shadow-card">
        <h2 className="font-playfair text-2xl font-bold text-charcoal mb-6">Revenus sur 12 mois</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={monthlyRevenue}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.forest} stopOpacity={0.15} />
                <stop offset="95%" stopColor={C.forest} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="month" tick={{ fontFamily: 'Syne', fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontFamily: 'DM Sans', fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => [`${fmt(v)} FCFA`, 'Revenus']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
            <Area type="monotone" dataKey="revenue" stroke={C.forest} strokeWidth={2.5} fill="url(#grad)" dot={{ r: 3, fill: C.forest }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Commandes par mois */}
        <div className="bg-white rounded-3xl p-6 shadow-card">
          <h2 className="font-playfair text-xl font-bold text-charcoal mb-5">Commandes / mois</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="month" tick={{ fontFamily: 'Syne', fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'DM Sans', fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none' }} />
              <Bar dataKey="orders" fill={C.safran} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Commandes par jour de semaine */}
        <div className="bg-white rounded-3xl p-6 shadow-card">
          <div className="flex items-start justify-between mb-5">
            <h2 className="font-playfair text-xl font-bold text-charcoal">Activité par jour</h2>
            {bestDow && (
              <span className="font-syne text-xs font-bold bg-forest text-cream px-3 py-1 rounded-full shrink-0">
                📅 Pic : {bestDow.label}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ordersByDow}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontFamily: 'Syne', fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'DM Sans', fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => [v, 'Commandes']} contentStyle={{ borderRadius: 12, border: 'none' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {ordersByDow.map((entry, i) => (
                  <Cell key={i} fill={bestDow && entry.label === bestDow.label ? C.safran : C.forest} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="font-dm text-xs text-charcoal/30 mt-2 text-center">Sur les 90 derniers jours</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Status pie */}
        <div className="bg-white rounded-3xl p-6 shadow-card">
          <h2 className="font-playfair text-xl font-bold text-charcoal mb-5">Statuts commandes</h2>
          <div className="flex items-center gap-4">
            <PieChart width={160} height={160}>
              <Pie data={pieData} cx={75} cy={75} innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={0}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
            </PieChart>
            <div className="flex-1 space-y-2">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="font-dm text-xs text-charcoal/70 flex-1">{d.name}</span>
                  <span className="font-syne text-xs font-bold text-charcoal">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top boutiques */}
        <div className="bg-white rounded-3xl p-6 shadow-card">
          <h2 className="font-playfair text-xl font-bold text-charcoal mb-5">Top boutiques (CA)</h2>
          <div className="space-y-3">
            {topShops.map((ts, i) => (
              <div key={ts.shopId} className="flex items-center gap-3">
                <span className="font-playfair text-2xl font-bold text-charcoal/20 w-7 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-syne text-sm font-bold text-charcoal truncate">{ts.shop?.name}</p>
                    {ts.shop?.certified && <span className="font-syne text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">✓</span>}
                  </div>
                  <div className="w-full bg-charcoal/6 rounded-full h-1.5 mt-1.5">
                    <div className="bg-forest h-1.5 rounded-full" style={{ width: `${Math.min(100, (ts._sum?.total / (topShops[0]?._sum?.total || 1)) * 100)}%` }} />
                  </div>
                </div>
                <p className="font-syne text-sm font-bold text-forest shrink-0">{fmt(ts._sum?.total)} F</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top produits plateforme */}
      {topProducts.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-card">
          <h2 className="font-playfair text-xl font-bold text-charcoal mb-5">Top 10 produits — plateforme</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-charcoal/8">
                  {['#', 'Produit', 'Boutique', 'Qté vendue', 'CA estimé'].map((h, i) => (
                    <th key={h} className={`pb-3 font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider ${i < 3 ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {topProducts.map((p, i) => (
                  <tr key={p.productId} className="hover:bg-cream/30 transition-colors">
                    <td className="py-3 pr-3">
                      <span className="font-playfair text-xl font-bold text-charcoal/20">{i + 1}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        {p.image && <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />}
                        <span className="font-syne text-sm font-bold text-charcoal">{p.name}</span>
                        {i === 0 && <span className="text-xs">⭐</span>}
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-dm text-xs text-charcoal/50">{p.shopName}</td>
                    <td className="py-3 pr-4 text-right font-syne text-sm font-bold text-charcoal">{(p.quantity || 0).toLocaleString('fr-FR')}</td>
                    <td className="py-3 text-right font-syne text-sm font-bold text-forest">{fmt(p.revenue)} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
