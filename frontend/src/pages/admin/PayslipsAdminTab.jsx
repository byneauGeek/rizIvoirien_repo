import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/client'
import { fmtOrderId } from '../../utils/status'
import { motion } from 'framer-motion'
import {
  Printer, AlertCircle, Truck, Search,
  FileText, Calendar, Store,
} from 'lucide-react'

const fmt     = n => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = d => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const fmtShort= d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })

const PERIODS = [
  { id: 'daily',   label: 'Journalier',   desc: "Aujourd'hui" },
  { id: 'weekly',  label: 'Hebdomadaire', desc: '7 derniers jours' },
  { id: 'monthly', label: 'Mensuel',      desc: '30 derniers jours' },
]

// ── Fiche livreur ─────────────────────────────────────────────────────────────
function DriverPayslip({ data, periodLabel }) {
  return (
    <>
      <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-[#0F1923]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🌾</span>
            <span className="font-playfair text-xl font-bold text-[#0F1923]">
              Riz<span className="text-[#E8A217]">Ivoirien</span>
            </span>
          </div>
          <p className="font-dm text-xs text-[#0F1923]/50">Marketplace alimentaire — Côte d'Ivoire</p>
          <p className="font-dm text-xs text-[#0F1923]/40 mt-0.5">support@rizivoirien.ci</p>
        </div>
        <div className="text-right">
          <p className="font-syne text-xs font-bold uppercase tracking-widest text-[#0F1923]/40">Bulletin de paie — Livreur</p>
          <p className="font-playfair text-2xl font-bold text-[#0F1923] mt-1">{periodLabel}</p>
          <p className="font-dm text-xs text-[#0F1923]/50 mt-1">
            {fmtDate(data.startDate)} → {fmtDate(data.endDate)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-[#F0F2F5] rounded-2xl p-5">
          <p className="font-syne text-[10px] font-bold uppercase tracking-widest text-[#0F1923]/40 mb-3">Livreur</p>
          <p className="font-syne font-bold text-lg text-[#0F1923]">{data.driver?.user?.name}</p>
          <p className="font-dm text-sm text-[#0F1923]/60">{data.driver?.user?.phone || '—'}</p>
          <p className="font-dm text-sm text-[#0F1923]/50">{data.driver?.user?.email || '—'}</p>
          <div className="mt-3 flex gap-4">
            <div>
              <p className="font-syne text-[10px] font-bold text-[#0F1923]/40">Véhicule</p>
              <p className="font-dm text-sm text-[#0F1923]">{data.driver?.vehicleType || '—'}</p>
            </div>
            <div>
              <p className="font-syne text-[10px] font-bold text-[#0F1923]/40">Immatriculation</p>
              <p className="font-dm text-sm text-[#0F1923]">{data.driver?.vehiclePlate || '—'}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1B4332] rounded-2xl p-5 text-white">
          <p className="font-syne text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Résumé période</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-dm text-sm text-white/70">Livraisons</span>
              <span className="font-playfair text-xl font-bold text-[#E8A217]">{data.totalDeliveries}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-dm text-sm text-white/70">Frais bruts</span>
              <span className="font-syne font-bold text-white">{fmt(data.grossDeliveryFees)} FCFA</span>
            </div>
            <div className="flex justify-between items-center border-t border-white/10 pt-3">
              <span className="font-dm text-sm text-white/70">Part livreur ({Math.round(data.driverShare * 100)}%)</span>
              <span className="font-syne font-bold text-green-300">{fmt(data.driverEarnings)} FCFA</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-dm text-sm text-white/70">Part plateforme ({Math.round(data.platformShare * 100)}%)</span>
              <span className="font-syne font-bold text-white/50">{fmt(data.platformEarnings)} FCFA</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#E8A217]/10 border-2 border-[#E8A217]/30 rounded-2xl p-5 mb-8 flex items-center justify-between">
        <div>
          <p className="font-syne text-xs font-bold uppercase tracking-widest text-[#0F1923]/60">Montant net à encaisser</p>
          <p className="font-playfair text-4xl font-bold text-[#0F1923] mt-1">
            {fmt(data.driverEarnings)} <span className="text-2xl text-[#0F1923]/50">FCFA</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-syne text-xs text-[#0F1923]/50">Date d'édition</p>
          <p className="font-syne font-bold text-[#0F1923] text-sm">{new Date().toLocaleDateString('fr-FR')}</p>
        </div>
      </div>

      {data.orders.length > 0 ? (
        <div>
          <p className="font-syne text-xs font-bold uppercase tracking-widest text-[#0F1923]/40 mb-4">Détail des livraisons</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#0F1923]/10">
                {['#', 'Date', 'Client', 'Boutique', 'Commande', 'Frais liv.', 'Part livreur'].map(h => (
                  <th key={h} className="pb-3 text-left font-syne text-[10px] font-bold uppercase tracking-wider text-[#0F1923]/35 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.orders.map(o => (
                <tr key={o.id}>
                  <td className="py-2.5 pr-4 font-syne font-bold text-[#0F1923]/40 text-xs">{fmtOrderId(o.id, o.deliveredAt)}</td>
                  <td className="py-2.5 pr-4 font-dm text-xs text-[#0F1923]/50">{fmtShort(o.deliveredAt)}</td>
                  <td className="py-2.5 pr-4 font-dm text-xs text-[#0F1923]/70">{o.buyer}</td>
                  <td className="py-2.5 pr-4 font-dm text-xs text-[#0F1923]/70">{o.shop}</td>
                  <td className="py-2.5 pr-4 font-syne text-xs font-bold text-[#0F1923]">{fmt(o.orderTotal)} F</td>
                  <td className="py-2.5 pr-4 font-dm text-xs text-[#0F1923]/60">{fmt(o.deliveryFee)} F</td>
                  <td className="py-2.5 font-syne text-xs font-bold text-[#1B4332]">{fmt(o.driverEarning)} F</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#0F1923]/10">
                <td colSpan={5} className="pt-3 font-syne text-xs font-bold text-[#0F1923]/40 uppercase tracking-wider">Total</td>
                <td className="pt-3 font-syne text-sm font-bold text-[#0F1923]">{fmt(data.grossDeliveryFees)} F</td>
                <td className="pt-3 font-syne text-sm font-bold text-[#1B4332]">{fmt(data.driverEarnings)} F</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 bg-[#F0F2F5] rounded-2xl">
          <p className="font-dm text-[#0F1923]/40">Aucune livraison sur cette période</p>
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-gray-100 grid grid-cols-2 gap-8">
        <div>
          <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#0F1923]/40 mb-8">Signature RizIvoirien</p>
          <div className="border-b border-gray-300 w-40" />
          <p className="font-dm text-xs text-[#0F1923]/40 mt-1">Responsable des opérations</p>
        </div>
        <div>
          <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#0F1923]/40 mb-8">Signature du livreur</p>
          <div className="border-b border-gray-300 w-40" />
          <p className="font-dm text-xs text-[#0F1923]/40 mt-1">{data.driver?.user?.name}</p>
        </div>
      </div>
    </>
  )
}

// ── Fiche vendeur ─────────────────────────────────────────────────────────────
function VendorPayslip({ data, periodLabel }) {
  return (
    <>
      <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-[#0F1923]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🌾</span>
            <span className="font-playfair text-xl font-bold text-[#0F1923]">
              Riz<span className="text-[#E8A217]">Ivoirien</span>
            </span>
          </div>
          <p className="font-dm text-xs text-[#0F1923]/50">Marketplace alimentaire — Côte d'Ivoire</p>
          <p className="font-dm text-xs text-[#0F1923]/40 mt-0.5">support@rizivoirien.ci</p>
        </div>
        <div className="text-right">
          <p className="font-syne text-xs font-bold uppercase tracking-widest text-[#0F1923]/40">Bulletin de paie — Vendeur</p>
          <p className="font-playfair text-2xl font-bold text-[#0F1923] mt-1">{periodLabel}</p>
          <p className="font-dm text-xs text-[#0F1923]/50 mt-1">
            {fmtDate(data.startDate)} → {fmtDate(data.endDate)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-[#F0F2F5] rounded-2xl p-5">
          <p className="font-syne text-[10px] font-bold uppercase tracking-widest text-[#0F1923]/40 mb-3">Boutique</p>
          <p className="font-syne font-bold text-lg text-[#0F1923]">{data.shop?.name}</p>
          <p className="font-dm text-sm text-[#0F1923]/60 mt-0.5">{data.shop?.location || '—'}</p>
          <div className="mt-3 border-t border-[#0F1923]/8 pt-3">
            <p className="font-syne text-[10px] font-bold text-[#0F1923]/40 mb-1">Propriétaire</p>
            <p className="font-dm text-sm text-[#0F1923]">{data.shop?.user?.name || '—'}</p>
            <p className="font-dm text-xs text-[#0F1923]/50">{data.shop?.user?.phone || '—'}</p>
            <p className="font-dm text-xs text-[#0F1923]/50">{data.shop?.user?.email || '—'}</p>
          </div>
        </div>
        <div className="bg-[#E8A217]/15 rounded-2xl p-5">
          <p className="font-syne text-[10px] font-bold uppercase tracking-widest text-[#0F1923]/40 mb-3">Résumé période</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-dm text-sm text-[#0F1923]/70">Commandes livrées</span>
              <span className="font-playfair text-xl font-bold text-[#0F1923]">{data.totalOrders}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-dm text-sm text-[#0F1923]/70">Chiffre d'affaires brut</span>
              <span className="font-syne font-bold text-[#0F1923]">{fmt(data.grossRevenue)} FCFA</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-dm text-sm text-[#0F1923]/70">Commission plateforme ({Math.round(data.commissionRate * 100)}%)</span>
              <span className="font-syne font-bold text-red-500">− {fmt(data.platformFees)} FCFA</span>
            </div>
            <div className="flex justify-between items-center border-t border-[#0F1923]/10 pt-3">
              <span className="font-dm text-sm font-bold text-[#0F1923]">Net vendeur</span>
              <span className="font-syne font-bold text-[#1B4332]">{fmt(data.vendorEarnings)} FCFA</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#E8A217]/10 border-2 border-[#E8A217]/30 rounded-2xl p-5 mb-8 flex items-center justify-between">
        <div>
          <p className="font-syne text-xs font-bold uppercase tracking-widest text-[#0F1923]/60">Montant net à reverser</p>
          <p className="font-playfair text-4xl font-bold text-[#0F1923] mt-1">
            {fmt(data.vendorEarnings)} <span className="text-2xl text-[#0F1923]/50">FCFA</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-syne text-xs text-[#0F1923]/50">Date d'édition</p>
          <p className="font-syne font-bold text-[#0F1923] text-sm">{new Date().toLocaleDateString('fr-FR')}</p>
        </div>
      </div>

      {data.orders.length > 0 ? (
        <div>
          <p className="font-syne text-xs font-bold uppercase tracking-widest text-[#0F1923]/40 mb-4">Détail des ventes</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#0F1923]/10">
                {['#', 'Date', 'Client', 'CA brut', 'Commission', 'Net vendeur'].map(h => (
                  <th key={h} className="pb-3 text-left font-syne text-[10px] font-bold uppercase tracking-wider text-[#0F1923]/35 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.orders.map(o => (
                <tr key={o.id}>
                  <td className="py-2.5 pr-4 font-syne font-bold text-[#0F1923]/40 text-xs">{fmtOrderId(o.id, o.createdAt)}</td>
                  <td className="py-2.5 pr-4 font-dm text-xs text-[#0F1923]/50">{fmtShort(o.deliveredAt)}</td>
                  <td className="py-2.5 pr-4 font-dm text-xs text-[#0F1923]/70">{o.buyer}</td>
                  <td className="py-2.5 pr-4 font-syne text-xs font-bold text-[#0F1923]">{fmt(o.orderTotal)} F</td>
                  <td className="py-2.5 pr-4 font-dm text-xs text-red-500">− {fmt(o.platformFee)} F</td>
                  <td className="py-2.5 font-syne text-xs font-bold text-[#1B4332]">{fmt(o.vendorNet)} F</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#0F1923]/10">
                <td colSpan={3} className="pt-3 font-syne text-xs font-bold text-[#0F1923]/40 uppercase tracking-wider">Total</td>
                <td className="pt-3 font-syne text-sm font-bold text-[#0F1923]">{fmt(data.grossRevenue)} F</td>
                <td className="pt-3 font-syne text-sm font-bold text-red-500">− {fmt(data.platformFees)} F</td>
                <td className="pt-3 font-syne text-sm font-bold text-[#1B4332]">{fmt(data.vendorEarnings)} F</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 bg-[#F0F2F5] rounded-2xl">
          <p className="font-dm text-[#0F1923]/40">Aucune vente sur cette période</p>
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-gray-100 grid grid-cols-2 gap-8">
        <div>
          <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#0F1923]/40 mb-8">Signature RizIvoirien</p>
          <div className="border-b border-gray-300 w-40" />
          <p className="font-dm text-xs text-[#0F1923]/40 mt-1">Responsable des opérations</p>
        </div>
        <div>
          <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#0F1923]/40 mb-8">Signature du vendeur</p>
          <div className="border-b border-gray-300 w-40" />
          <p className="font-dm text-xs text-[#0F1923]/40 mt-1">{data.shop?.user?.name}</p>
        </div>
      </div>
    </>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function PayslipsAdminTab() {
  const [mode, setMode]           = useState('driver')  // 'driver' | 'vendor'
  const [drivers, setDrivers]     = useState([])
  const [shops, setShops]         = useState([])
  const [selected, setSelected]   = useState(null)
  const [period, setPeriod]       = useState('weekly')
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')

  useEffect(() => {
    setLoadingList(true)
    Promise.all([
      api.get('/admin/drivers?status=ACTIVE'),
      api.get('/admin/shops?status=ACTIVE'),
    ])
      .then(([d, s]) => { setDrivers(d.drivers || []); setShops(s.shops || []) })
      .catch(e => setError(e.message))
      .finally(() => setLoadingList(false))
  }, [])

  const loadPayslip = useCallback(async (id, p, m) => {
    if (!id) return
    setLoading(true); setError(null); setData(null)
    try {
      const endpoint = m === 'vendor'
        ? `/admin/shops/${id}/payslip?period=${p}`
        : `/admin/drivers/${id}/payslip?period=${p}`
      const d = await api.get(endpoint)
      setData(d)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (selected) loadPayslip(selected.id, period, mode)
  }, [selected, period, mode, loadPayslip])

  const switchMode = (m) => {
    setMode(m)
    setSelected(null)
    setData(null)
    setSearch('')
    setError(null)
  }

  const list = mode === 'driver' ? drivers : shops
  const filtered = list.filter(item => {
    const name = mode === 'driver' ? item.user?.name : item.name
    return !search || (name || '').toLowerCase().includes(search.toLowerCase())
  })
  const periodLabel = PERIODS.find(p => p.id === period)?.label || period
  const selectedName = mode === 'driver' ? selected?.user?.name : selected?.name

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-[#0F1923]/40">Administration</p>
          <h1 className="font-playfair text-3xl font-bold text-[#0F1923]">Fiches de paie</h1>
          <p className="font-dm text-sm text-[#0F1923]/50 mt-1">Récapitulatifs de rémunération des livreurs et des vendeurs.</p>
        </div>
        {/* Toggle livreurs / vendeurs */}
        <div className="flex bg-[#F0F2F5] rounded-2xl p-1 gap-1">
          <button onClick={() => switchMode('driver')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne text-sm font-bold transition-all ${
              mode === 'driver' ? 'bg-[#1B4332] text-white shadow-sm' : 'text-[#0F1923]/50 hover:text-[#0F1923]'
            }`}>
            <Truck size={14} /> Livreurs
          </button>
          <button onClick={() => switchMode('vendor')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne text-sm font-bold transition-all ${
              mode === 'vendor' ? 'bg-[#E8A217] text-[#0F1923] shadow-sm' : 'text-[#0F1923]/50 hover:text-[#0F1923]'
            }`}>
            <Store size={14} /> Vendeurs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* ── Colonne gauche : sélecteur ── */}
        <div className="col-span-4 space-y-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={mode === 'driver' ? 'Chercher un livreur…' : 'Chercher une boutique…'}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#F0F2F5] rounded-xl font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                />
              </div>
            </div>

            <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
              {loadingList ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#52B788]/30 border-t-[#52B788] rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center">
                  {mode === 'driver'
                    ? <Truck size={28} className="mx-auto text-gray-200 mb-2" />
                    : <Store size={28} className="mx-auto text-gray-200 mb-2" />
                  }
                  <p className="font-dm text-sm text-gray-400">
                    {mode === 'driver' ? 'Aucun livreur actif' : 'Aucune boutique active'}
                  </p>
                </div>
              ) : (
                filtered.map(item => {
                  const isSelected = selected?.id === item.id
                  const name = mode === 'driver' ? item.user?.name : item.name
                  const sub  = mode === 'driver'
                    ? `${item.totalDeliveries} livraisons`
                    : `${item._count?.orders || 0} commandes`
                  const online = mode === 'driver' ? item.online : item.status === 'ACTIVE'

                  return (
                    <button key={item.id} onClick={() => setSelected(item)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                        isSelected ? 'bg-[#1B4332]/8' : 'hover:bg-gray-50'
                      }`}>
                      <div className={`w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center ${isSelected ? 'ring-2 ring-[#1B4332]' : ''}`}
                        style={{ background: '#0F1923' }}>
                        {(item.avatar || item.logo)
                          ? <img src={item.avatar || item.logo} alt="" className="w-full h-full object-cover" />
                          : mode === 'driver'
                            ? <Truck size={14} className="text-white/40" />
                            : <Store size={14} className="text-white/40" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-syne text-sm font-bold truncate ${isSelected ? 'text-[#1B4332]' : 'text-[#0F1923]'}`}>{name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="font-dm text-[11px] text-[#0F1923]/40">{sub}</span>
                        </div>
                      </div>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#1B4332]" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-3">
              <p className="font-syne text-xs font-bold uppercase tracking-wider text-[#0F1923]/40 flex items-center gap-2">
                <Calendar size={13} /> Période
              </p>
              <div className="space-y-2">
                {PERIODS.map(p => (
                  <button key={p.id} onClick={() => setPeriod(p.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left ${
                      period === p.id
                        ? 'bg-[#1B4332] text-white'
                        : 'bg-[#F0F2F5] text-[#0F1923] hover:bg-[#e8ebe8]'
                    }`}>
                    <span className="font-syne text-sm font-bold">{p.label}</span>
                    <span className={`font-dm text-xs ${period === p.id ? 'text-white/60' : 'text-[#0F1923]/40'}`}>{p.desc}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Colonne droite : fiche de paie ── */}
        <div className="col-span-8">
          {!selected ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#F0F2F5] flex items-center justify-center mb-4">
                <FileText size={28} className="text-gray-300" />
              </div>
              <p className="font-syne font-bold text-[#0F1923]/40 text-lg">
                Sélectionnez {mode === 'driver' ? 'un livreur' : 'une boutique'}
              </p>
              <p className="font-dm text-sm text-[#0F1923]/25 mt-1">La fiche de paie s'affichera ici</p>
            </div>
          ) : (
            <motion.div key={`${mode}-${selected.id}-${period}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
              id="payslip-content">

              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-3">
                  <FileText size={16} className={mode === 'vendor' ? 'text-[#E8A217]' : 'text-[#1B4332]'} />
                  <span className="font-syne font-bold text-[#0F1923]">
                    Fiche {periodLabel.toLowerCase()} — {selectedName}
                  </span>
                </div>
                <button onClick={() => window.print()}
                  className="flex items-center gap-2 bg-[#1B4332] text-white font-syne text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#2D6A4F] transition-colors">
                  <Printer size={14} /> Imprimer / PDF
                </button>
              </div>

              <div className="p-8">
                {loading ? (
                  <div className="flex justify-center py-16 print:hidden">
                    <div className="w-8 h-8 border-2 border-[#1B4332]/20 border-t-[#1B4332] rounded-full animate-spin" />
                  </div>
                ) : error ? (
                  <div className="bg-red-50 rounded-2xl p-4 flex items-center gap-3 print:hidden">
                    <AlertCircle size={16} className="text-red-500" />
                    <p className="font-dm text-sm text-red-600">{error}</p>
                  </div>
                ) : data ? (
                  <>
                    {mode === 'driver'
                      ? <DriverPayslip data={data} periodLabel={periodLabel} />
                      : <VendorPayslip data={data} periodLabel={periodLabel} />
                    }
                    <p className="text-center font-dm text-[10px] text-[#0F1923]/25 mt-6">
                      RizIvoirien — Document généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </>
                ) : null}
              </div>
            </motion.div>
          )}
        </div>
      </div>

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
