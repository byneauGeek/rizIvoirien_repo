import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { platformHealthScore } from '../../utils/analytics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const C = { forest: '#1B4332', safran: '#E8A217', terra: '#C4501A', grid: '#f4f4f4' }

function HealthGauge({ score }) {
  const r = 60
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#1B4332' : score >= 60 ? '#E8A217' : score >= 40 ? '#F97316' : '#EF4444'
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'À améliorer' : 'Critique'
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#f0f0f0" strokeWidth="12" />
          <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.2s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-playfair text-3xl font-bold text-charcoal">{score}</span>
          <span className="font-syne text-[9px] font-bold text-charcoal/40 uppercase">/100</span>
        </div>
      </div>
      <span className="font-syne text-sm font-bold mt-1" style={{ color }}>{label}</span>
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

export default function GlobalAnalyticsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true); setError(null)
    api.get('/admin/global-analytics').then(setData).catch(e => setError(e.message)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
    </div>
  )

  // Un échec de chargement ne doit jamais se traduire par un "Taux de
  // livraison faible (0%)" — les insights ci-dessous liraient sinon un vrai
  // signal d'alarme là où il n'y a en réalité qu'une panne de chargement.
  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="font-playfair text-xl font-bold text-charcoal mb-2">Impossible de charger l'analytique globale</p>
      <p className="font-dm text-charcoal/50 mb-6">{error}</p>
      <button onClick={load} className="bg-forest text-cream font-syne font-bold px-6 py-2.5 rounded-xl hover:bg-forest-light transition-colors">Réessayer</button>
    </div>
  )

  const { productsByCategory = [], topDrivers = [], deliveryRate = 0, cancellationRate = 0, platformAvg } = data || {}

  const healthScore = platformHealthScore({
    deliveryRate,
    cancellationRate,
    avgRating: platformAvg?.shopRating || 4.0,
    repeatBuyerRate: 0,
  })

  const insights = []
  if (deliveryRate < 80)
    insights.push({ icon: '🚨', type: 'warning', title: `Taux de livraison faible (${deliveryRate}%)`, body: 'En dessous de 80%, la plateforme perd en fiabilité. Vérifiez la disponibilité des livreurs.' })
  if (cancellationRate > 10)
    insights.push({ icon: '⚠️', type: 'warning', title: `Taux d'annulation élevé (${cancellationRate}%)`, body: 'Analysez les raisons : rupture de stock, délais boutiques, problèmes de paiement.' })
  if (deliveryRate >= 90)
    insights.push({ icon: '✅', type: 'success', title: `Excellente performance logistique (${deliveryRate}%)`, body: 'Le réseau de livraison fonctionne très bien. Continuez à valoriser les bons livreurs.' })
  if (platformAvg?.driverRating && platformAvg.driverRating >= 4.5)
    insights.push({ icon: '⭐', type: 'success', title: `Livreurs très bien notés (${platformAvg.driverRating}★ en moyenne)`, body: 'La satisfaction livraison est haute. Mettez en avant ces scores dans votre communication.' })
  if (platformAvg?.driverAcceptance && platformAvg.driverAcceptance < 65)
    insights.push({ icon: '📱', type: 'warning', title: `Taux d'acceptation moyen faible (${platformAvg.driverAcceptance}%)`, body: 'Les livreurs refusent trop d\'offres. Vérifiez la tarification et la zone de livraison.' })
  if (topDrivers.length > 0)
    insights.push({ icon: '🏆', type: 'info', title: `Meilleur livreur : ${topDrivers[0].user?.name} (${topDrivers[0].totalDeliveries} livraisons)`, body: `Note : ${topDrivers[0].rating?.toFixed(1)}★ · Acceptation : ${Math.round((topDrivers[0].acceptanceRate || 0) * 100)}%` })

  return (
    <div className="space-y-8">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Analytique</p>
        <h1 className="font-playfair text-4xl font-bold text-charcoal">Analytique globale</h1>
      </div>

      {/* Score santé + taux */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 shadow-card flex flex-col items-center justify-center gap-4">
          <p className="font-syne text-xs font-bold uppercase tracking-widest text-charcoal/40">Score de santé</p>
          <HealthGauge score={healthScore} />
          <div className="w-full space-y-2">
            {[
              { label: 'Livraison', value: deliveryRate },
              { label: 'Non-annulation', value: 100 - cancellationRate },
              { label: 'Note boutiques', value: Math.round(((platformAvg?.shopRating || 4) / 5) * 100) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="font-dm text-[10px] text-charcoal/40 w-24 shrink-0">{label}</span>
                <div className="flex-1 bg-charcoal/6 rounded-full h-1.5">
                  <div className="bg-forest h-1.5 rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
                </div>
                <span className="font-syne text-[10px] font-bold text-charcoal/60 w-8 text-right">{value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-forest text-cream rounded-3xl p-6">
          <p className="font-syne text-xs font-bold uppercase tracking-widest text-cream/50 mb-2">Taux de livraison</p>
          <p className="font-playfair text-5xl font-bold text-safran">{deliveryRate}%</p>
          <div className="w-full bg-cream/10 rounded-full h-2 mt-4">
            <div className="bg-safran h-2 rounded-full transition-all" style={{ width: `${deliveryRate}%` }} />
          </div>
          {platformAvg && (
            <div className="mt-4 pt-4 border-t border-cream/10 grid grid-cols-2 gap-3">
              <div>
                <p className="font-syne text-[10px] font-bold text-cream/40 uppercase">Note moy. livreurs</p>
                <p className="font-playfair text-xl font-bold text-cream">{platformAvg.driverRating}★</p>
              </div>
              <div>
                <p className="font-syne text-[10px] font-bold text-cream/40 uppercase">Acceptation moy.</p>
                <p className="font-playfair text-xl font-bold text-cream">{platformAvg.driverAcceptance}%</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-card">
          <p className="font-syne text-xs font-bold uppercase tracking-widest text-charcoal/40 mb-2">Taux d'annulation</p>
          <p className="font-playfair text-5xl font-bold text-terra">{cancellationRate}%</p>
          <div className="w-full bg-charcoal/8 rounded-full h-2 mt-4">
            <div className="bg-terra h-2 rounded-full" style={{ width: `${Math.min(100, cancellationRate * 5)}%` }} />
          </div>
          <p className="font-dm text-xs text-charcoal/50 mt-3">
            {cancellationRate <= 5 ? '✅ Taux excellent' : cancellationRate <= 15 ? '⚠️ Taux acceptable' : '🚨 Taux élevé — à surveiller'}
          </p>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-playfair text-xl font-bold text-charcoal">Insights globaux</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
          </div>
        </div>
      )}

      {/* Produits par catégorie */}
      <div className="bg-white rounded-3xl p-6 shadow-card">
        <h2 className="font-playfair text-2xl font-bold text-charcoal mb-6">Produits par catégorie</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={productsByCategory.map(c => ({ name: c.category, count: c._count?.id, stock: c._sum?.stock }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontFamily: 'Syne', fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontFamily: 'DM Sans', fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
            <Bar dataKey="count" name="Produits" fill={C.forest} radius={[6, 6, 0, 0]} />
            <Bar dataKey="stock"  name="Stock"    fill={C.safran} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top livreurs */}
      <div className="bg-white rounded-3xl p-6 shadow-card">
        <h2 className="font-playfair text-2xl font-bold text-charcoal mb-6">Top livreurs</h2>
        <div className="space-y-3">
          {topDrivers.map((d, i) => (
            <div key={d.id} className="flex items-center gap-4">
              <span className="font-playfair text-2xl font-bold text-charcoal/20 w-7 text-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-syne text-sm font-bold text-charcoal">{d.user?.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 bg-charcoal/8 rounded-full h-1.5">
                    <div className="bg-forest h-1.5 rounded-full" style={{ width: `${Math.min(100, (d.totalDeliveries / (topDrivers[0]?.totalDeliveries || 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-syne text-sm font-bold text-charcoal">{d.totalDeliveries} livraisons</p>
                <p className="font-dm text-xs text-charcoal/40">★ {d.rating?.toFixed(1)} · {Math.round((d.acceptanceRate || 0) * 100)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
