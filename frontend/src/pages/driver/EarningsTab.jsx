import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { fmt, fmtDate, fmtOrderId } from '../../utils/status'
import { forecastMonth } from '../../utils/analytics'
import { TrendingUp, Crown, ShieldCheck } from 'lucide-react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0F1923] rounded-2xl px-4 py-3 shadow-xl">
      <p className="font-syne text-xs font-bold text-white/50 uppercase tracking-wider mb-2">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="font-dm text-sm" style={{ color: p.color }}>
          {p.name} : <span className="font-bold">{p.dataKey === 'earnings' ? `${fmt(p.value)} F` : p.value}</span>
        </p>
      ))}
    </div>
  )
}

const REMUNERATION_STATUS_LABELS = {
  DRAFT: 'Brouillon', CALCULATED: 'Calculée', PENDING_VALIDATION: 'En attente de validation',
  VALIDATED: 'Validée', PAYMENT_PENDING: 'Paiement en cours', PAYMENT_PROCESSING: 'Paiement en cours',
  PAID: 'Payée', REJECTED: 'Rejetée', CANCELLED: 'Annulée', PAYMENT_FAILED: 'Échec de paiement',
  // Statuts PaymentOrder (vocabulaire différent de Remuneration)
  PENDING_CONTROL: 'En contrôle', ON_HOLD: 'En attente', PROCESSING: 'En cours de paiement', FAILED: 'Échec',
}

export default function EarningsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // LOT 12 (Espace livreur) : le LOT 7 avait ajouté cette lecture côté API
  // mais aucune page ne l'affichait encore — le livreur n'avait toujours
  // aucun moyen de voir ses rémunérations OFFICIELLES (comptabilité),
  // seulement ce cumul temps réel non officiel.
  const [remunerations, setRemunerations] = useState([])

  const load = () => {
    setLoading(true); setError(null)
    api.get('/drivers/earnings').then(setData).catch(e => setError(e.message)).finally(() => setLoading(false))
    // Best-effort : les rémunérations officielles sont un complément
    // (section séparée plus bas), leur échec ne doit pas empêcher
    // l'affichage du cumul temps réel qui est l'information principale.
    api.get('/drivers/me/remunerations').then(({ remunerations }) => setRemunerations(remunerations || [])).catch(() => {})
  }

  useEffect(load, [])

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="font-playfair text-xl font-bold text-charcoal mb-2">Impossible de charger vos gains</p>
      <p className="font-dm text-charcoal/50 mb-6">{error}</p>
      <button onClick={load} className="btn-primary">Réessayer</button>
    </div>
  )

  const {
    earnings = [], total = 0, commission = 0.15, monthlyData = [],
    dowEarnings = [], monthEarnings = 0, plan = 'BASIC',
  } = data || {}
  const commissionPct = Math.round(commission * 100)
  const isBasic = commission < 0.20
  const dayOfMonth = new Date().getDate()
  const forecast = forecastMonth(monthEarnings || 0, dayOfMonth)

  const premiumForecast = isBasic ? Math.round(forecast * (0.20 / (commission || 0.15))) : 0
  const premiumDelta    = premiumForecast - forecast

  const monthValues = monthlyData.map(m => m.earnings)
  const lastMonthVal = monthValues.length >= 2 ? monthValues[monthValues.length - 2] : 0
  const growthPct = lastMonthVal > 0 ? Math.round(((monthEarnings - lastMonthVal) / lastMonthVal) * 100) : null

  const bestDow = dowEarnings.length > 0 ? dowEarnings.reduce((a, b) => b.count > a.count ? b : a) : null

  return (
    <div className="space-y-4">
      <h2 className="font-playfair text-2xl font-bold text-charcoal">Mes gains</h2>

      {/* Total card */}
      <div className="bg-forest rounded-3xl p-6 text-cream">
        <p className="font-syne text-xs font-bold uppercase tracking-wider text-cream/50 mb-2">
          Gains cumulés (commission : {commissionPct}%)
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <p className="font-playfair text-5xl font-bold">{fmt(total)}</p>
          {growthPct !== null && (
            <span className={`mb-1 font-syne text-sm font-bold px-2 py-0.5 rounded-full ${
              growthPct >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-400/20 text-red-300'
            }`}>
              {growthPct >= 0 ? `↑ +${growthPct}%` : `↓ ${growthPct}%`} vs mois dernier
            </span>
          )}
        </div>
        <p className="font-dm text-sm text-cream/50 mt-1">FCFA · {earnings.length} livraisons affichées</p>
        <p className="font-dm text-[11px] text-cream/40 mt-2">
          Estimation temps réel, non officielle — voir « Rémunérations officielles » ci-dessous pour les montants validés par la comptabilité.
        </p>
      </div>

      {/* LOT 12 : rémunérations officielles (comptabilité) — le cumul ci-dessus
          est une estimation temps réel jamais validée par personne ; ceci est
          la source officielle (arbitrage Décision 2, réconciliée au LOT 11). */}
      {remunerations.length > 0 && (
        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-charcoal/6 flex items-center gap-2">
            <ShieldCheck size={14} className="text-forest" />
            <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">Rémunérations officielles (comptabilité)</p>
          </div>
          <div className="divide-y divide-charcoal/5">
            {remunerations.map(r => (
              <div key={r.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-syne text-sm font-bold text-charcoal">{r.id}</p>
                  <p className="font-dm text-xs text-charcoal/40">
                    {fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-playfair text-lg font-bold text-forest">{fmt(r.netAmount)} F</p>
                  <p className="font-dm text-xs text-charcoal/40">
                    {REMUNERATION_STATUS_LABELS[r.status] || r.status}
                    {r.paymentOrder && ` · ${REMUNERATION_STATUS_LABELS[r.paymentOrder.status] || r.paymentOrder.status}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prévision + Premium ROI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {forecast > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-card border border-charcoal/5">
            <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-2">Prévision fin de mois</p>
            <p className="font-playfair text-3xl font-bold text-charcoal">{fmt(forecast)} <span className="text-sm font-dm font-normal text-charcoal/40">FCFA</span></p>
            <p className="font-dm text-xs text-charcoal/40 mt-1">Jour {dayOfMonth}/30 — extrapolation linéaire</p>
          </div>
        )}
        {isBasic && premiumDelta > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Crown size={14} className="text-amber-600" />
              <p className="font-syne text-xs font-bold uppercase tracking-wider text-amber-700">Avec le plan Premium</p>
            </div>
            <p className="font-playfair text-3xl font-bold text-amber-800">+{fmt(premiumDelta)} <span className="text-sm font-dm font-normal text-amber-600">FCFA/mois</span></p>
            <p className="font-dm text-xs text-amber-700/70 mt-1">
              Commission 20% au lieu de {commissionPct}% — soit {fmt(premiumForecast)} FCFA ce mois
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('driver-navigate', { detail: 'plan' }))}
              className="mt-3 font-syne text-xs font-bold text-amber-700 underline underline-offset-2"
            >
              Voir le plan Premium →
            </button>
          </div>
        )}
      </div>

      {/* Graphique 6 mois */}
      {monthlyData.some(m => m.earnings > 0 || m.deliveries > 0) && (
        <div className="bg-white rounded-3xl p-6 shadow-card">
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-5">Évolution sur 6 mois</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontFamily: 'Syne', fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="earnings"   orientation="left"  tick={{ fontFamily: 'DM Sans', fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <YAxis yAxisId="deliveries" orientation="right" tick={{ fontFamily: 'DM Sans', fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontFamily: 'Syne', fontSize: 11, paddingTop: 12 }} formatter={v => v === 'earnings' ? 'Gains (FCFA)' : 'Livraisons'} />
              <Bar yAxisId="earnings"   dataKey="earnings"   name="earnings"   fill="#E8A217" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="deliveries" dataKey="deliveries" name="deliveries" fill="#1B4332" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gains par jour de semaine */}
      {dowEarnings.some(d => d.count > 0) && (
        <div className="bg-white rounded-3xl p-6 shadow-card">
          <div className="flex items-start justify-between mb-5">
            <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">Meilleurs jours (60 derniers jours)</p>
            {bestDow && bestDow.count > 0 && (
              <span className="font-syne text-xs font-bold bg-forest text-cream px-3 py-1 rounded-full shrink-0">
                📅 Pic : {bestDow.label}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dowEarnings}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontFamily: 'Syne', fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'DM Sans', fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={v => [`${fmt(v)} F`, 'Gain moyen/livraison']} contentStyle={{ borderRadius: 12, border: 'none' }} />
              <Bar dataKey="avgEarnings" radius={[6, 6, 0, 0]}>
                {dowEarnings.map((entry, i) => (
                  <Cell key={i} fill={bestDow && entry.label === bestDow.label ? '#E8A217' : '#1B4332'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Historique */}
      <div className="bg-white rounded-3xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-charcoal/6">
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">Historique (50 dernières)</p>
        </div>
        {earnings.length === 0 ? (
          <div className="py-12 text-center">
            <TrendingUp size={36} className="mx-auto text-charcoal/20 mb-3" />
            <p className="font-dm text-charcoal/40">Aucune livraison effectuée.</p>
          </div>
        ) : (
          <div className="divide-y divide-charcoal/5">
            {earnings.map(e => (
              <div key={e.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-syne text-sm font-bold text-charcoal">Commande {fmtOrderId(e.id, e.createdAt)}</p>
                  <p className="font-dm text-xs text-charcoal/40">{e.shop?.name} → {e.buyer?.name}</p>
                  <p className="font-dm text-[10px] text-charcoal/30 mt-0.5">{fmtDate(e.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-playfair text-lg font-bold text-forest">+{fmt(e.gain)} F</p>
                  <p className="font-dm text-xs text-charcoal/30">{fmt(e.deliveryFee)} F livraison</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
