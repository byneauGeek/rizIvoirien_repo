import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { fmt } from '../../utils/status'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, Truck, Percent, DollarSign } from 'lucide-react'

const C = { forest: '#1B4332', safran: '#E8A217', terra: '#C4501A', grid: '#f0f0f0' }

export default function FinanceTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/finance').then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
    </div>
  )

  const { totalGMV = 0, monthGMV = 0, platformCommission = 0, driverPayouts = 0, netRevenue = 0, deliveredCount = 0, monthly = [], rate = 0.05, deliveryShare = 0.15 } = data || {}
  // deliveryShare comes from backend as the driverCommission rate

  const kpis = [
    { label: 'GMV total', value: totalGMV, unit: 'FCFA', icon: TrendingUp, color: 'text-forest', bg: 'bg-forest/10' },
    { label: 'GMV ce mois', value: monthGMV, unit: 'FCFA', icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Commission plateforme', value: platformCommission, unit: 'FCFA', icon: Percent, color: 'text-safran', bg: 'bg-safran/10', note: `${(rate * 100).toFixed(0)}%` },
    { label: 'Reversé aux livreurs', value: driverPayouts, unit: 'FCFA', icon: Truck, color: 'text-terra', bg: 'bg-terra/10', note: `${(deliveryShare * 100).toFixed(0)}%` },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Finance</p>
        <h1 className="font-playfair text-4xl font-bold text-charcoal">Tableau financier</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, unit, icon: Icon, color, bg, note }) => (
          <div key={label} className="bg-white rounded-3xl p-5 shadow-card">
            <div className={`w-10 h-10 ${bg} rounded-2xl flex items-center justify-center mb-4`}>
              <Icon size={18} className={color} />
            </div>
            <p className="font-playfair text-2xl font-bold text-charcoal">{fmt(value)}</p>
            <p className="font-dm text-xs text-charcoal/40 mt-0.5">{unit}</p>
            <p className="font-syne text-xs font-bold text-charcoal/60 mt-2">{label}</p>
            {note && <p className="font-syne text-[10px] text-charcoal/30 mt-0.5">Taux : {note}</p>}
          </div>
        ))}
      </div>

      {/* Net revenue summary */}
      <div className="bg-charcoal rounded-3xl p-6 text-cream flex items-center justify-between">
        <div>
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-cream/40 mb-1">Revenu net plateforme</p>
          <p className="font-playfair text-4xl font-bold">{fmt(netRevenue)}</p>
          <p className="font-dm text-sm text-cream/50 mt-1">FCFA · {deliveredCount} livraisons complétées</p>
        </div>
        <div className="text-6xl opacity-20">💰</div>
      </div>

      {/* Monthly chart */}
      <div className="bg-white rounded-3xl p-6 shadow-card">
        <h3 className="font-playfair text-xl font-bold text-charcoal mb-6">Évolution sur 6 mois</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthly} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="month" tick={{ fontFamily: 'Syne', fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontFamily: 'DM Sans', fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
            <Tooltip
              formatter={(v, name) => [`${fmt(v)} FCFA`, name === 'gmv' ? 'GMV' : name === 'commission' ? 'Commission' : 'Frais livraison']}
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'DM Sans' }}
            />
            <Legend formatter={v => v === 'gmv' ? 'GMV' : v === 'commission' ? 'Commission' : 'Frais livraison'} />
            <Bar dataKey="gmv" fill={C.forest} radius={[6,6,0,0]} />
            <Bar dataKey="commission" fill={C.safran} radius={[6,6,0,0]} />
            <Bar dataKey="deliveryFees" fill={C.terra} radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rates info */}
      <div className="bg-forest/5 rounded-3xl p-5 border border-forest/10">
        <p className="font-syne text-xs font-bold uppercase tracking-wider text-forest mb-3">Paramètres actuels</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-4">
            <p className="font-dm text-xs text-charcoal/40 mb-1">Commission vendeur</p>
            <p className="font-playfair text-2xl font-bold text-charcoal">{(rate * 100).toFixed(0)}%</p>
            <p className="font-dm text-xs text-charcoal/40 mt-0.5">du montant de commande</p>
          </div>
          <div className="bg-white rounded-2xl p-4">
            <p className="font-dm text-xs text-charcoal/40 mb-1">Part livreur</p>
            <p className="font-playfair text-2xl font-bold text-charcoal">{(deliveryShare * 100).toFixed(0)}%</p>
            <p className="font-dm text-xs text-charcoal/40 mt-0.5">des frais de livraison</p>
          </div>
        </div>
        <p className="font-dm text-xs text-charcoal/40 mt-3">Modifiez ces taux dans l'onglet Paramètres.</p>
      </div>
    </div>
  )
}
