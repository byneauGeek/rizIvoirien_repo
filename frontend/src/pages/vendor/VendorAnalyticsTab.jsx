import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { TrendingUp, TrendingDown, Minus, ShoppingBag, BarChart2, XCircle, Star, Lock } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { forecastMonth, buildVendorInsights } from '../../utils/analytics'

const fmt  = n => Number(n || 0).toLocaleString('fr-FR')
const fmtK = n => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'k' : String(n)

const STATUS_LABELS = {
  PENDING:        'En attente',
  CONFIRMED:      'Confirmée',
  EN_PREPARATION: 'En préparation',
  PRET:           'Prête',
  IN_TRANSIT:     'En livraison',
  DELIVERED:      'Livrée',
  CANCELLED:      'Annulée',
}
const STATUS_COLORS = {
  PENDING:        '#F59E0B',
  CONFIRMED:      '#3B82F6',
  EN_PREPARATION: '#6366F1',
  PRET:           '#A855F7',
  IN_TRANSIT:     '#06B6D4',
  DELIVERED:      '#22C55E',
  CANCELLED:      '#EF4444',
}

/* ── Tooltip personnalisé (recharts) ── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0F1923] text-white rounded-xl px-3 py-2 shadow-xl text-xs font-dm min-w-[120px]">
      <p className="font-syne font-bold mb-1 text-white/60">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : <span className="font-bold">{fmt(p.value)}{p.dataKey === 'revenue' ? ' FCFA' : ''}</span>
        </p>
      ))}
    </div>
  )
}

/* ── KPI card ── */
function KpiCard({ label, value, sub, icon: Icon, color, trend }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-syne font-bold px-2 py-0.5 rounded-full ${
            trend > 0  ? 'bg-green-50 text-green-600' :
            trend < 0  ? 'bg-red-50 text-red-500'    :
                         'bg-gray-50 text-charcoal/40'
          }`}>
            {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {trend > 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
      <div>
        <p className="font-playfair text-2xl font-bold text-charcoal">{value}</p>
        <p className="font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider mt-0.5">{label}</p>
        {sub && <p className="font-dm text-xs text-charcoal/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function VendorAnalyticsTab({ restrictions = { basicCanAnalytics: true }, shopPlan = 'BASIC' }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  const restricted = shopPlan === 'BASIC' && !restrictions.basicCanAnalytics

  useEffect(() => {
    if (restricted) { setLoading(false); return }
    api.get('/shops/my/analytics')
      .then(setData)
      .catch(e => setError(e.message || 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [restricted])

  if (restricted) return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-5">
      <div className="w-16 h-16 rounded-3xl bg-amber-50 flex items-center justify-center">
        <Lock size={28} className="text-amber-500" />
      </div>
      <div>
        <h2 className="font-playfair text-2xl font-bold text-charcoal mb-2">Analytiques réservées au plan Certifié</h2>
        <p className="font-dm text-sm text-charcoal/50 max-w-sm mx-auto">
          L'accès aux statistiques détaillées est une fonctionnalité réservée aux boutiques certifiées.
          Passez au plan Certifié pour débloquer les graphiques de ventes, le CA mensuel et l'analyse des commandes.
        </p>
      </div>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('vendor-navigate', { detail: 'subscription' }))}
        className="bg-[#E8A217] text-charcoal font-syne font-bold px-6 py-3 rounded-2xl hover:bg-[#E8A217]/80 transition-colors"
      >
        Passer au plan Certifié →
      </button>
    </div>
  )

  if (loading) return (
    <div className="flex justify-center py-24">
      <div className="w-7 h-7 border-2 border-[#E8A217]/30 border-t-[#E8A217] rounded-full animate-spin" />
    </div>
  )

  if (error || !data) return (
    <div className="py-20 text-center font-dm text-charcoal/40">{error || 'Données indisponibles'}</div>
  )

  const caGrowth = data.caLastMonth
    ? Math.round(((data.caMonth - data.caLastMonth) / data.caLastMonth) * 100)
    : 0

  const maxRevenue = Math.max(...(data.revenueByProduct || []).map(r => r.revenue), 1)
  const maxStatus  = Math.max(...(data.statusDist || []).map(s => s.count), 1)

  const dayOfMonth = new Date().getDate()
  const forecast   = forecastMonth(data.caMonth || 0, dayOfMonth)
  const forecastGrowth = data.caLastMonth > 0 ? Math.round(((forecast - data.caLastMonth) / data.caLastMonth) * 100) : null

  const insights = buildVendorInsights({
    revenueByProduct: data.revenueByProduct,
    stockVelocity: data.stockVelocity,
    dailyStats: data.dailyStats,
    caMonth: data.caMonth,
    caLastMonth: data.caLastMonth,
  })

  const bestDow = (data.ordersByDow || []).length > 0
    ? data.ordersByDow.reduce((a, b) => b.orders > a.orders ? b : a)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Boutique</p>
        <h1 className="font-playfair text-3xl font-bold text-charcoal">Analytiques</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="CA ce mois"
          value={`${fmtK(data.caMonth)} FCFA`}
          sub={`Mois dernier : ${fmtK(data.caLastMonth)} FCFA`}
          icon={TrendingUp}
          color="bg-[#E8A217]"
          trend={caGrowth}
        />
        <KpiCard
          label="Commandes livrées"
          value={fmt(data.totalDelivered)}
          sub="Statut DELIVERED"
          icon={ShoppingBag}
          color="bg-green-500"
        />
        <KpiCard
          label="Panier moyen"
          value={`${fmt(data.avgOrderValue)} FCFA`}
          sub="Sur commandes livrées"
          icon={BarChart2}
          color="bg-blue-500"
        />
        <KpiCard
          label="Taux d'annulation"
          value={`${data.cancellationRate}%`}
          sub="Sur toutes les commandes"
          icon={XCircle}
          color={data.cancellationRate > 15 ? 'bg-red-500' : 'bg-charcoal/60'}
        />
      </div>

      {/* Prévision fin de mois */}
      {forecast > 0 && (
        <div className="bg-gradient-to-br from-forest to-[#2D6A4F] text-cream rounded-3xl p-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-syne text-xs font-bold uppercase tracking-widest text-cream/50 mb-1">Prévision fin de mois</p>
            <p className="font-playfair text-4xl font-bold">{fmtK(forecast)} <span className="text-base font-dm font-normal text-cream/60">FCFA</span></p>
            <p className="font-dm text-sm text-cream/60 mt-1">
              {forecastGrowth !== null
                ? (forecastGrowth >= 0 ? `↑ +${forecastGrowth}% vs mois dernier` : `↓ ${forecastGrowth}% vs mois dernier`)
                : `Jour ${dayOfMonth}/30 — extrapolation linéaire`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-syne text-xs font-bold text-cream/40 uppercase mb-1">Ce mois (actuel)</p>
            <p className="font-playfair text-2xl font-bold text-safran">{fmtK(data.caMonth)} FCFA</p>
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <p className="font-syne text-sm font-bold text-charcoal uppercase tracking-wider">Insights</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((ins, i) => {
              const styles = { success: 'bg-green-50 border-green-200', warning: 'bg-amber-50 border-amber-200', info: 'bg-blue-50 border-blue-200' }
              return (
                <div key={i} className={`flex items-start gap-3 border rounded-2xl px-4 py-3 ${styles[ins.type] || styles.info}`}>
                  <span className="text-lg shrink-0 mt-0.5">{ins.icon}</span>
                  <div>
                    <p className="font-syne text-sm font-bold text-charcoal">{ins.title}</p>
                    <p className="font-dm text-xs text-charcoal/60 mt-0.5 leading-relaxed">{ins.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Commandes + Revenus par jour */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
        <p className="font-syne text-sm font-bold text-charcoal mb-1">Activité — 30 derniers jours</p>
        <p className="font-dm text-xs text-charcoal/40 mb-5">Commandes reçues et revenus (livrées)</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.dailyStats} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#E8A217" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#E8A217" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={d => {
                const dt = new Date(d)
                return `${dt.getDate()}/${dt.getMonth() + 1}`
              }}
              tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'DM Sans' }}
              axisLine={false} tickLine={false}
              interval={4}
            />
            <YAxis
              yAxisId="revenue"
              orientation="right"
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'DM Sans' }}
              axisLine={false} tickLine={false} width={48}
            />
            <YAxis
              yAxisId="orders"
              orientation="left"
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'DM Sans' }}
              axisLine={false} tickLine={false} width={28}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId="revenue"
              type="monotone" dataKey="revenue" name="Revenus"
              stroke="#E8A217" strokeWidth={2}
              fill="url(#gradRevenue)" dot={false} activeDot={{ r: 4, fill: '#E8A217' }}
            />
            <Area
              yAxisId="orders"
              type="monotone" dataKey="orders" name="Commandes"
              stroke="#6366F1" strokeWidth={2}
              fill="url(#gradOrders)" dot={false} activeDot={{ r: 4, fill: '#6366F1' }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-5 mt-3 justify-end">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded bg-[#E8A217] inline-block" />
            <span className="font-dm text-[11px] text-charcoal/40">Revenus (FCFA)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded bg-indigo-500 inline-block" />
            <span className="font-dm text-[11px] text-charcoal/40">Commandes</span>
          </div>
        </div>
      </div>

      {/* Revenus par produit + Distribution statuts */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Top produits */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
          <p className="font-syne text-sm font-bold text-charcoal mb-1">Top produits</p>
          <p className="font-dm text-xs text-charcoal/40 mb-5">Revenus générés (commandes livrées)</p>
          {data.revenueByProduct.length === 0 ? (
            <p className="font-dm text-sm text-charcoal/30 text-center py-8">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {data.revenueByProduct.map((r, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {i === 0 && <Star size={11} className="text-[#E8A217] fill-[#E8A217] shrink-0" />}
                      <span className="font-dm text-xs text-charcoal truncate">{r.name}</span>
                    </div>
                    <span className="font-syne text-xs font-bold text-charcoal shrink-0 ml-2">
                      {fmtK(r.revenue)} FCFA
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(r.revenue / maxRevenue) * 100}%`,
                        background: i === 0
                          ? 'linear-gradient(90deg, #E8A217, #f5c056)'
                          : `hsl(${220 + i * 18}, 70%, 55%)`,
                      }}
                    />
                  </div>
                  <p className="font-dm text-[10px] text-charcoal/30 mt-0.5">{fmt(r.quantity)} unités</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distribution statuts */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
          <p className="font-syne text-sm font-bold text-charcoal mb-1">Distribution des commandes</p>
          <p className="font-dm text-xs text-charcoal/40 mb-5">Par statut, toutes périodes</p>
          {data.statusDist.length === 0 ? (
            <p className="font-dm text-sm text-charcoal/30 text-center py-8">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {data.statusDist
                .sort((a, b) => b.count - a.count)
                .map(s => {
                  const color  = STATUS_COLORS[s.status] || '#9ca3af'
                  const label  = STATUS_LABELS[s.status] || s.status
                  const pct    = Math.round((s.count / maxStatus) * 100)
                  return (
                    <div key={s.status}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          <span className="font-dm text-xs text-charcoal">{label}</span>
                        </div>
                        <span className="font-syne text-xs font-bold text-charcoal">{s.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* Commandes par jour de semaine */}
      {(data.ordersByDow || []).some(d => d.orders > 0) && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
          <div className="flex items-start justify-between mb-1">
            <p className="font-syne text-sm font-bold text-charcoal">Activité par jour de semaine</p>
            {bestDow && (
              <span className="font-syne text-xs font-bold bg-[#1B4332] text-white px-3 py-1 rounded-full shrink-0">
                📅 Pic : {bestDow.label}
              </span>
            )}
          </div>
          <p className="font-dm text-xs text-charcoal/40 mb-5">Commandes reçues sur 30 jours</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.ordersByDow}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontFamily: 'Syne', fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'DM Sans', fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip formatter={v => [v, 'Commandes']} contentStyle={{ borderRadius: 12, border: 'none' }} />
              <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                {(data.ordersByDow || []).map((entry, i) => (
                  <Cell key={i} fill={bestDow && entry.label === bestDow.label ? '#E8A217' : '#1B4332'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
