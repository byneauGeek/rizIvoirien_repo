import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { fmt } from '../../utils/status'
import { buildDriverTips } from '../../utils/analytics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function ScoreCircle({ score }) {
  const r = 70
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#1B4332' : score >= 60 ? '#E8A217' : '#C4501A'

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={r} fill="none" stroke="#f0f0f0" strokeWidth="12" />
          <circle
            cx="80" cy="80" r={r}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-playfair text-5xl font-bold text-charcoal">{score}</span>
          <span className="font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider">/ 100</span>
        </div>
      </div>
      <p className="font-syne text-sm font-bold text-charcoal mt-2">Score global</p>
    </div>
  )
}

export default function PerformanceTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/drivers/performance').then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" /></div>
  )

  const { score, badges, monthlyData, stats, badge, nextBadge, penaltyThresholds, platformAvg } = data || {}
  const { warningCount = 0, acceptanceRate = 100, autoSuspended = false } = stats || {}
  const thresholds = penaltyThresholds || { warn1: 70, warn2: 50, suspend: 30 }

  const riskLevel = autoSuspended ? 'suspended'
    : acceptanceRate <= thresholds.warn2 ? 'high'
    : acceptanceRate <= thresholds.warn1 ? 'medium'
    : 'none'

  const riskConfig = {
    suspended: {
      bg: 'bg-red-50 border-red-200',
      icon: '⛔',
      title: 'Compte suspendu automatiquement',
      body: `Votre taux d'acceptation est trop faible (${acceptanceRate}%). Contactez l'administration pour rétablir votre accès.`,
    },
    high: {
      bg: 'bg-orange-50 border-orange-200',
      icon: '🚨',
      title: `Avertissement ${warningCount}/2 — risque de suspension`,
      body: `Votre taux d'acceptation (${acceptanceRate}%) est très bas. En dessous de ${thresholds.suspend}%, votre compte sera suspendu automatiquement.`,
    },
    medium: {
      bg: 'bg-amber-50 border-amber-200',
      icon: '⚠️',
      title: `Avertissement ${warningCount}/2`,
      body: `Votre taux d'acceptation (${acceptanceRate}%) est en dessous du seuil recommandé. Acceptez plus de courses pour l'améliorer.`,
    },
  }

  const rateColor = acceptanceRate >= thresholds.warn1 ? 'text-charcoal'
    : acceptanceRate >= thresholds.warn2 ? 'text-amber-600'
    : acceptanceRate >= thresholds.suspend ? 'text-orange-600'
    : 'text-red-600'

  return (
    <div className="space-y-6">
      <h2 className="font-playfair text-2xl font-bold text-charcoal">Ma performance</h2>

      {/* Bannière de risque */}
      {riskLevel !== 'none' && (
        <div className={`border rounded-2xl p-4 flex items-start gap-3 ${riskConfig[riskLevel].bg}`}>
          <span className="text-xl shrink-0">{riskConfig[riskLevel].icon}</span>
          <div>
            <p className="font-syne text-sm font-bold text-charcoal">{riskConfig[riskLevel].title}</p>
            <p className="font-dm text-sm text-charcoal/70 mt-0.5">{riskConfig[riskLevel].body}</p>
          </div>
        </div>
      )}

      {/* Score + stats */}
      <div className="bg-white rounded-3xl p-6 shadow-card">
        <div className="flex flex-col items-center mb-6">
          <ScoreCircle score={score ?? 0} />
          {badge && (
            <div className="mt-4 flex items-center gap-2 bg-forest text-cream px-5 py-2 rounded-full">
              <span className="text-lg">{badge.icon}</span>
              <span className="font-syne text-sm font-bold">{badge.label}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Livraisons', value: stats?.totalDeliveries ?? 0, unit: '', cls: 'text-charcoal' },
            { label: 'Acceptation', value: acceptanceRate, unit: '%', cls: rateColor },
            { label: 'Note', value: stats?.rating ?? 0, unit: '★', cls: 'text-charcoal' },
          ].map(({ label, value, unit, cls }) => (
            <div key={label} className="text-center bg-cream rounded-2xl p-4">
              <p className={`font-playfair text-2xl font-bold ${cls}`}>{value}{unit}</p>
              <p className="font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Conseils personnalisés */}
      {(() => {
        const tips = buildDriverTips({ stats: { ...stats, acceptanceRate: stats?.acceptanceRate }, platformAvg, nextBadge })
        if (!tips.length) return null
        return (
          <div className="space-y-3">
            <h3 className="font-playfair text-lg font-bold text-charcoal">Conseils personnalisés</h3>
            {tips.map((tip, i) => {
              const styles = { success: 'bg-green-50 border-green-200', warning: 'bg-amber-50 border-amber-200', info: 'bg-blue-50 border-blue-200' }
              return (
                <div key={i} className={`flex items-start gap-3 border rounded-2xl px-4 py-3 ${styles[tip.type] || styles.info}`}>
                  <span className="text-lg shrink-0 mt-0.5">{tip.icon}</span>
                  <div>
                    <p className="font-syne text-sm font-bold text-charcoal">{tip.title}</p>
                    <p className="font-dm text-xs text-charcoal/60 mt-0.5 leading-relaxed">{tip.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Comparaison plateforme */}
      {platformAvg && (
        <div className="bg-white rounded-3xl p-6 shadow-card">
          <h3 className="font-playfair text-lg font-bold text-charcoal mb-5">Vous vs Plateforme</h3>
          <div className="space-y-4">
            {[
              { label: 'Note ★', mine: Math.round((stats?.rating || 0) / 5 * 100), platform: Math.round((platformAvg.rating || 0) / 5 * 100), mineLabel: `${stats?.rating}★`, platformLabel: `${platformAvg.rating}★` },
              { label: 'Acceptation', mine: stats?.acceptanceRate || 0, platform: platformAvg.acceptanceRate || 0, mineLabel: `${stats?.acceptanceRate}%`, platformLabel: `${platformAvg.acceptanceRate}%` },
            ].map(({ label, mine, platform, mineLabel, platformLabel }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-syne text-xs font-bold text-charcoal/50 uppercase tracking-wider">{label}</span>
                  <div className="flex items-center gap-4 text-xs font-syne font-bold">
                    <span className="text-forest">{mineLabel} (vous)</span>
                    <span className="text-charcoal/30">vs {platformLabel} (moy.)</span>
                  </div>
                </div>
                <div className="relative h-3 bg-charcoal/6 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-charcoal/15 rounded-full" style={{ width: `${Math.min(100, platform)}%` }} />
                  <div className={`absolute inset-y-0 left-0 rounded-full ${mine >= platform ? 'bg-forest' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, mine)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next badge */}
      {nextBadge && (
        <div className="bg-forest/5 border border-forest/10 rounded-3xl p-5">
          <p className="font-syne text-xs font-bold tracking-wider uppercase text-forest mb-3">Prochain badge</p>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{nextBadge.icon}</span>
            <div>
              <p className="font-syne font-bold text-charcoal">{nextBadge.label}</p>
              <p className="font-dm text-xs text-charcoal/50">
                {nextBadge.minDeliveries} livraisons · {Math.round(nextBadge.minRate * 100)}% acceptation
              </p>
            </div>
          </div>
          {/* Barre progression livraisons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-syne font-bold">
              <span className="text-charcoal/50">Livraisons</span>
              <span className="text-charcoal">{stats?.totalDeliveries}/{nextBadge.minDeliveries}</span>
            </div>
            <div className="h-2.5 bg-charcoal/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-forest rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, ((stats?.totalDeliveries || 0) / nextBadge.minDeliveries) * 100)}%` }}
              />
            </div>
            <p className="font-dm text-xs text-charcoal/40">
              {Math.max(0, nextBadge.minDeliveries - (stats?.totalDeliveries || 0))} livraison{nextBadge.minDeliveries - (stats?.totalDeliveries || 0) > 1 ? 's' : ''} restante{nextBadge.minDeliveries - (stats?.totalDeliveries || 0) > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Badges grid */}
      <div className="bg-white rounded-3xl p-6 shadow-card">
        <h3 className="font-playfair text-xl font-bold text-charcoal mb-5">Badges</h3>
        <div className="grid grid-cols-2 gap-3">
          {badges?.map(b => (
            <div key={b.id} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${b.unlocked ? 'border-forest bg-forest/5' : 'border-charcoal/8 opacity-40 grayscale'}`}>
              <span className="text-2xl">{b.icon}</span>
              <div>
                <p className="font-syne text-sm font-bold text-charcoal">{b.label}</p>
                <p className="font-dm text-xs text-charcoal/40">{b.minDeliveries}+ livraisons</p>
              </div>
              {b.unlocked && <span className="ml-auto text-forest">✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Monthly chart */}
      <div className="bg-white rounded-3xl p-6 shadow-card">
        <h3 className="font-playfair text-xl font-bold text-charcoal mb-5">Livraisons mensuelles</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontFamily: 'Syne', fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontFamily: 'DM Sans', fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => [v, 'Livraisons']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'DM Sans' }} />
            <Bar dataKey="deliveries" fill="#1B4332" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-safran/10 rounded-3xl p-6 flex items-center justify-between gap-6">
        <div>
          <p className="font-syne text-xs font-bold text-safran-dark uppercase tracking-wider mb-1">Gains ce mois</p>
          <p className="font-playfair text-3xl font-bold text-charcoal">
            {fmt(stats?.monthlyEarnings ?? 0)} <span className="text-base font-dm font-normal text-charcoal/50">FCFA</span>
          </p>
        </div>
        <div className="w-px h-12 bg-safran/20 shrink-0" />
        <div>
          <p className="font-syne text-xs font-bold text-safran-dark uppercase tracking-wider mb-1">Total historique</p>
          <p className="font-playfair text-3xl font-bold text-charcoal">
            {fmt(stats?.totalEarnings ?? 0)} <span className="text-base font-dm font-normal text-charcoal/50">FCFA</span>
          </p>
        </div>
      </div>
    </div>
  )
}
