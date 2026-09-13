import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../../api/client'
import { fmtDriverId, fmtOrderId } from '../../utils/status'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, CheckCircle, XCircle, PauseCircle, Clock,
  Eye, Plus, Copy, Phone, Mail, Star, Package,
  CreditCard, Car, FileText, User, X, Shield,
  Printer, ChevronDown, AlertCircle, RefreshCw
} from 'lucide-react'

const STATUS_TABS = [
  { id: 'PENDING',   label: 'En attente',  color: 'text-amber-600',   bg: 'bg-amber-50',   dot: 'bg-amber-500' },
  { id: 'ACTIVE',    label: 'Actifs',      color: 'text-green-700',   bg: 'bg-green-50',   dot: 'bg-green-500' },
  { id: 'SUSPENDED', label: 'Suspendus',   color: 'text-orange-600',  bg: 'bg-orange-50',  dot: 'bg-orange-500' },
  { id: 'REJECTED',  label: 'Rejetés',    color: 'text-red-600',     bg: 'bg-red-50',     dot: 'bg-red-500' },
]

const statusBadge = (s) => {
  const map = {
    PENDING:   'bg-amber-100 text-amber-700',
    ACTIVE:    'bg-green-100 text-green-700',
    SUSPENDED: 'bg-orange-100 text-orange-700',
    REJECTED:  'bg-red-100 text-red-700',
  }
  const labels = { PENDING: 'En attente', ACTIVE: 'Actif', SUSPENDED: 'Suspendu', REJECTED: 'Rejeté' }
  return { cls: map[s] || 'bg-gray-100 text-gray-500', label: labels[s] || s }
}

const rateBarColor = (r) =>
  r >= 0.7 ? 'bg-forest-light' : r >= 0.5 ? 'bg-amber-400' : r >= 0.3 ? 'bg-orange-500' : 'bg-red-500'

const contractBadge = (contract) => {
  if (!contract) return { cls: 'bg-gray-100 text-gray-400', label: '—' }
  if (contract.status === 'SIGNED') return { cls: 'bg-green-100 text-green-700', label: '✓ Signé' }
  return { cls: 'bg-amber-100 text-amber-700', label: '⏳ En attente' }
}

const fmt = n => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = d => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const fmtShort = d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })

// ─── DocImage ─────────────────────────────────────────────────────────────────
function DocImage({ src, label, icon }) {
  const [open, setOpen] = useState(false)
  if (!src) return (
    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2">
      {icon}
      <p className="font-syne text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</p>
      <p className="font-dm text-xs text-gray-300">Non fourni</p>
    </div>
  )
  return (
    <>
      <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-forest-light transition-colors group"
        onClick={() => setOpen(true)}>
        <div className="h-24 overflow-hidden">
          <img src={src} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
        </div>
        <div className="px-3 py-2 flex items-center gap-1.5">
          {icon}
          <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80" onClick={() => setOpen(false)}>
          <img src={src} alt={label} className="max-w-2xl max-h-[80vh] rounded-2xl object-contain" loading="lazy" />
        </div>
      )}
    </>
  )
}

// ─── PayslipModal ─────────────────────────────────────────────────────────────
function PayslipModal({ driver, onClose }) {
  const [period, setPeriod]   = useState('weekly')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const PERIODS = [
    { id: 'daily',   label: 'Journalier' },
    { id: 'weekly',  label: 'Hebdomadaire' },
    { id: 'monthly', label: 'Mensuel' },
  ]

  const load = useCallback(async (p) => {
    setLoading(true); setError(null)
    try {
      const d = await api.get(`/admin/drivers/${driver.id}/payslip?period=${p}`)
      setData(d)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }, [driver.id])

  useEffect(() => { load(period) }, [load, period])

  const handlePrint = () => window.print()

  const periodLabel = PERIODS.find(p => p.id === period)?.label || period

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm print:hidden" onClick={onClose} />

      {/* ─── Zone imprimable ─── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto print:shadow-none print:rounded-none print:max-h-none"
        id="payslip-content"
      >
        {/* Header écran */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10 print:hidden">
          <div className="flex items-center gap-3">
            <Printer size={18} className="text-forest" />
            <h2 className="font-playfair text-lg font-bold text-charcoal">Fiche de paie — {driver.user?.name}</h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Sélecteur période */}
            <div className="relative">
              <select
                value={period} onChange={e => setPeriod(e.target.value)}
                className="appearance-none pl-4 pr-9 py-2 border-2 border-gray-200 rounded-xl font-syne text-sm font-bold text-charcoal focus:outline-none focus:border-forest cursor-pointer"
              >
                {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button onClick={handlePrint}
              className="flex items-center gap-2 bg-forest text-white font-syne text-sm font-bold px-4 py-2 rounded-xl hover:bg-forest-light transition-colors">
              <Printer size={14} /> Imprimer
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ─── Contenu fiche de paie ─── */}
        <div className="p-8 print:p-6" id="payslip-body">

          {/* En-tête entreprise */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-charcoal">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🌾</span>
                <span className="font-playfair text-xl font-bold text-charcoal">
                  Riz<span className="text-safran">Ivoirien</span>
                </span>
              </div>
              <p className="font-dm text-xs text-charcoal/50">Marketplace alimentaire — Côte d'Ivoire</p>
              <p className="font-dm text-xs text-charcoal/40 mt-0.5">support@rizivoirien.ci</p>
            </div>
            <div className="text-right">
              <p className="font-syne text-xs font-bold uppercase tracking-widest text-charcoal/40">Bulletin de paie</p>
              <p className="font-playfair text-2xl font-bold text-charcoal mt-1">{periodLabel}</p>
              {data && (
                <p className="font-dm text-xs text-charcoal/50 mt-1">
                  {fmtDate(data.startDate)} → {fmtDate(data.endDate)}
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12 print:hidden">
              <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 rounded-2xl p-4 flex items-center gap-3 print:hidden">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <p className="font-dm text-sm text-red-600">{error}</p>
            </div>
          ) : data ? (
            <>
              {/* Infos livreur */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-charcoal/5 rounded-2xl p-5">
                  <p className="font-syne text-[10px] font-bold uppercase tracking-widest text-charcoal/40 mb-3">Livreur</p>
                  <p className="font-syne font-bold text-lg text-charcoal">{data.driver?.user?.name}</p>
                  <p className="font-dm text-sm text-charcoal/60">{data.driver?.user?.phone || '—'}</p>
                  <p className="font-dm text-sm text-charcoal/50">{data.driver?.user?.email || '—'}</p>
                  <div className="mt-3 flex gap-3">
                    <div>
                      <p className="font-syne text-[10px] font-bold text-charcoal/40">Véhicule</p>
                      <p className="font-dm text-sm text-charcoal">{data.driver?.vehicleType || '—'}</p>
                    </div>
                    <div>
                      <p className="font-syne text-[10px] font-bold text-charcoal/40">Immatriculation</p>
                      <p className="font-dm text-sm text-charcoal">{data.driver?.vehiclePlate || '—'}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-forest rounded-2xl p-5 text-white">
                  <p className="font-syne text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Résumé de la période</p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-dm text-sm text-white/70">Livraisons effectuées</span>
                      <span className="font-playfair text-xl font-bold text-safran">{data.totalDeliveries}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-dm text-sm text-white/70">Frais de livraison bruts</span>
                      <span className="font-syne font-bold text-white">{fmt(data.grossDeliveryFees)} FCFA</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-white/10 pt-3">
                      <span className="font-dm text-sm text-white/70">Part livreur ({Math.round(data.driverShare * 100)}%)</span>
                      <span className="font-syne font-bold text-green-300">{fmt(data.driverEarnings)} FCFA</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-dm text-sm text-white/70">Part plateforme ({Math.round(data.platformShare * 100)}%)</span>
                      <span className="font-syne font-bold text-white/60">{fmt(data.platformEarnings)} FCFA</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Montant à encaisser */}
              <div className="bg-safran/10 border-2 border-safran/30 rounded-2xl p-5 mb-8 flex items-center justify-between">
                <div>
                  <p className="font-syne text-xs font-bold uppercase tracking-widest text-charcoal/60">Montant net à encaisser</p>
                  <p className="font-playfair text-4xl font-bold text-charcoal mt-1">{fmt(data.driverEarnings)} <span className="text-2xl text-charcoal/50">FCFA</span></p>
                </div>
                <div className="text-right">
                  <p className="font-syne text-xs text-charcoal/50">Date d'édition</p>
                  <p className="font-syne font-bold text-charcoal text-sm">{new Date().toLocaleDateString('fr-FR')}</p>
                </div>
              </div>

              {/* Détail des livraisons */}
              {data.orders.length > 0 ? (
                <div>
                  <p className="font-syne text-xs font-bold uppercase tracking-widest text-charcoal/40 mb-4">Détail des livraisons</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-charcoal/10">
                        {['#', 'Date', 'Client', 'Boutique', 'Commande', 'Frais liv.', 'Part livreur'].map(h => (
                          <th key={h} className="pb-3 text-left font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/35 pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.orders.map((o, i) => (
                        <tr key={o.id}>
                          <td className="py-2.5 pr-4 font-syne font-bold text-charcoal/40 text-xs">{fmtOrderId(o.id, o.deliveredAt)}</td>
                          <td className="py-2.5 pr-4 font-dm text-xs text-charcoal/50">{fmtShort(o.deliveredAt)}</td>
                          <td className="py-2.5 pr-4 font-dm text-xs text-charcoal/70">{o.buyer}</td>
                          <td className="py-2.5 pr-4 font-dm text-xs text-charcoal/70">{o.shop}</td>
                          <td className="py-2.5 pr-4 font-syne text-xs font-bold text-charcoal">{fmt(o.orderTotal)} F</td>
                          <td className="py-2.5 pr-4 font-dm text-xs text-charcoal/60">{fmt(o.deliveryFee)} F</td>
                          <td className="py-2.5 font-syne text-xs font-bold text-forest">{fmt(o.driverEarning)} F</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-charcoal/10">
                        <td colSpan={5} className="pt-3 font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider">Total</td>
                        <td className="pt-3 font-syne text-sm font-bold text-charcoal">{fmt(data.grossDeliveryFees)} F</td>
                        <td className="pt-3 font-syne text-sm font-bold text-forest">{fmt(data.driverEarnings)} F</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="font-dm text-charcoal/40">Aucune livraison sur cette période</p>
                </div>
              )}

              {/* Signature */}
              <div className="mt-10 pt-6 border-t border-gray-100 grid grid-cols-2 gap-8">
                <div>
                  <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-8">Signature RizIvoirien</p>
                  <div className="border-b border-gray-300 w-40" />
                  <p className="font-dm text-xs text-charcoal/40 mt-1">Responsable des opérations</p>
                </div>
                <div>
                  <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-8">Signature du livreur</p>
                  <div className="border-b border-gray-300 w-40" />
                  <p className="font-dm text-xs text-charcoal/40 mt-1">{data.driver?.user?.name}</p>
                </div>
              </div>

              {/* Pied de page */}
              <p className="text-center font-dm text-[10px] text-charcoal/25 mt-6">
                RizIvoirien — Document généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          ) : null}
        </div>
      </motion.div>

      {/* Style d'impression */}
      <style>{`
        @media print {
          * { visibility: hidden !important; }
          #payslip-content, #payslip-content * { visibility: visible !important; }
          #payslip-content {
            position: fixed !important; inset: 0 !important;
            width: 100% !important; height: auto !important; max-height: none !important;
            overflow: visible !important; box-shadow: none !important;
            border-radius: 0 !important; border: none !important;
            background: white !important; padding: 24px !important; z-index: 9999 !important;
          }
          .print\\:hidden { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </div>
  )
}

// ─── DriverModal ──────────────────────────────────────────────────────────────
function DriverModal({ driver, onClose, onAction, onPayslip, onPlanChange, onRefresh }) {
  const [note, setNote]         = useState('')
  const [loading, setLoading]   = useState(null)
  const [error, setError]       = useState(null)
  const [regenLoading, setRegenLoading] = useState(false)
  const [regenMsg, setRegenMsg] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [currentPlan, setCurrentPlan] = useState(driver.plan || 'BASIC')
  const [clearLoading, setClearLoading] = useState(false)
  const [clearMsg, setClearMsg]         = useState(null)
  const [currentWarnings, setCurrentWarnings] = useState(driver.warningCount || 0)
  const [currentAutoSuspended, setCurrentAutoSuspended] = useState(driver.autoSuspended || false)

  const changePlan = async (newPlan) => {
    if (newPlan === currentPlan) return
    setPlanLoading(true); setError(null)
    try {
      await api.put(`/admin/drivers/${driver.id}/plan`, { plan: newPlan })
      setCurrentPlan(newPlan)
      if (onPlanChange) onPlanChange(driver.id, newPlan)
    } catch (e) {
      setError(e.message || 'Erreur lors du changement de plan')
    } finally { setPlanLoading(false) }
  }

  const handleClearPenalties = async () => {
    setClearLoading(true); setError(null); setClearMsg(null)
    try {
      const updated = await api.put(`/admin/drivers/${driver.id}/clear-penalties`, {})
      setCurrentWarnings(0)
      setCurrentAutoSuspended(false)
      setClearMsg(updated.status === 'ACTIVE' ? 'Avertissements effacés et compte réactivé.' : 'Avertissements effacés.')
      if (onRefresh) onRefresh()
    } catch (e) { setError(e.message || 'Erreur lors de l\'effacement des pénalités') }
    finally { setClearLoading(false) }
  }

  const act = async (status) => {
    setLoading(status); setError(null)
    try {
      await onAction(driver.id, status, note)
      onClose()
    } catch (e) {
      setError(e.message || 'Erreur lors de l\'action')
    } finally { setLoading(null) }
  }

  const regenerateContract = async () => {
    setRegenLoading(true); setRegenMsg(null); setError(null)
    try {
      await api.post(`/admin/contracts/regenerate/driver/${driver.id}`, {})
      setRegenMsg('Contrat régénéré — le livreur devra le signer à nouveau.')
    } catch (e) {
      setError(e.message || 'Erreur lors de la régénération')
    } finally { setRegenLoading(false) }
  }

  const u = driver.user || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-charcoal overflow-hidden shrink-0 flex items-center justify-center">
              {driver.avatar
                ? <img src={driver.avatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <Truck size={16} className="text-white/40" />
              }
            </div>
            <div>
              <h2 className="font-playfair text-lg font-bold text-charcoal">{u.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-syne text-[10px] font-bold text-charcoal/30">{fmtDriverId(driver.id)}</span>
                <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(driver.status).cls}`}>
                  {statusBadge(driver.status).label}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {driver.status === 'ACTIVE' && (
              <button onClick={onPayslip}
                className="flex items-center gap-1.5 bg-forest text-white font-syne text-xs font-bold px-3 py-2 rounded-xl hover:bg-forest-light transition-colors">
                <Printer size={12} /> Fiche de paie
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats rapides */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Note', value: `★ ${driver.rating?.toFixed(1) || '—'}`, color: 'text-safran' },
              { label: 'Livraisons', value: driver.totalDeliveries || 0, color: 'text-charcoal' },
              { label: 'Acceptation', value: `${Math.round((driver.acceptanceRate || 0) * 100)}%`, color: 'text-forest-light' },
              { label: 'Statut', value: driver.online ? 'En ligne' : 'Hors ligne', color: driver.online ? 'text-green-600' : 'text-gray-400' },
            ].map(s => (
              <div key={s.label} className="bg-charcoal/5 rounded-xl p-3 text-center">
                <p className={`font-playfair font-bold text-lg ${s.color}`}>{s.value}</p>
                <p className="font-syne text-[10px] uppercase tracking-wider text-charcoal/40">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="bg-charcoal/5 rounded-2xl p-4 grid grid-cols-2 gap-3">
            <div>
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-1">Email</p>
              <p className="font-dm text-sm text-charcoal">{u.email || '—'}</p>
            </div>
            <div>
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-1">Téléphone</p>
              <p className="font-dm text-sm text-charcoal">{u.phone || '—'}</p>
            </div>
            <div>
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-1">Véhicule</p>
              <p className="font-dm text-sm text-charcoal">{driver.vehicleType || '—'} · {driver.vehiclePlate || '—'}</p>
            </div>
            <div>
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-1">N° CNI</p>
              <p className="font-dm text-sm text-charcoal">{driver.idNumber || '—'}</p>
            </div>
            <div>
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-1">N° Permis</p>
              <p className="font-dm text-sm text-charcoal">{driver.licenseNumber || '—'}</p>
            </div>
            <div>
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-1">Expiration permis</p>
              <p className="font-dm text-sm text-charcoal">{driver.licenseExpiry ? new Date(driver.licenseExpiry).toLocaleDateString('fr-FR') : '—'}</p>
            </div>
          </div>

          {/* Documents */}
          <div>
            <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-3">Pièces justificatives</p>
            <div className="grid grid-cols-3 gap-3">
              <DocImage src={driver.idPhoto} label="Photo CNI" icon={<Shield size={12} className="text-gray-400" />} />
              <DocImage src={driver.licensePhoto} label="Permis de conduire" icon={<CreditCard size={12} className="text-gray-400" />} />
              <DocImage src={driver.vehiclePhoto} label="Photo du véhicule" icon={<Car size={12} className="text-gray-400" />} />
            </div>
          </div>

          {/* Contract status */}
          <div className="bg-charcoal/5 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-1.5">Contrat de partenariat</p>
                <div className="flex items-center gap-2">
                  <FileText size={13} className="text-charcoal/40" />
                  <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full ${contractBadge(driver.contract).cls}`}>
                    {contractBadge(driver.contract).label}
                  </span>
                  {driver.contract?.signedAt && (
                    <span className="font-dm text-[11px] text-charcoal/40">
                      le {new Date(driver.contract.signedAt).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
              </div>
              {driver.status === 'ACTIVE' && (
                <button onClick={regenerateContract} disabled={regenLoading}
                  className="flex items-center gap-1.5 bg-white border border-gray-200 text-charcoal/60 font-syne text-xs font-bold px-3 py-2 rounded-xl hover:border-forest-light hover:text-forest transition-all disabled:opacity-50">
                  <RefreshCw size={12} className={regenLoading ? 'animate-spin' : ''} />
                  Régénérer
                </button>
              )}
            </div>
            {regenMsg && (
              <p className="font-dm text-xs text-green-600 mt-2 flex items-center gap-1.5">
                <CheckCircle size={12} /> {regenMsg}
              </p>
            )}
          </div>

          {/* Plan */}
          <div className="bg-charcoal/5 rounded-2xl p-4">
            <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-3">Plan livreur</p>
            <div className="flex gap-2">
              {['BASIC', 'PREMIUM'].map(p => (
                <button key={p} onClick={() => changePlan(p)} disabled={planLoading}
                  className={`flex-1 py-2 rounded-xl font-syne text-sm font-bold transition-all disabled:opacity-60 ${
                    currentPlan === p
                      ? p === 'PREMIUM' ? 'bg-safran text-white shadow-sm' : 'bg-charcoal text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-charcoal/50 hover:border-charcoal/30'
                  }`}>
                  {planLoading && currentPlan !== p ? (
                    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin mx-auto" />
                  ) : p}
                </button>
              ))}
            </div>
            <p className="font-dm text-[11px] text-charcoal/40 mt-2">
              {currentPlan === 'PREMIUM'
                ? 'Commission majorée · Priorité d\'assignation haute'
                : 'Commission standard · Priorité d\'assignation normale'}
            </p>
          </div>

          {/* Pénalités */}
          {(currentWarnings > 0 || currentAutoSuspended) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="font-syne text-xs font-bold uppercase tracking-wider text-amber-700 mb-3">Pénalités en cours</p>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-dm text-sm text-charcoal">
                    Avertissements : <strong className="text-orange-600">{currentWarnings}/2</strong>
                  </p>
                  {currentAutoSuspended && (
                    <p className="font-dm text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle size={11} /> Suspendu automatiquement (faible taux d'acceptation)
                    </p>
                  )}
                </div>
                <button onClick={handleClearPenalties} disabled={clearLoading}
                  className="flex items-center gap-1.5 bg-white border border-amber-300 text-amber-700 font-syne text-xs font-bold px-3 py-2 rounded-xl hover:bg-amber-100 transition-all disabled:opacity-50 shrink-0">
                  {clearLoading
                    ? <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-600 rounded-full animate-spin" />
                    : <RefreshCw size={12} />
                  }
                  Effacer pénalités
                </button>
              </div>
              {clearMsg && (
                <p className="font-dm text-xs text-green-600 mt-2 flex items-center gap-1.5">
                  <CheckCircle size={12} /> {clearMsg}
                </p>
              )}
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="font-dm text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Note */}
          {(driver.status === 'PENDING' || driver.status === 'ACTIVE') && (
            <div>
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-2">
                Note (motif de rejet/suspension)
              </label>
              <textarea
                value={note} onChange={e => setNote(e.target.value)}
                rows={2} placeholder="Optionnel — sera transmise au livreur…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm resize-none focus:outline-none focus:border-forest-light"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {driver.status === 'PENDING' && <>
              <ActionBtn color="green" icon={<CheckCircle size={15} />} label="Approuver le dossier" onClick={() => act('ACTIVE')} loading={loading === 'ACTIVE'} />
              <ActionBtn color="red" icon={<XCircle size={15} />} label="Rejeter" onClick={() => act('REJECTED')} loading={loading === 'REJECTED'} />
            </>}
            {driver.status === 'ACTIVE' && (
              <ActionBtn color="orange" icon={<PauseCircle size={15} />} label="Suspendre" onClick={() => act('SUSPENDED')} loading={loading === 'SUSPENDED'} />
            )}
            {driver.status === 'SUSPENDED' && <>
              {currentAutoSuspended && (
                <p className="w-full font-dm text-xs text-orange-600 flex items-center gap-1.5 mb-1">
                  <AlertCircle size={12} />
                  Suspension automatique — utilisez "Effacer pénalités" pour réactiver proprement.
                </p>
              )}
              <ActionBtn color="green" icon={<CheckCircle size={15} />} label="Réactiver" onClick={() => act('ACTIVE')} loading={loading === 'ACTIVE'} />
              <ActionBtn color="red" icon={<XCircle size={15} />} label="Rejeter définitivement" onClick={() => act('REJECTED')} loading={loading === 'REJECTED'} />
            </>}
            {driver.status === 'REJECTED' && (
              <ActionBtn color="amber" icon={<Clock size={15} />} label="Remettre en attente" onClick={() => act('PENDING')} loading={loading === 'PENDING'} />
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── ActionBtn ────────────────────────────────────────────────────────────────
function ActionBtn({ color, icon, label, onClick, loading }) {
  const colors = {
    green:  'bg-green-600 hover:bg-green-700 text-white',
    red:    'bg-red-500 hover:bg-red-600 text-white',
    orange: 'bg-orange-500 hover:bg-orange-600 text-white',
    amber:  'bg-amber-500 hover:bg-amber-600 text-white',
  }
  return (
    <button onClick={onClick} disabled={!!loading}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne text-sm font-bold transition-all disabled:opacity-60 ${colors[color]}`}>
      {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : icon}
      {label}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DriversAdminTab({ onBadgeUpdate }) {
  const [activeStatus, setActiveStatus] = useState('PENDING')
  const [drivers, setDrivers]           = useState([])
  const [counts, setCounts]             = useState({})
  const [codes, setCodes]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [genLoading, setGenLoading]     = useState(false)
  const [selected, setSelected]         = useState(null)
  const [payslipDriver, setPayslipDriver] = useState(null)
  const [copied, setCopied]             = useState(null)

  const onBadgeRef = useRef(onBadgeUpdate)
  useEffect(() => { onBadgeRef.current = onBadgeUpdate }, [onBadgeUpdate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dData, cData] = await Promise.all([
        api.get('/admin/drivers'),
        api.get('/admin/invite-codes'),
      ])
      setDrivers(dData.drivers || [])
      const c = {}
      ;(dData.counts || []).forEach(x => { c[x.status] = x._count.id })
      setCounts(c)
      if (onBadgeRef.current) onBadgeRef.current(c.PENDING || 0)
      setCodes(cData || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAction = async (driverId, status, note) => {
    await api.put(`/admin/drivers/${driverId}/status`, { status, note })
    await load()
  }

  const handlePlanChange = (driverId, newPlan) => {
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, plan: newPlan } : d))
  }

  const genCodes = async () => {
    setGenLoading(true)
    try {
      const created = await api.post('/admin/invite-codes', { count: 5 })
      setCodes(c => [...created, ...c])
    } finally { setGenLoading(false) }
  }

  const copyCode = (code) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const filtered      = drivers.filter(d => d.status === activeStatus)
  const availableCodes = codes.filter(c => !c.used)
  const usedCodes      = codes.filter(c => c.used)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Administration</p>
        <h1 className="font-playfair text-3xl font-bold text-charcoal">
          Livreurs
          <span className="text-charcoal/25 ml-2 text-2xl">({drivers.length})</span>
        </h1>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(t => {
          const cnt = counts[t.id] || 0
          const active = activeStatus === t.id
          return (
            <button key={t.id} onClick={() => setActiveStatus(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-syne text-sm font-bold transition-all ${
                active ? `${t.bg} ${t.color} shadow-sm` : 'bg-white text-charcoal/50 hover:bg-gray-50'
              }`}>
              <span className={`w-2 h-2 rounded-full ${t.dot} ${active ? '' : 'opacity-40'}`} />
              {t.label}
              {cnt > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/60' : 'bg-gray-100'}`}>
                  {cnt}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-forest-light/30 border-t-forest-light rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center">
          <Truck size={40} className="mx-auto text-gray-200 mb-4" />
          <p className="font-syne font-bold text-gray-400">Aucun livreur dans cette catégorie</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Livreur', 'Contact', 'Véhicule', 'Livraisons', 'Taux accept.', 'Note', 'Statut', 'Contrat', ''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left font-syne text-[10px] font-bold tracking-widest uppercase text-charcoal/35">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(d => {
                const { cls, label } = statusBadge(d.status)
                const u = d.user || {}
                return (
                  <tr key={d.id} className="hover:bg-charcoal/5/50 transition-colors group cursor-pointer" onClick={() => setSelected(d)}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-charcoal overflow-hidden shrink-0 flex items-center justify-center">
                          {d.avatar
                            ? <img src={d.avatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                            : <Truck size={14} className="text-white/40" />
                          }
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-syne text-sm font-bold text-charcoal">{u.name}</p>
                            <span className={`font-syne text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              d.plan === 'PREMIUM' ? 'bg-safran/15 text-safran' : 'bg-gray-100 text-gray-400'
                            }`}>{d.plan || 'BASIC'}</span>
                            {d.warningCount > 0 && !d.autoSuspended && (
                              <span className={`font-syne text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                d.warningCount >= 2 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                              }`}>⚠ {d.warningCount}/2</span>
                            )}
                            {d.autoSuspended && (
                              <span className="font-syne text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                                ⛔ Auto-suspendu
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${d.online ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                            <span className="font-dm text-[11px] text-charcoal/40">{d.online ? 'En ligne' : 'Hors ligne'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-dm text-xs text-charcoal/60">{u.phone || '—'}</p>
                      <p className="font-dm text-xs text-charcoal/40">{u.email || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-dm text-xs text-charcoal/70">{d.vehicleType || '—'}</p>
                      <p className="font-dm text-xs text-charcoal/40">{d.vehiclePlate || '—'}</p>
                    </td>
                    <td className="px-5 py-4 font-syne font-bold text-charcoal text-sm">{d.totalDeliveries}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full">
                          <div className={`h-1.5 ${rateBarColor(d.acceptanceRate || 0)} rounded-full`} style={{ width: `${(d.acceptanceRate || 0) * 100}%` }} />
                        </div>
                        <span className="font-syne text-xs font-bold text-charcoal">{Math.round((d.acceptanceRate || 0) * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-playfair font-bold text-safran">★ {d.rating?.toFixed(1) || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-[10px] font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-[10px] font-bold px-2.5 py-1 rounded-full ${contractBadge(d.contract).cls}`}>
                        {contractBadge(d.contract).label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {d.status === 'ACTIVE' && (
                          <button
                            onClick={e => { e.stopPropagation(); setPayslipDriver(d) }}
                            className="flex items-center gap-1 bg-forest/10 text-forest font-syne text-[10px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-forest/20 transition-colors">
                            <Printer size={11} /> Fiche
                          </button>
                        )}
                        <Eye size={15} className="text-gray-300 group-hover:text-forest-light transition-colors" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite codes */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-playfair text-xl font-bold text-charcoal">Codes d'invitation</h2>
            <p className="font-dm text-sm text-charcoal/40 mt-0.5">
              {availableCodes.length} disponible{availableCodes.length !== 1 ? 's' : ''} · {usedCodes.length} utilisé{usedCodes.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={genCodes} disabled={genLoading}
            className="flex items-center gap-2 bg-charcoal text-white font-syne text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-charcoal/80 transition-colors disabled:opacity-60">
            <Plus size={14} />
            {genLoading ? 'Génération…' : 'Générer 5 codes'}
          </button>
        </div>

        {codes.length === 0 ? (
          <p className="font-dm text-sm text-charcoal/40 text-center py-8">Aucun code généré pour l'instant</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {codes.slice(0, 20).map(c => (
              <div key={c.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  c.used ? 'border-gray-100 opacity-40' : 'border-forest-light/30 bg-forest-light/5 hover:border-forest-light/60'
                }`}>
                <code className="font-syne text-sm font-bold text-charcoal">{c.code}</code>
                {!c.used && (
                  <button onClick={() => copyCode(c.code)}
                    className="text-charcoal/30 hover:text-forest-light transition-colors ml-2">
                    {copied === c.code ? <CheckCircle size={13} className="text-forest-light" /> : <Copy size={13} />}
                  </button>
                )}
                {c.used && <span className="font-syne text-[9px] font-bold text-gray-400 uppercase">Utilisé</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selected && (
          <DriverModal
            driver={selected}
            onClose={() => setSelected(null)}
            onAction={handleAction}
            onPayslip={() => { setPayslipDriver(selected); setSelected(null) }}
            onPlanChange={handlePlanChange}
            onRefresh={load}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {payslipDriver && (
          <PayslipModal
            driver={payslipDriver}
            onClose={() => setPayslipDriver(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
