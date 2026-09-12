import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { fmt, fmtDate } from '../../utils/status'
import {
  CheckCircle, Crown, Store, Clock, AlertCircle, Loader2, RefreshCw, X,
} from 'lucide-react'

const DEFAULT_BASIC_FEATURES = [
  'Présence sur la marketplace',
  'Jusqu\'à 50 produits actifs',
  'Tableau de bord analytics',
  'Gestion des commandes',
  'Avis clients',
  'Page boutique personnalisée',
  '1 zone de livraison',
]
const DEFAULT_CERTIFIED_FEATURES = [
  'Tout ce qui est inclus dans BASIC',
  'Badge "Boutique certifiée" visible',
  'Priorité dans les résultats de recherche',
  'Mise en avant sur la page d\'accueil',
  'Produits illimités',
  'Zones de livraison multiples',
  'Accès aux fonctionnalités premium à venir',
]

function parseFeatures(json, defaults) {
  if (!json) return defaults.map(l => ({ label: l, enabled: true }))
  try {
    const arr = JSON.parse(json)
    return arr.filter(f => f.enabled !== false)
  } catch { return defaults.map(l => ({ label: l, enabled: true })) }
}

function PlanBadge({ plan, certified }) {
  if (certified || plan === 'CERTIFIED')
    return <span className="inline-flex items-center gap-1.5 bg-safran/15 text-safran font-syne text-xs font-bold px-3 py-1 rounded-full"><Crown size={11} /> CERTIFIÉE</span>
  return <span className="inline-flex items-center gap-1.5 bg-forest/10 text-forest font-syne text-xs font-bold px-3 py-1 rounded-full"><Store size={11} /> BASIC</span>
}

function StatusBadge({ status }) {
  const map = {
    ACTIVE:    { label: 'Actif',  cls: 'bg-green-100 text-green-700' },
    EXPIRED:   { label: 'Expiré', cls: 'bg-red-100 text-red-600' },
    CANCELLED: { label: 'Annulé', cls: 'bg-charcoal/8 text-charcoal/50' },
  }
  const { label, cls } = map[status] || { label: status, cls: 'bg-charcoal/8 text-charcoal/50' }
  return <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
}

// ─── Modale de demande ──────────────────────────────────────────────────────
function RequestModal({ annualPrice, monthlyPrice, initialBilling, onClose, onSubmit, loading }) {
  const [note, setNote]       = useState('')
  const [billing, setBilling] = useState(initialBilling || 'monthly')

  const price  = billing === 'annual' ? annualPrice : monthlyPrice
  const suffix = billing === 'annual' ? '/an' : '/mois'
  const saving = billing === 'annual'
    ? fmt(monthlyPrice * 12 - annualPrice)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-playfair text-xl font-bold text-charcoal">Demande de certification</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={14} /></button>
        </div>

        {/* Sélecteur mensuel / annuel */}
        <div className="bg-gray-50 rounded-2xl p-1 flex gap-1">
          {[
            { id: 'monthly', label: 'Mensuel',  sub: `${fmt(monthlyPrice)} FCFA/mois` },
            { id: 'annual',  label: 'Annuel',   sub: `${fmt(annualPrice)} FCFA/an` },
          ].map(opt => (
            <button key={opt.id} onClick={() => setBilling(opt.id)}
              className={`flex-1 rounded-xl py-2.5 px-3 transition-all text-left ${billing === opt.id ? 'bg-white shadow-sm' : ''}`}>
              <div className="flex items-center justify-between">
                <p className={`font-syne text-xs font-bold ${billing === opt.id ? 'text-charcoal' : 'text-charcoal/40'}`}>{opt.label}</p>
                {opt.id === 'annual' && <span className="bg-forest/10 text-forest font-syne text-[9px] font-bold px-1.5 py-0.5 rounded-full">−15%</span>}
              </div>
              <p className={`font-dm text-xs mt-0.5 ${billing === opt.id ? 'text-charcoal/60' : 'text-charcoal/30'}`}>{opt.sub}</p>
            </button>
          ))}
        </div>

        <div className="bg-safran/8 rounded-2xl p-4 space-y-1">
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-safran">Plan Certifié</p>
          <p className="font-playfair text-2xl font-bold text-charcoal">
            {fmt(price)} FCFA<span className="text-sm font-dm font-normal text-charcoal/40">{suffix}</span>
          </p>
          {saving && <p className="font-dm text-xs text-forest font-bold">Économie : {saving} FCFA vs mensuel</p>}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="font-syne text-xs font-bold text-amber-800 mb-1">Instructions de paiement</p>
          <p className="font-dm text-xs text-amber-700 leading-relaxed">
            Effectuez le virement de <strong>{fmt(price)} FCFA</strong> sur le compte RizIvoirien,
            puis soumettez votre demande. Notre équipe vérifiera le paiement et activera votre certification sous 48h.
          </p>
        </div>

        <div>
          <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-2">
            Message pour l'admin <span className="text-charcoal/30 font-normal normal-case">(optionnel)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ex : J'ai effectué le virement le 12/05 via Orange Money..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-forest resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-syne text-sm font-bold text-charcoal/60 hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button onClick={() => onSubmit(note, billing)} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-safran text-charcoal font-syne text-sm font-bold hover:bg-safran/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
            Envoyer la demande
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VendorSubscriptionTab() {
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [upgradeRequest, setUpgrade]  = useState(null)
  const [showModal, setShowModal]     = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [billing, setBilling]         = useState('monthly')
  const [acting, setActing]           = useState(null)
  const [success, setSuccess]         = useState(null)
  const [error, setError]             = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/shops/my/subscription-info'),
      api.get('/shops/my/plan-upgrade-request').catch(() => ({ request: null })),
    ])
      .then(([subData, reqData]) => { setData(subData); setUpgrade(reqData.request) })
      .catch(() => setError('Impossible de charger les informations d\'abonnement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const subscribeBasic = async () => {
    setActing('BASIC'); setError(null); setSuccess(null)
    try {
      await api.post('/shops/my/subscription', { plan: 'BASIC', billing })
      await load()
      setSuccess(`Abonnement BASIC ${billing === 'annual' ? 'annuel' : 'mensuel'} activé avec succès.`)
    } catch (e) { setError(e.message) }
    finally { setActing(null) }
  }

  const submitRequest = async (note, billingPeriod) => {
    setSubmitting(true); setError(null)
    try {
      const req = await api.post('/shops/my/plan-upgrade-request', { note, billingPeriod })
      setUpgrade(req)
      setShowModal(false)
      setSuccess('Demande envoyée ! Notre équipe vous contactera sous 48h.')
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" /></div>
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle size={36} className="text-red-400" />
      <p className="font-playfair text-xl font-bold text-charcoal">Impossible de charger les abonnements</p>
      <button onClick={load} className="flex items-center gap-2 bg-forest text-cream font-syne font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-forest/90 transition-colors">
        <RefreshCw size={14} /> Réessayer
      </button>
    </div>
  )

  const { subscription, certified, plan: currentPlan, plans } = data
  const isBasic     = !certified && currentPlan !== 'CERTIFIED'
  const isCertified = certified || currentPlan === 'CERTIFIED'
  const basicFree   = plans?.basicMonthly === 0
  const basicPrice  = billing === 'annual' ? plans?.basicAnnual : plans?.basicMonthly
  const basicLabel  = basicFree ? 'Gratuit' : `${fmt(basicPrice)} FCFA/${billing === 'annual' ? 'an' : 'mois'}`

  const certifiedAnnual  = plans?.certifiedAnnual  ?? plans?.certifiedPrice ?? 15000
  const certifiedMonthly = plans?.certifiedMonthly ?? Math.round(certifiedAnnual / 12)
  const certifiedPrice   = billing === 'annual' ? certifiedAnnual : certifiedMonthly
  const certifiedSuffix  = billing === 'annual' ? '/an' : '/mois'

  const basicFeatures     = parseFeatures(plans?.shopBasicFeatures,     DEFAULT_BASIC_FEATURES)
  const certifiedFeatures = parseFeatures(plans?.shopCertifiedFeatures, DEFAULT_CERTIFIED_FEATURES)

  const isExpiringSoon = subscription?.endDate &&
    (new Date(subscription.endDate) - Date.now()) < 15 * 24 * 3600 * 1000 &&
    (new Date(subscription.endDate) - Date.now()) > 0

  const pendingReq  = upgradeRequest?.status === 'PENDING'
  const rejectedReq = upgradeRequest?.status === 'REJECTED'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Vendeur</p>
        <h1 className="font-playfair text-3xl font-bold text-charcoal">Mon abonnement</h1>
        <p className="font-dm text-sm text-charcoal/50 mt-1">Choisissez le plan adapté à votre boutique.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle size={14} className="text-green-600 shrink-0" />
          <p className="font-dm text-sm text-green-700 flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 font-bold text-xs">✕</button>
        </div>
      )}

      {/* Plan actuel */}
      <div className="bg-white rounded-3xl p-6 shadow-card border border-charcoal/6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-syne text-xs font-bold uppercase tracking-widest text-charcoal/40 mb-1">Plan actuel</p>
            <div className="flex items-center gap-2">
              <PlanBadge plan={currentPlan} certified={certified} />
              {subscription && <StatusBadge status={subscription.status} />}
            </div>
          </div>
          {subscription?.endDate && (
            <div className="text-right">
              <p className="font-syne text-xs font-bold uppercase tracking-widest text-charcoal/40 mb-0.5">Expire le</p>
              <p className={`font-dm text-sm font-bold ${isExpiringSoon ? 'text-terra' : 'text-charcoal'}`}>{fmtDate(subscription.endDate)}</p>
            </div>
          )}
        </div>
        {isExpiringSoon && (
          <div className="mt-4 flex items-start gap-2 bg-terra/8 rounded-xl px-3 py-2.5">
            <Clock size={13} className="text-terra mt-0.5 shrink-0" />
            <p className="font-dm text-xs text-terra">Votre abonnement expire bientôt. Renouvelez-le pour ne pas interrompre vos ventes.</p>
          </div>
        )}
        {subscription && (
          <div className="mt-4 pt-4 border-t border-charcoal/6 flex items-center justify-between">
            <div>
              <p className="font-syne text-xs text-charcoal/40 uppercase tracking-wider">Montant payé</p>
              <p className="font-playfair text-xl font-bold text-charcoal">{fmt(subscription.amount)} FCFA</p>
            </div>
            <button onClick={load} className="flex items-center gap-1.5 text-charcoal/40 hover:text-charcoal transition-colors text-xs font-syne font-bold">
              <RefreshCw size={12} /> Actualiser
            </button>
          </div>
        )}
      </div>

      {/* Toggle mensuel / annuel */}
      <div className="flex items-center justify-center gap-3">
        <span className={`font-syne text-sm font-bold transition-colors ${billing === 'monthly' ? 'text-charcoal' : 'text-charcoal/40'}`}>Mensuel</span>
        <button onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
          className={`w-12 h-6 rounded-full transition-colors relative ${billing === 'annual' ? 'bg-forest' : 'bg-charcoal/15'}`}>
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${billing === 'annual' ? 'left-6' : 'left-0.5'}`} />
        </button>
        <div className="flex items-center gap-1.5">
          <span className={`font-syne text-sm font-bold transition-colors ${billing === 'annual' ? 'text-charcoal' : 'text-charcoal/40'}`}>Annuel</span>
          <span className="bg-forest/10 text-forest font-syne text-[10px] font-bold px-2 py-0.5 rounded-full">−15%</span>
        </div>
      </div>

      {/* Cartes plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* BASIC */}
        <div className={`bg-white rounded-3xl shadow-card overflow-hidden border-2 transition-all ${isBasic ? 'border-forest' : 'border-transparent'}`}>
          {isBasic && <div className="bg-forest px-5 py-2 text-center"><p className="font-syne text-xs font-bold tracking-widest uppercase text-cream">Plan actuel</p></div>}
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-forest/10 flex items-center justify-center"><Store size={18} className="text-forest" /></div>
              <div>
                <p className="font-playfair text-lg font-bold text-charcoal">BASIC</p>
                <p className="font-dm text-xs text-charcoal/40">Démarrez vos ventes</p>
              </div>
            </div>
            <div>
              <p className="font-playfair text-3xl font-bold text-charcoal">{basicLabel}</p>
              {!basicFree && billing === 'annual' && (
                <p className="font-dm text-xs text-charcoal/40 mt-0.5">soit {fmt(Math.round((plans?.basicAnnual ?? 0) / 12))} FCFA/mois</p>
              )}
            </div>
            <ul className="space-y-2">
              {basicFeatures.map(f => (
                <li key={f.label} className="flex items-start gap-2">
                  <CheckCircle size={13} className="text-forest mt-0.5 shrink-0" />
                  <span className="font-dm text-sm text-charcoal/70">{f.label}</span>
                </li>
              ))}
            </ul>
            <button onClick={subscribeBasic}
              disabled={!!acting || (isBasic && subscription?.status === 'ACTIVE')}
              className={`w-full flex items-center justify-center gap-2 font-syne font-bold text-sm py-3 rounded-2xl transition-colors disabled:opacity-50 ${
                isBasic && subscription?.status === 'ACTIVE'
                  ? 'bg-charcoal/5 text-charcoal/40 cursor-default'
                  : 'bg-forest text-cream hover:bg-forest/90'
              }`}>
              {acting === 'BASIC' ? <Loader2 size={15} className="animate-spin" /> : null}
              {isBasic && subscription?.status === 'ACTIVE' ? 'Plan actif' : basicFree ? 'Activer gratuitement' : 'Souscrire'}
            </button>
          </div>
        </div>

        {/* CERTIFIED */}
        <div className={`rounded-3xl overflow-hidden border-2 transition-all ${isCertified ? 'border-safran' : 'border-transparent'} bg-gradient-to-b from-charcoal to-charcoal/90 shadow-card`}>
          <div className="bg-safran/15 px-5 py-2 text-center">
            {isCertified
              ? <p className="font-syne text-xs font-bold tracking-widest uppercase text-safran">Plan actuel</p>
              : <p className="font-syne text-xs font-bold tracking-widest uppercase text-safran">⭐ Recommandé</p>}
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-safran/20 flex items-center justify-center"><Crown size={18} className="text-safran" /></div>
              <div>
                <p className="font-playfair text-lg font-bold text-cream">CERTIFIED</p>
                <p className="font-dm text-xs text-cream/40">Boutique certifiée premium</p>
              </div>
            </div>
            <div>
              <p className="font-playfair text-3xl font-bold text-cream">
                {fmt(certifiedPrice)} FCFA<span className="text-base font-dm font-normal text-cream/40">{certifiedSuffix}</span>
              </p>
              {billing === 'annual'
                ? <p className="font-dm text-xs text-cream/40 mt-0.5">soit {fmt(certifiedMonthly)} FCFA/mois · économisez {fmt(certifiedMonthly * 12 - certifiedAnnual)} FCFA</p>
                : <p className="font-dm text-xs text-cream/40 mt-0.5">ou {fmt(certifiedAnnual)} FCFA/an avec −15%</p>
              }
            </div>
            <ul className="space-y-2">
              {certifiedFeatures.map(f => (
                <li key={f.label} className="flex items-start gap-2">
                  <CheckCircle size={13} className="text-safran mt-0.5 shrink-0" />
                  <span className="font-dm text-sm text-cream/70">{f.label}</span>
                </li>
              ))}
            </ul>

            {/* État de la demande */}
            {pendingReq && (
              <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl px-4 py-3">
                <p className="font-syne text-xs font-bold text-amber-300">⏳ Demande en cours d'examen</p>
                <p className="font-dm text-xs text-amber-400/80 mt-1">
                  Soumise le {fmtDate(upgradeRequest.createdAt)} · {fmt(upgradeRequest.amount)} FCFA/{upgradeRequest.billingPeriod === 'annual' ? 'an' : 'mois'}
                </p>
              </div>
            )}
            {rejectedReq && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-2xl px-4 py-3">
                <p className="font-syne text-xs font-bold text-red-300">✗ Demande refusée</p>
                {upgradeRequest.adminNote && <p className="font-dm text-xs text-red-400/80 mt-1">{upgradeRequest.adminNote}</p>}
              </div>
            )}

            {!isCertified && (
              <button
                onClick={() => setShowModal(true)}
                disabled={pendingReq}
                className={`w-full flex items-center justify-center gap-2 font-syne font-bold text-sm py-3 rounded-2xl transition-colors disabled:opacity-50 ${
                  pendingReq ? 'bg-amber-500/20 text-amber-300 cursor-default' : 'bg-safran text-charcoal hover:bg-safran/90'
                }`}>
                <Crown size={15} />
                {pendingReq ? 'Demande en attente' : rejectedReq ? 'Renvoyer une demande' : 'Obtenir la certification'}
              </button>
            )}
            {isCertified && (
              <button disabled className="w-full flex items-center justify-center gap-2 font-syne font-bold text-sm py-3 rounded-2xl bg-safran/20 text-safran/60 cursor-default">
                <CheckCircle size={15} /> Certification active
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tableau comparatif */}
      <div className="bg-white rounded-3xl shadow-card overflow-hidden border border-charcoal/6">
        <div className="px-6 py-4 border-b border-charcoal/6">
          <p className="font-syne text-xs font-bold uppercase tracking-widest text-charcoal/40">Comparaison des plans</p>
        </div>
        <div className="divide-y divide-charcoal/5">
          {[
            { label: 'Présence marketplace',        basic: true,  cert: true },
            { label: 'Gestion produits illimitée',  basic: true,  cert: true },
            { label: 'Analytics avancés',           basic: true,  cert: true },
            { label: 'Badge boutique certifiée',    basic: false, cert: true },
            { label: 'Priorité dans la recherche',  basic: false, cert: true },
            { label: 'Mise en avant page d\'accueil', basic: false, cert: true },
            { label: 'Support prioritaire',         basic: false, cert: true },
          ].map(({ label, basic, cert }) => (
            <div key={label} className="grid grid-cols-3 px-6 py-3 text-sm">
              <span className="font-dm text-charcoal/70 col-span-1">{label}</span>
              <div className="flex justify-center">{basic ? <CheckCircle size={16} className="text-forest" /> : <span className="w-4 h-0.5 bg-charcoal/20 rounded mt-2" />}</div>
              <div className="flex justify-center">{cert  ? <CheckCircle size={16} className="text-safran" /> : <span className="w-4 h-0.5 bg-charcoal/20 rounded mt-2" />}</div>
            </div>
          ))}
          <div className="grid grid-cols-3 px-6 py-2 bg-charcoal/2">
            <span />
            <p className="text-center font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider">BASIC</p>
            <p className="text-center font-syne text-xs font-bold text-safran uppercase tracking-wider">CERTIFIED</p>
          </div>
        </div>
      </div>

      {showModal && (
        <RequestModal
          annualPrice={certifiedAnnual}
          monthlyPrice={certifiedMonthly}
          initialBilling={billing}
          onClose={() => setShowModal(false)}
          onSubmit={submitRequest}
          loading={submitting}
        />
      )}
    </div>
  )
}
