import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'
import {
  Zap, Truck, TrendingUp, BarChart2, User,
  LogOut, Power, ChevronRight, AlertTriangle, FileText, CheckSquare, Square,
  CheckCircle, Clock, Download, Crown, Loader2, RefreshCw, X, Menu, Route as RouteIcon, ShieldCheck,
} from 'lucide-react'

const downloadContract = async (contract, holderName) => {
  if (contract.status !== 'SIGNED') return
  const date = contract.signedAt
    ? new Date(contract.signedAt).toISOString().split('T')[0]
    : 'non-signe'
  const slug = (holderName || 'contrat').replace(/\s+/g, '-').toLowerCase()
  const filename = `contrat-${slug}-${date}.pdf`

  const { default: html2pdf } = await import('html2pdf.js')
  await html2pdf()
    .set({
      margin: [15, 15, 15, 15],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(DOMPurify.sanitize(contract.content))
    .save()
}
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api/client'
import { motion, AnimatePresence } from 'framer-motion'
import OffersTab from './OffersTab'
import PerformanceTab from './PerformanceTab'
import DeliveryTab from './DeliveryTab'
import EarningsTab from './EarningsTab'
import ProfileTab from './ProfileTab'
import RouteTab from './RouteTab'

const TABS = [
  { id: 'offers',      label: 'Offres',           icon: Zap },
  { id: 'delivery',    label: 'En cours',         icon: Truck,     badge: 'delivery' },
  { id: 'route',       label: 'Ma tournée',       icon: RouteIcon },
  { id: 'earnings',    label: 'Gains',            icon: TrendingUp },
  { id: 'performance', label: 'Performance',      icon: BarChart2 },
  { id: 'profile',     label: 'Mon profil',       icon: User },
  { id: 'plan',        label: 'Mon abonnement',   icon: Crown },
  { id: 'contract',    label: 'Mon contrat',      icon: FileText },
]

// ─── Driver defaults ──────────────────────────────────────────────────────────
const DEFAULT_DRIVER_BASIC_FEATURES = [
  'Accès aux offres de livraison',
  'Sans frais d\'abonnement',
  'Application mobile',
  'Tableau de bord de gains',
  'Suivi de performance',
]
const DEFAULT_DRIVER_PREMIUM_FEATURES = [
  'Tout ce qui est inclus dans BASIC',
  'Commission majorée sur les livraisons',
  'Priorité dans l\'assignation des commandes',
  'Support dédié prioritaire',
  'Badge Livreur Premium visible',
]

function parseDriverFeatures(json, defaults) {
  if (!json) return defaults.map(l => ({ label: l, enabled: true }))
  try {
    const arr = JSON.parse(json)
    return arr.filter(f => f.enabled !== false)
  } catch { return defaults.map(l => ({ label: l, enabled: true })) }
}

// ─── Driver Request Modal ─────────────────────────────────────────────────────
function DriverRequestModal({ monthlyPrice, annualPrice, initialBilling, onClose, onSubmit, loading }) {
  const [note, setNote]       = useState('')
  const [billing, setBilling] = useState(initialBilling || 'monthly')

  const price  = billing === 'annual' ? annualPrice : monthlyPrice
  const suffix = billing === 'annual' ? '/an' : '/mois'
  const saving = billing === 'annual'
    ? Number(monthlyPrice * 12 - annualPrice).toLocaleString('fr-FR')
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-playfair text-xl font-bold text-charcoal">Passer au plan Premium</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={14} /></button>
        </div>

        {/* Sélecteur mensuel / annuel */}
        <div className="bg-gray-50 rounded-2xl p-1 flex gap-1">
          {[
            { id: 'monthly', label: 'Mensuel', sub: `${Number(monthlyPrice).toLocaleString('fr-FR')} FCFA/mois` },
            { id: 'annual',  label: 'Annuel',  sub: `${Number(annualPrice).toLocaleString('fr-FR')} FCFA/an` },
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
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-safran">Plan PREMIUM</p>
          <p className="font-playfair text-2xl font-bold text-charcoal">
            {Number(price).toLocaleString('fr-FR')} FCFA<span className="text-sm font-dm font-normal text-charcoal/40">{suffix}</span>
          </p>
          {saving && <p className="font-dm text-xs text-forest font-bold">Économie : {saving} FCFA vs mensuel</p>}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="font-syne text-xs font-bold text-amber-800 mb-1">Instructions de paiement</p>
          <p className="font-dm text-xs text-amber-700 leading-relaxed">
            Effectuez le virement de <strong>{Number(price).toLocaleString('fr-FR')} FCFA</strong> sur le compte RizIvoirien,
            puis soumettez votre demande. Notre équipe vérifiera le paiement et activera votre plan Premium sous 48h.
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

// ─── Driver Plan Tab ───────────────────────────────────────────────────────────
function DriverPlanTab() {
  const [plans, setPlans]            = useState({})
  const [upgradeRequest, setUpgrade] = useState(null)
  const [loading, setLoading]        = useState(true)
  const [showModal, setShowModal]    = useState(false)
  const [submitting, setSubmitting]  = useState(false)
  const [billing, setBilling]        = useState('monthly')
  const [error, setError]            = useState(null)
  const [success, setSuccess]        = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/drivers/plan-info'),
      api.get('/drivers/my/plan-upgrade-request').catch(() => ({ request: null })),
    ])
      .then(([planData, reqData]) => {
        setPlans(planData)
        setUpgrade(reqData.request)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const submitRequest = async (note, billingPeriod) => {
    setSubmitting(true); setError(null)
    try {
      const req = await api.post('/drivers/my/plan-upgrade-request', { note, billingPeriod })
      setUpgrade(req)
      setShowModal(false)
      setSuccess('Demande envoyée ! Notre équipe vous contactera sous 48h.')
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin" /></div>

  const currentPlan = plans?.plan || 'BASIC'
  const isBasic    = currentPlan !== 'PREMIUM'
  const isPremium  = currentPlan === 'PREMIUM'
  const basicCommission   = Math.round((plans?.driverCommission        ?? 0.15) * 100)
  const premiumCommission = Math.round((plans?.premiumDriverCommission ?? 0.20) * 100)
  const premiumMonthly = plans?.driverSubMonthly ?? plans?.driverSubPrice ?? 5000
  const premiumAnnual  = plans?.driverSubAnnual  ?? Math.round(premiumMonthly * 12 * 0.85)
  const premiumPrice   = billing === 'annual' ? premiumAnnual : premiumMonthly
  const premiumSuffix  = billing === 'annual' ? '/an' : '/mois'
  const basicFeatures   = parseDriverFeatures(plans?.driverBasicFeatures,   DEFAULT_DRIVER_BASIC_FEATURES)
  const premiumFeatures = parseDriverFeatures(plans?.driverPremiumFeatures, DEFAULT_DRIVER_PREMIUM_FEATURES)

  const pendingReq  = upgradeRequest?.status === 'PENDING'
  const rejectedReq = upgradeRequest?.status === 'REJECTED'

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Livreur</p>
        <h1 className="font-playfair text-3xl font-bold text-charcoal">Mon abonnement</h1>
        <p className="font-dm text-sm text-charcoal/50 mt-1">Gérez votre plan et débloquez plus de livraisons.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
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

      {/* Toggle mensuel / annuel */}
      {!isPremium && (
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
      )}

      {/* Plan actuel */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-charcoal/6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-syne text-xs font-bold uppercase tracking-widest text-charcoal/40 mb-1">Plan actuel</p>
            {isPremium
              ? <span className="inline-flex items-center gap-1.5 bg-safran/15 text-safran font-syne text-xs font-bold px-3 py-1 rounded-full"><Crown size={11} /> PREMIUM</span>
              : <span className="inline-flex items-center gap-1.5 bg-forest/10 text-forest font-syne text-xs font-bold px-3 py-1 rounded-full"><Truck size={11} /> BASIC</span>
            }
          </div>
          <div className="text-right">
            <p className="font-syne text-xs font-bold uppercase tracking-widest text-charcoal/40 mb-0.5">Commission</p>
            <p className="font-playfair text-xl font-bold text-charcoal">{isPremium ? premiumCommission : basicCommission}%</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-charcoal/6 flex items-center justify-end">
          <button onClick={load} className="flex items-center gap-1.5 text-charcoal/40 hover:text-charcoal transition-colors text-xs font-syne font-bold">
            <RefreshCw size={12} /> Actualiser
          </button>
        </div>
      </div>

      {/* Bannière statut demande */}
      {pendingReq && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <Clock size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-syne text-sm font-bold text-amber-800">Demande en cours d'examen</p>
            <p className="font-dm text-xs text-amber-700 mt-0.5">
              Soumise le {new Date(upgradeRequest.createdAt).toLocaleDateString('fr-FR')} · {Number(upgradeRequest.amount || premiumMonthly).toLocaleString('fr-FR')} FCFA/{upgradeRequest.billingPeriod === 'annual' ? 'an' : 'mois'}
            </p>
          </div>
        </div>
      )}
      {rejectedReq && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-syne text-sm font-bold text-red-700">Demande refusée</p>
            {upgradeRequest.adminNote && (
              <p className="font-dm text-xs text-red-600 mt-0.5">Motif : {upgradeRequest.adminNote}</p>
            )}
          </div>
        </div>
      )}

      {/* Cartes plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* BASIC */}
        <div className={`bg-white rounded-3xl shadow-sm overflow-hidden border-2 transition-all ${isBasic ? 'border-forest' : 'border-transparent'}`}>
          {isBasic && <div className="bg-forest px-5 py-2 text-center"><p className="font-syne text-xs font-bold tracking-widest uppercase text-cream">Plan actuel</p></div>}
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-forest/10 flex items-center justify-center"><Truck size={18} className="text-forest" /></div>
              <div>
                <p className="font-playfair text-lg font-bold text-charcoal">BASIC</p>
                <p className="font-dm text-xs text-charcoal/40">Démarrez vos livraisons</p>
              </div>
            </div>
            <div>
              <p className="font-playfair text-3xl font-bold text-charcoal">Gratuit</p>
              <p className="font-dm text-xs text-charcoal/40 mt-0.5">Commission : {basicCommission}%</p>
            </div>
            <ul className="space-y-2">
              {basicFeatures.map(f => (
                <li key={f.label} className="flex items-start gap-2">
                  <CheckCircle size={13} className="text-forest mt-0.5 shrink-0" />
                  <span className="font-dm text-sm text-charcoal/70">{f.label}</span>
                </li>
              ))}
            </ul>
            <button disabled className="w-full flex items-center justify-center gap-2 font-syne font-bold text-sm py-3 rounded-2xl bg-charcoal/5 text-charcoal/40 cursor-default">
              {isBasic ? 'Plan actif' : 'Plan de base'}
            </button>
          </div>
        </div>

        {/* PREMIUM */}
        <div className={`rounded-3xl overflow-hidden border-2 transition-all ${isPremium ? 'border-safran' : 'border-transparent'} bg-gradient-to-b from-charcoal to-charcoal/90 shadow-sm`}>
          <div className="bg-safran/15 px-5 py-2 text-center">
            {isPremium
              ? <p className="font-syne text-xs font-bold tracking-widest uppercase text-safran">Plan actuel</p>
              : <p className="font-syne text-xs font-bold tracking-widest uppercase text-safran">⭐ Plus de gains</p>}
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-safran/20 flex items-center justify-center"><Crown size={18} className="text-safran" /></div>
              <div>
                <p className="font-playfair text-lg font-bold text-white">PREMIUM</p>
                <p className="font-dm text-xs text-white/40">Maximisez vos revenus</p>
              </div>
            </div>
            <div>
              <p className="font-playfair text-3xl font-bold text-white">
                {Number(premiumPrice).toLocaleString('fr-FR')} <span className="text-safran">FCFA</span><span className="text-base font-dm font-normal text-white/40">{premiumSuffix}</span>
              </p>
              {billing === 'annual'
                ? <p className="font-dm text-xs text-white/40 mt-0.5">soit {Number(premiumMonthly).toLocaleString('fr-FR')} FCFA/mois · Commission : {premiumCommission}%</p>
                : <p className="font-dm text-xs text-white/40 mt-0.5">ou {Number(premiumAnnual).toLocaleString('fr-FR')} FCFA/an avec −15% · Commission : {premiumCommission}%</p>
              }
            </div>
            <ul className="space-y-2">
              {premiumFeatures.map(f => (
                <li key={f.label} className="flex items-start gap-2">
                  <CheckCircle size={13} className="text-safran mt-0.5 shrink-0" />
                  <span className="font-dm text-sm text-white/80">{f.label}</span>
                </li>
              ))}
            </ul>
            {!isPremium && (
              pendingReq ? (
                <button disabled className="w-full flex items-center justify-center gap-2 font-syne font-bold text-sm py-3 rounded-2xl bg-amber-400/20 text-amber-400 cursor-not-allowed">
                  <Clock size={15} /> Demande en cours
                </button>
              ) : (
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full flex items-center justify-center gap-2 font-syne font-bold text-sm py-3 rounded-2xl bg-safran text-charcoal hover:bg-safran/90 transition-colors">
                  <Crown size={15} /> {rejectedReq ? 'Renvoyer une demande' : 'Passer au Premium'}
                </button>
              )
            )}
            {isPremium && (
              <button disabled className="w-full flex items-center justify-center gap-2 font-syne font-bold text-sm py-3 rounded-2xl bg-safran/20 text-safran cursor-default">
                Plan actif
              </button>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <DriverRequestModal
          monthlyPrice={premiumMonthly}
          annualPrice={premiumAnnual}
          initialBilling={billing}
          onClose={() => setShowModal(false)}
          onSubmit={submitRequest}
          loading={submitting}
        />
      )}
    </div>
  )
}

// ─── Contract View Tab ─────────────────────────────────────────────────────────
function ContractViewTab() {
  const { user } = useAuth()
  const [contract, setContract]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [signed, setSigned]       = useState(false)
  const [accepted, setAccepted]   = useState(false)
  const [fullName, setFullName]   = useState('')
  const [signing, setSigning]     = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    api.get('/drivers/contract')
      .then(d => {
        setContract(d.contract)
        setSigned(d.contractSigned || d.contract?.status === 'SIGNED')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user?.name) setFullName(user.name)
  }, [user])

  const sign = async () => {
    if (!accepted || !fullName.trim()) return
    setSigning(true); setError(null)
    try {
      const res = await api.put('/drivers/contract/sign', { fullName: fullName.trim() })
      setSigned(true)
      setContract(c => c ? { ...c, status: 'SIGNED', signedAt: new Date().toISOString(), signatures: [res.signature, ...(c.signatures || [])] } : c)
    } catch (e) { setError(e.message || 'Erreur lors de la signature') }
    finally { setSigning(false) }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
    </div>
  )

  if (!contract) return (
    <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
      <FileText size={40} className="mx-auto text-gray-200 mb-4" />
      <p className="font-syne font-bold text-gray-400">Aucun contrat disponible</p>
      <p className="font-dm text-sm text-gray-300 mt-1">Le contrat est généré après validation de votre dossier par l'administration</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${
        signed ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
      }`}>
        {signed
          ? <CheckCircle size={18} className="text-green-600 shrink-0" />
          : <Clock size={18} className="text-amber-600 shrink-0" />
        }
        <div className="flex-1">
          <p className={`font-syne text-sm font-bold ${signed ? 'text-green-700' : 'text-amber-700'}`}>
            {signed ? 'Contrat signé' : 'Contrat en attente de signature'}
          </p>
          {signed && contract.signedAt && (
            <p className="font-dm text-xs text-green-600 mt-0.5">
              Signé le {new Date(contract.signedAt).toLocaleDateString('fr-FR')} à {new Date(contract.signedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {contract.signatures?.[0] && ` par ${contract.signatures[0].signedByName}`}
            </p>
          )}
        </div>
        {signed && (
          <button onClick={() => downloadContract(contract, 'livreur')}
            className="flex items-center gap-2 bg-green-600 text-white font-syne text-xs font-bold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors shrink-0">
            <Download size={13} /> Télécharger
          </button>
        )}
      </div>

      {/* Contenu du contrat */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-charcoal px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <FileText size={15} className="text-white" />
          </div>
          <div>
            <p className="font-playfair text-base font-bold text-white">Contrat de partenariat livreur</p>
            <p className="font-syne text-[10px] text-white/40">Document officiel RizIvoirien</p>
          </div>
        </div>

        <div className="px-6 py-6 max-h-[55vh] overflow-y-auto">
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contract.content) }} />
        </div>

        {/* Footer signature si pas encore signé */}
        {!signed && (
          <div className="border-t border-gray-100 px-6 py-5 bg-gray-50/80 space-y-4">
            {error && (
              <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
                <AlertTriangle size={13} className="text-red-500 shrink-0" />
                <p className="font-dm text-sm text-red-600">{error}</p>
              </div>
            )}
            <label className="flex items-start gap-3 cursor-pointer">
              <button type="button" onClick={() => setAccepted(v => !v)} className="mt-0.5 shrink-0 text-charcoal">
                {accepted ? <CheckSquare size={20} /> : <Square size={20} className="text-gray-400" />}
              </button>
              <span className="font-dm text-sm text-gray-700 leading-relaxed">
                J'ai lu et j'accepte l'intégralité du contrat de partenariat livreur RizIvoirien.
              </span>
            </label>
            <div>
              <label className="block font-syne text-xs font-bold tracking-wider uppercase text-gray-400 mb-1.5">
                Nom complet (signature électronique)
              </label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Prénom NOM"
                className="w-full bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 font-dm text-sm text-charcoal focus:outline-none focus:border-charcoal transition-colors" />
              <p className="flex items-center gap-1.5 font-dm text-[11px] text-gray-400 mt-1.5">
                <ShieldCheck size={12} /> Votre nom, l'heure et une empreinte du contrat sont enregistrés comme preuve de signature.
              </p>
            </div>
            <button onClick={sign} disabled={!accepted || !fullName.trim() || signing}
              className="w-full py-3 rounded-2xl bg-charcoal text-white font-syne font-bold text-sm hover:bg-charcoal/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {signing
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <FileText size={15} />
              }
              Signer le contrat
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Contract Modal ────────────────────────────────────────────────────────────
function ContractModal({ contract, onSigned }) {
  const { user } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [fullName, setFullName] = useState(user?.name || '')
  const [signing, setSigning]   = useState(false)
  const [error, setError]       = useState(null)

  const sign = async () => {
    if (!accepted || !fullName.trim()) return
    setSigning(true); setError(null)
    try {
      await api.put('/drivers/contract/sign', { fullName: fullName.trim() })
      onSigned()
    } catch (e) {
      setError(e.message || 'Erreur lors de la signature')
    } finally { setSigning(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-charcoal px-8 py-5 flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-playfair text-xl font-bold text-white">Contrat de partenariat livreur</h2>
            <p className="font-syne text-xs text-white/50 mt-0.5">Veuillez lire et signer votre contrat pour accéder au tableau de bord</p>
          </div>
        </div>

        {/* Contract content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contract.content) }}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-8 py-5 bg-gray-50/80 shrink-0 space-y-4">
          {error && (
            <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="font-dm text-sm text-red-600">{error}</p>
            </div>
          )}
          <label className="flex items-start gap-3 cursor-pointer">
            <button type="button" onClick={() => setAccepted(v => !v)} className="mt-0.5 shrink-0 text-charcoal">
              {accepted ? <CheckSquare size={20} /> : <Square size={20} className="text-gray-400" />}
            </button>
            <span className="font-dm text-sm text-gray-700 leading-relaxed">
              J'ai lu et j'accepte l'intégralité du contrat de partenariat livreur RizIvoirien, et je m'engage à respecter les conditions qui y sont définies.
            </span>
          </label>
          <div>
            <label className="block font-syne text-xs font-bold tracking-wider uppercase text-gray-400 mb-1.5">
              Nom complet (signature électronique)
            </label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Prénom NOM"
              className="w-full bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 font-dm text-sm text-charcoal focus:outline-none focus:border-charcoal transition-colors" />
            <p className="flex items-center gap-1.5 font-dm text-[11px] text-gray-400 mt-1.5">
              <ShieldCheck size={12} /> Votre nom, l'heure et une empreinte du contrat sont enregistrés comme preuve de signature.
            </p>
          </div>
          <button
            onClick={sign}
            disabled={!accepted || !fullName.trim() || signing}
            className="w-full py-3.5 rounded-2xl bg-charcoal text-white font-syne font-bold text-sm hover:bg-charcoal/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {signing
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <FileText size={16} />
            }
            Signer le contrat
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function DriverDashboard() {
  const [tab, setTab] = useState('offers')
  const [online, setOnline] = useState(false)
  const [driverStatus, setDriverStatus] = useState('PENDING')
  const [driverAvatar, setDriverAvatar] = useState(null)
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState(null)
  const [contract, setContract] = useState(null)
  const [contractSigned, setContractSigned] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/auth') }
  const selectTab = (id) => { setTab(id); setMenuOpen(false) }

  useEffect(() => {
    const loadDriver = async () => {
      try {
        const d = await api.get('/drivers/me')
        setOnline(d.online || false)
        setDriverStatus(d.status || 'PENDING')
        setDriverAvatar(d.avatar || null)
      } catch {}
    }
    const checkDelivery = async () => {
      try {
        const { order } = await api.get('/drivers/active-delivery')
        setHasActiveDelivery(!!order)
      } catch { setHasActiveDelivery(false) }
    }
    loadDriver()
    checkDelivery()
    const iv = setInterval(() => { loadDriver(); checkDelivery() }, 30000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const checkContract = async () => {
      try {
        const data = await api.get('/drivers/contract')
        if (data.contract && data.contract.status === 'PENDING_SIGNATURE') {
          setContract(data.contract)
          setContractSigned(false)
        } else {
          setContractSigned(true)
          setContract(null)
        }
      } catch {
        setContractSigned(true)
      }
    }
    checkContract()
    const iv = setInterval(checkContract, 30000)
    return () => clearInterval(iv)
  }, [])

  const handleContractSigned = () => {
    setContractSigned(true)
    setContract(null)
  }

  const toggleOnline = async () => {
    if (driverStatus !== 'ACTIVE') return
    setToggling(true); setToggleError(null)
    try {
      const res = await api.put('/drivers/status', { online: !online })
      setOnline(res.online)
    } catch (e) {
      setToggleError(e.message || 'Erreur lors du changement de statut')
    } finally { setToggling(false) }
  }

  const isActive = driverStatus === 'ACTIVE'

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex">
      {/* Contract modal overlay */}
      {!contractSigned && contract && (
        <ContractModal contract={contract} onSigned={handleContractSigned} />
      )}

      {/* Bouton menu mobile */}
      <button onClick={() => setMenuOpen(true)}
        className="md:hidden fixed top-4 left-4 z-30 w-10 h-10 bg-charcoal rounded-xl flex items-center justify-center shadow-lg">
        <Menu size={18} className="text-white" />
      </button>

      {/* Overlay mobile */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} className="md:hidden fixed inset-0 bg-black/40 z-40" />
      )}

      {/* Sidebar */}
      <aside className={`w-60 bg-charcoal fixed inset-y-0 left-0 flex flex-col z-50 shadow-2xl transition-transform duration-300 ${
        menuOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/6 flex items-start justify-between">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <span className="text-xl">🌾</span>
              <span className="font-playfair text-base font-bold text-white">
                Riz<span className="text-safran">Ivoirien</span>
              </span>
            </Link>
            <div className="mt-2 inline-flex items-center gap-1.5 bg-white/6 px-2.5 py-1 rounded-full">
              <Truck size={9} className="text-forest" />
              <span className="font-syne text-[9px] font-bold tracking-widest uppercase text-forest">Espace Livreur</span>
            </div>
          </div>
          <button onClick={() => setMenuOpen(false)} className="md:hidden text-white/40 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Driver info */}
        <div className="px-4 py-4 border-b border-white/6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center shrink-0 overflow-hidden">
              {driverAvatar
                ? <img src={driverAvatar} alt="" className="w-full h-full object-cover" />
                : <span className="font-playfair font-bold text-white text-sm">{user?.name?.[0]}</span>
              }
            </div>
            <div className="min-w-0">
              <p className="font-syne font-bold text-white text-sm truncate">{user?.name}</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                <span className="font-dm text-[10px] text-white/35">{online ? 'En ligne' : 'Hors ligne'}</span>
              </div>
            </div>
          </div>

          {/* Online toggle */}
          <button onClick={toggleOnline} disabled={toggling || !isActive}
            className={`mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl font-syne text-xs font-bold transition-all disabled:opacity-50 ${
              online
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-white/6 text-white/40 hover:bg-white/10 hover:text-white/60'
            }`}>
            {toggling
              ? <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
              : <Power size={12} />
            }
            {online ? 'Passer hors ligne' : 'Se mettre en ligne'}
          </button>

          {toggleError && (
            <div className="mt-2 flex items-start gap-1.5 bg-red-500/10 rounded-lg px-2.5 py-2">
              <AlertTriangle size={11} className="text-red-400 mt-0.5 shrink-0" />
              <p className="font-syne text-[10px] text-red-400 leading-tight flex-1">{toggleError}</p>
              <button onClick={() => setToggleError(null)} className="text-red-400/60 hover:text-red-400 text-[10px] font-bold">✕</button>
            </div>
          )}

          {/* Not active warning */}
          {!isActive && (
            <div className="mt-2 flex items-start gap-1.5 bg-amber-500/10 rounded-lg px-2.5 py-2">
              <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="font-syne text-[10px] text-amber-400 leading-tight">
                {driverStatus === 'PENDING' ? 'Dossier en attente de validation' : 'Compte suspendu'}
              </p>
            </div>
          )}

          {/* Contract pending banner */}
          {!contractSigned && contract && (
            <div className="mt-2 flex items-start gap-1.5 bg-amber-500/10 rounded-lg px-2.5 py-2">
              <FileText size={11} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="font-syne text-[10px] text-amber-400 leading-tight">Contrat en attente de signature</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {TABS.map(({ id, label, icon: Icon, badge }) => {
            const active = tab === id
            const showDeliveryBadge = badge === 'delivery' && hasActiveDelivery
            const showContractBadge = id === 'contract' && !contractSigned && contract
            return (
              <button key={id} onClick={() => selectTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  active ? 'bg-forest/15 text-forest' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                }`}>
                <div className="relative shrink-0">
                  <Icon size={15} />
                  {(showDeliveryBadge || showContractBadge) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  )}
                </div>
                <span className="font-syne text-sm font-semibold flex-1">{label}</span>
                {active && <ChevronRight size={12} className="text-forest" />}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/6">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/8 transition-colors">
            <LogOut size={14} />
            <span className="font-syne text-sm">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="md:ml-60 flex-1 min-h-screen">
        {/* Pas de mode="wait" ici : une transition qui attend la fin de
            l'animation de sortie de l'onglet précédent avant de monter le
            suivant peut rester bloquée indéfiniment si l'onglet navigateur
            passe en arrière-plan (livreur qui change d'app en pleine
            livraison) — les navigateurs mobiles limitent alors
            requestAnimationFrame et l'animation ne se termine jamais,
            gelant TOUTE navigation entre onglets du tableau de bord livreur
            (constaté en le testant : impossible de changer d'onglet). Même
            bug, même correctif que celui déjà appliqué au formulaire de code
            de livraison dans DeliveryTab.jsx (LOT9). */}
        <AnimatePresence>
          <motion.div key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="p-6 pt-20 md:pt-6 max-w-3xl">
            {tab === 'offers'      && <OffersTab online={online} onAccepted={() => setTab('delivery')} hasActiveDelivery={hasActiveDelivery} onGoToDelivery={() => setTab('delivery')} />}
            {tab === 'delivery'    && <DeliveryTab onDelivered={() => setHasActiveDelivery(false)} />}
            {tab === 'route'       && <RouteTab />}
            {tab === 'earnings'    && <EarningsTab />}
            {tab === 'performance' && <PerformanceTab />}
            {tab === 'profile'     && <ProfileTab />}
            {tab === 'plan'        && <DriverPlanTab />}
            {tab === 'contract'    && <ContractViewTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
