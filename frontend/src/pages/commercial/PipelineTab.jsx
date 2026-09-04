import { useState, useEffect } from 'react'
import { Store, Truck, Phone, Star } from 'lucide-react'
import { api } from '../../api/client'
import { fmt, fmtShopId, fmtDriverId } from '../../utils/status'
import FicheVendeur from './FicheVendeur'
import FicheLivreur from './FicheLivreur'

const SHOP_STATUSES = [
  { key: 'ALL',       label: 'Tous' },
  { key: 'PENDING',   label: 'En attente' },
  { key: 'ACTIVE',    label: 'Actifs' },
  { key: 'SUSPENDED', label: 'Suspendus' },
  { key: 'REJECTED',  label: 'Rejetés' },
]

const DRIVER_STATUSES = [
  { key: 'ALL',       label: 'Tous' },
  { key: 'PENDING',   label: 'En attente' },
  { key: 'ACTIVE',    label: 'Actifs' },
  { key: 'SUSPENDED', label: 'Suspendus' },
]

const STATUS_COLORS = {
  PENDING:   'bg-amber-100 text-amber-800',
  ACTIVE:    'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  REJECTED:  'bg-gray-100 text-gray-600',
}

const PLAN_COLORS = {
  BASIC:      'bg-slate-100 text-slate-700',
  CERTIFIED:  'bg-amber-100 text-amber-800',
  PREMIUM:    'bg-purple-100 text-purple-800',
}

const contractDot = (contract) => {
  if (!contract) return 'bg-gray-300'
  if (contract.status === 'SIGNED') return 'bg-green-500'
  return 'bg-amber-400'
}

function VendorCard({ shop, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all border border-transparent hover:border-indigo-200 w-full"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
          <span className="font-playfair font-bold text-indigo-600">{shop.name?.[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-syne font-bold text-charcoal text-sm truncate">{shop.name}</p>
          <p className="font-dm text-xs text-charcoal/50">{fmtShopId(shop.id)}</p>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${contractDot(shop.contract)}`} title="Statut contrat" />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[shop.status] || 'bg-gray-100 text-gray-600'}`}>
          {shop.status}
        </span>
        <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[shop.plan] || PLAN_COLORS.BASIC}`}>
          {shop.plan || 'BASIC'}
        </span>
        {shop.rating > 0 && (
          <span className="flex items-center gap-0.5 font-dm text-[10px] text-charcoal/60">
            <Star size={10} className="text-amber-400 fill-amber-400" /> {shop.rating?.toFixed(1)}
          </span>
        )}
      </div>

      <div className="font-dm text-xs text-charcoal/60 mb-1 truncate">
        {shop.user?.name} · {shop.user?.phone || shop.user?.email || ''}
      </div>

      <div className="flex gap-4 mt-3 pt-3 border-t border-charcoal/8">
        <div>
          <p className="font-syne text-sm font-bold text-charcoal">{shop.metrics?.totalOrders ?? 0}</p>
          <p className="font-dm text-[10px] text-charcoal/40">commandes</p>
        </div>
        <div>
          <p className="font-syne text-sm font-bold text-charcoal">{fmt(shop.metrics?.totalRevenue ?? 0)}</p>
          <p className="font-dm text-[10px] text-charcoal/40">FCFA CA</p>
        </div>
        <div>
          <p className="font-syne text-sm font-bold text-charcoal">{shop.metrics?.productCount ?? 0}</p>
          <p className="font-dm text-[10px] text-charcoal/40">produits</p>
        </div>
      </div>
    </button>
  )
}

function DriverCard({ driver, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all border border-transparent hover:border-blue-200 w-full"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <span className="font-playfair font-bold text-blue-600">{driver.user?.name?.[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-syne font-bold text-charcoal text-sm truncate">{driver.user?.name}</p>
          <p className="font-dm text-xs text-charcoal/50">{fmtDriverId(driver.id)}</p>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${contractDot(driver.contract)}`} title="Statut contrat" />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[driver.status] || 'bg-gray-100 text-gray-600'}`}>
          {driver.status}
        </span>
        <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[driver.plan] || PLAN_COLORS.BASIC}`}>
          {driver.plan || 'BASIC'}
        </span>
        {driver.rating > 0 && (
          <span className="flex items-center gap-0.5 font-dm text-[10px] text-charcoal/60">
            <Star size={10} className="text-amber-400 fill-amber-400" /> {driver.rating?.toFixed(1)}
          </span>
        )}
      </div>

      <div className="font-dm text-xs text-charcoal/60 mb-1 truncate">
        {driver.user?.phone || driver.user?.email || ''}
        {driver.vehicleType ? ` · ${driver.vehicleType}` : ''}
      </div>

      <div className="flex gap-4 mt-3 pt-3 border-t border-charcoal/8">
        <div>
          <p className="font-syne text-sm font-bold text-charcoal">{driver.totalDeliveries ?? 0}</p>
          <p className="font-dm text-[10px] text-charcoal/40">livraisons</p>
        </div>
        <div>
          <p className="font-syne text-sm font-bold text-charcoal">{fmt(driver.monthlyEarnings ?? 0)}</p>
          <p className="font-dm text-[10px] text-charcoal/40">FCFA/mois</p>
        </div>
        <div>
          <p className="font-syne text-sm font-bold text-charcoal">
            {driver.acceptanceRate != null ? `${Math.round(driver.acceptanceRate * 100)}%` : '—'}
          </p>
          <p className="font-dm text-[10px] text-charcoal/40">acceptation</p>
        </div>
      </div>
    </button>
  )
}

export default function PipelineTab({ onRefreshKpis }) {
  const [mode, setMode]         = useState('shops')    // 'shops' | 'drivers'
  const [status, setStatus]     = useState('ALL')
  const [search, setSearch]     = useState('')
  const [shops, setShops]       = useState([])
  const [drivers, setDrivers]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [selected, setSelected] = useState(null)   // shop or driver object
  const [ficheType, setFicheType] = useState(null) // 'shop' | 'driver'

  const loadShops = async () => {
    setLoading(true); setError(null)
    try {
      const q = status !== 'ALL' ? `?status=${status}` : ''
      const data = await api.get(`/commercial/pipeline${q}`)
      setShops(data.shops || [])
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  const loadDrivers = async () => {
    setLoading(true); setError(null)
    try {
      const q = status !== 'ALL' ? `?status=${status}` : ''
      const data = await api.get(`/commercial/driver-pipeline${q}`)
      setDrivers(data.drivers || [])
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (mode === 'shops') loadShops()
    else loadDrivers()
  }, [mode, status])

  const openFiche = (item, type) => { setSelected(item); setFicheType(type) }
  const closeFiche = () => { setSelected(null); setFicheType(null) }
  const handleRefresh = () => {
    closeFiche()
    if (mode === 'shops') loadShops()
    else loadDrivers()
    onRefreshKpis?.()
  }

  const statuses = mode === 'shops' ? SHOP_STATUSES : DRIVER_STATUSES

  const filteredShops = shops.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.user?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredDrivers = drivers.filter(d =>
    !search ||
    d.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.user?.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-playfair text-2xl font-bold text-charcoal">Pipeline partenaires</h2>
        {/* Mode toggle */}
        <div className="flex items-center bg-white rounded-xl shadow-sm border border-charcoal/10 p-1 gap-1">
          <button
            onClick={() => { setMode('shops'); setStatus('ALL') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-syne font-bold transition-colors ${
              mode === 'shops' ? 'bg-indigo-600 text-white' : 'text-charcoal/60 hover:text-charcoal'
            }`}
          >
            <Store size={14} /> Boutiques
          </button>
          <button
            onClick={() => { setMode('drivers'); setStatus('ALL') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-syne font-bold transition-colors ${
              mode === 'drivers' ? 'bg-blue-600 text-white' : 'text-charcoal/60 hover:text-charcoal'
            }`}
          >
            <Truck size={14} /> Livreurs
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="text"
          placeholder="Rechercher par nom…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="font-dm text-sm bg-white border border-charcoal/15 rounded-xl px-4 py-2.5 w-64 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <div className="flex gap-2 flex-wrap">
          {statuses.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
                status === key
                  ? 'bg-charcoal text-white border-charcoal'
                  : 'border-charcoal/20 text-charcoal/60 hover:border-charcoal/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-5 font-dm text-xs text-charcoal/50">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Contrat signé</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> En attente signature</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300" /> Aucun contrat</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
          <p className="font-dm text-sm text-red-600">Erreur de chargement : {error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : mode === 'shops' ? (
        filteredShops.length === 0 ? (
          <div className="text-center py-16 text-charcoal/40">
            <Store size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-dm">Aucune boutique</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShops.map(shop => (
              <VendorCard key={shop.id} shop={shop} onClick={() => openFiche(shop, 'shop')} />
            ))}
          </div>
        )
      ) : (
        filteredDrivers.length === 0 ? (
          <div className="text-center py-16 text-charcoal/40">
            <Truck size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-dm">Aucun livreur</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDrivers.map(driver => (
              <DriverCard key={driver.id} driver={driver} onClick={() => openFiche(driver, 'driver')} />
            ))}
          </div>
        )
      )}

      {ficheType === 'shop' && selected && (
        <FicheVendeur shop={selected} onClose={closeFiche} onRefresh={handleRefresh} />
      )}
      {ficheType === 'driver' && selected && (
        <FicheLivreur driver={selected} onClose={closeFiche} onRefresh={handleRefresh} />
      )}
    </div>
  )
}
