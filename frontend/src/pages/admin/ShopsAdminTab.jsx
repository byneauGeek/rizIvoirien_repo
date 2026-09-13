import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../../api/client'
import { fmtShopId } from '../../utils/status'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store, CheckCircle, XCircle, Clock, PauseCircle,
  Eye, Award, Phone, Mail, MapPin, Package, ShoppingBag,
  ChevronRight, X, AlertTriangle, Star, Building, AlertCircle,
  FileText, RefreshCw
} from 'lucide-react'

const STATUS_TABS = [
  { id: 'PENDING',   label: 'En attente',  color: 'text-amber-600',   bg: 'bg-amber-50',   dot: 'bg-amber-500' },
  { id: 'ACTIVE',    label: 'Actives',     color: 'text-green-700',   bg: 'bg-green-50',   dot: 'bg-green-500' },
  { id: 'SUSPENDED', label: 'Suspendues',  color: 'text-orange-600',  bg: 'bg-orange-50',  dot: 'bg-orange-500' },
  { id: 'REJECTED',  label: 'Rejetées',   color: 'text-red-600',     bg: 'bg-red-50',     dot: 'bg-red-500' },
]

const statusBadge = (s) => {
  const map = {
    PENDING:   'bg-amber-100 text-amber-700',
    ACTIVE:    'bg-green-100 text-green-700',
    SUSPENDED: 'bg-orange-100 text-orange-700',
    REJECTED:  'bg-red-100 text-red-700',
  }
  const labels = { PENDING: 'En attente', ACTIVE: 'Active', SUSPENDED: 'Suspendue', REJECTED: 'Rejetée' }
  return { cls: map[s] || 'bg-gray-100 text-gray-500', label: labels[s] || s }
}

const contractBadge = (contract) => {
  if (!contract) return { cls: 'bg-gray-100 text-gray-400', label: '—' }
  if (contract.status === 'SIGNED') return { cls: 'bg-green-100 text-green-700', label: '✓ Signé' }
  return { cls: 'bg-amber-100 text-amber-700', label: '⏳ En attente' }
}

function ShopModal({ shop, onClose, onAction }) {
  const [note, setNote]         = useState('')
  const [loading, setLoading]   = useState(null)
  const [error, setError]       = useState(null)
  const [regenLoading, setRegenLoading] = useState(false)
  const [regenMsg, setRegenMsg] = useState(null)

  const act = async (status) => {
    setLoading(status); setError(null)
    try {
      await onAction(shop.id, status, note)
      onClose()
    } catch (e) {
      setError(e.message || 'Erreur lors de l\'action')
    } finally { setLoading(null) }
  }

  const regenerateContract = async () => {
    setRegenLoading(true); setRegenMsg(null); setError(null)
    try {
      await api.post(`/admin/contracts/regenerate/shop/${shop.id}`, {})
      setRegenMsg('Contrat régénéré — le vendeur devra le signer à nouveau.')
    } catch (e) {
      setError(e.message || 'Erreur lors de la régénération')
    } finally { setRegenLoading(false) }
  }

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
            <div className="w-10 h-10 rounded-2xl bg-charcoal/5 overflow-hidden shrink-0">
              {shop.avatar
                ? <img src={shop.avatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <Store size={18} className="m-auto mt-2.5 text-gray-400" />
              }
            </div>
            <div>
              <h2 className="font-playfair text-lg font-bold text-charcoal">{shop.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-syne text-[10px] font-bold text-charcoal/30">{fmtShopId(shop.id)}</span>
                <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(shop.status).cls}`}>
                  {statusBadge(shop.status).label}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Cover */}
          {shop.coverImage && (
            <div className="h-32 rounded-2xl overflow-hidden">
              <img src={shop.coverImage} alt="Cover" className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <InfoCard icon={<Building size={14} />} label="Raison sociale" value={shop.businessName || '—'} />
            <InfoCard icon={<Store size={14} />} label="RCCM" value={shop.rccm || '—'} />
            <InfoCard icon={<Phone size={14} />} label="Téléphone" value={shop.phone || '—'} />
            <InfoCard icon={<Mail size={14} />} label="Email boutique" value={shop.email || '—'} />
            <InfoCard icon={<MapPin size={14} />} label="Localisation" value={shop.location || '—'} />
            <InfoCard icon={<Star size={14} />} label="Spécialité" value={shop.speciality || '—'} />
            <InfoCard icon={<Package size={14} />} label="Produits" value={shop._count?.products ?? '—'} />
            <InfoCard icon={<ShoppingBag size={14} />} label="Commandes" value={shop._count?.orders ?? '—'} />
          </div>

          {/* Vendor */}
          <div className="bg-charcoal/5 rounded-2xl p-4">
            <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-2">Propriétaire</p>
            <p className="font-syne font-bold text-charcoal">{shop.user?.name}</p>
            <p className="font-dm text-sm text-charcoal/50">{shop.user?.email}</p>
          </div>

          {/* Description */}
          {shop.description && (
            <div>
              <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-2">Description</p>
              <p className="font-dm text-sm text-charcoal/70 leading-relaxed">{shop.description}</p>
            </div>
          )}

          {/* Contract status */}
          <div className="bg-charcoal/5 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-1.5">Contrat de partenariat</p>
                <div className="flex items-center gap-2">
                  <FileText size={13} className="text-charcoal/40" />
                  <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full ${contractBadge(shop.contract).cls}`}>
                    {contractBadge(shop.contract).label}
                  </span>
                  {shop.contract?.signedAt && (
                    <span className="font-dm text-[11px] text-charcoal/40">
                      le {new Date(shop.contract.signedAt).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
              </div>
              {shop.status === 'ACTIVE' && (
                <button onClick={regenerateContract} disabled={regenLoading}
                  className="flex items-center gap-1.5 bg-white border border-gray-200 text-charcoal/60 font-syne text-xs font-bold px-3 py-2 rounded-xl hover:border-forest hover:text-forest transition-all disabled:opacity-50">
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

          {/* Note field for reject/suspend */}
          {(shop.status === 'PENDING' || shop.status === 'ACTIVE') && (
            <div>
              <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-2">
                Note (motif de rejet/suspension)
              </label>
              <textarea
                value={note} onChange={e => setNote(e.target.value)}
                rows={2} placeholder="Optionnel — sera transmise au vendeur…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm resize-none focus:outline-none focus:border-forest"
              />
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="font-dm text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {shop.status === 'PENDING' && <>
              <ActionBtn color="green" icon={<CheckCircle size={15} />} label="Approuver" onClick={() => act('ACTIVE')} loading={loading === 'ACTIVE'} />
              <ActionBtn color="red" icon={<XCircle size={15} />} label="Rejeter" onClick={() => act('REJECTED')} loading={loading === 'REJECTED'} />
            </>}
            {shop.status === 'ACTIVE' && <>
              <ActionBtn color="orange" icon={<PauseCircle size={15} />} label="Suspendre" onClick={() => act('SUSPENDED')} loading={loading === 'SUSPENDED'} />
              {!shop.certified && (
                <ActionBtn color="gold" icon={<Award size={15} />} label="Certifier" onClick={async () => {
                  setLoading('CERTIFY'); setError(null)
                  try {
                    await api.put(`/admin/shops/${shop.id}/certify`, { certified: true, plan: 'CERTIFIED' })
                    await onAction(shop.id, shop.status, '') // recharge la liste
                    onClose()
                  } catch (e) {
                    setError(e.message || 'Erreur lors de la certification')
                  } finally { setLoading(null) }
                }} loading={loading === 'CERTIFY'} />
              )}
            </>}
            {shop.status === 'SUSPENDED' && <>
              <ActionBtn color="green" icon={<CheckCircle size={15} />} label="Réactiver" onClick={() => act('ACTIVE')} loading={loading === 'ACTIVE'} />
              <ActionBtn color="red" icon={<XCircle size={15} />} label="Rejeter définitivement" onClick={() => act('REJECTED')} loading={loading === 'REJECTED'} />
            </>}
            {shop.status === 'REJECTED' && (
              <ActionBtn color="amber" icon={<Clock size={15} />} label="Remettre en attente" onClick={() => act('PENDING')} loading={loading === 'PENDING'} />
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="bg-charcoal/5 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-charcoal/40 mb-1">
        {icon}
        <span className="font-syne text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-dm text-sm text-charcoal font-medium truncate">{String(value)}</p>
    </div>
  )
}

function ActionBtn({ color, icon, label, onClick, loading }) {
  const colors = {
    green:  'bg-green-600 hover:bg-green-700 text-white',
    red:    'bg-red-500 hover:bg-red-600 text-white',
    orange: 'bg-orange-500 hover:bg-orange-600 text-white',
    amber:  'bg-amber-500 hover:bg-amber-600 text-white',
    gold:   'bg-safran hover:bg-safran/80 text-white',
  }
  return (
    <button onClick={onClick} disabled={!!loading}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne text-sm font-bold transition-all disabled:opacity-60 ${colors[color]}`}>
      {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : icon}
      {label}
    </button>
  )
}

export default function ShopsAdminTab({ onBadgeUpdate }) {
  const [activeStatus, setActiveStatus] = useState('PENDING')
  const [shops, setShops] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  const onBadgeRef = useRef(onBadgeUpdate)
  useEffect(() => { onBadgeRef.current = onBadgeUpdate }, [onBadgeUpdate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/shops')
      const all = data.shops || []
      setShops(all)
      const c = {}
      ;(data.counts || []).forEach(x => { c[x.status] = x._count.id })
      setCounts(c)
      if (onBadgeRef.current) onBadgeRef.current(c.PENDING || 0)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAction = async (shopId, status, note) => {
    await api.put(`/admin/shops/${shopId}/status`, { status, note })
    await load()
  }

  const filtered = shops
    .filter(s => s.status === activeStatus)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.user?.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Administration</p>
          <h1 className="font-playfair text-3xl font-bold text-charcoal">
            Boutiques
            <span className="text-charcoal/25 ml-2 text-2xl">({shops.length})</span>
          </h1>
        </div>
        {/* Search */}
        <div className="relative">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une boutique…"
            className="w-64 pl-4 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 font-dm text-sm focus:outline-none focus:border-forest shadow-sm"
          />
        </div>
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
          <div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center">
          <Store size={40} className="mx-auto text-gray-200 mb-4" />
          <p className="font-syne font-bold text-gray-400">Aucune boutique dans cette catégorie</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Boutique', 'Propriétaire', 'Contact', 'RCCM', 'Produits', 'Plan', 'Statut', 'Contrat', ''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left font-syne text-[10px] font-bold tracking-widest uppercase text-charcoal/35">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => {
                const { cls, label } = statusBadge(s.status)
                return (
                  <tr key={s.id} className="hover:bg-charcoal/5/50 transition-colors group cursor-pointer" onClick={() => setSelected(s)}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-charcoal/5 overflow-hidden shrink-0 flex items-center justify-center">
                          {s.avatar
                            ? <img src={s.avatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                            : <Store size={15} className="text-gray-300" />
                          }
                        </div>
                        <div>
                          <p className="font-syne text-sm font-bold text-charcoal">{s.name}</p>
                          {s.certified && <span className="font-syne text-[10px] font-bold text-safran">✓ Certifiée</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-dm text-sm text-charcoal">{s.user?.name}</p>
                      <p className="font-dm text-xs text-charcoal/40">{s.user?.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-dm text-xs text-charcoal/60">{s.phone || '—'}</p>
                      <p className="font-dm text-xs text-charcoal/40">{s.location || '—'}</p>
                    </td>
                    <td className="px-5 py-4 font-dm text-xs text-charcoal/60">{s.rccm || '—'}</td>
                    <td className="px-5 py-4 font-syne font-bold text-charcoal text-sm">{s._count?.products || 0}</td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-[10px] font-bold px-2.5 py-1 rounded-full ${s.plan === 'CERTIFIED' ? 'bg-safran/15 text-safran' : 'bg-gray-100 text-gray-500'}`}>
                        {s.plan || 'BASIC'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-[10px] font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-[10px] font-bold px-2.5 py-1 rounded-full ${contractBadge(s.contract).cls}`}>
                        {contractBadge(s.contract).label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Eye size={15} className="text-gray-300 group-hover:text-forest-light transition-colors" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <ShopModal
            shop={selected}
            onClose={() => setSelected(null)}
            onAction={handleAction}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
