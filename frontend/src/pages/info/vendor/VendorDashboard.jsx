import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ClipboardList, Settings,
  LogOut, Store, Star, Bell, ChevronRight, ExternalLink,
  AlertTriangle, Clock, FileText, CheckSquare, Square
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api/client'
import { motion, AnimatePresence } from 'framer-motion'
import OverviewTab from './OverviewTab'
import ProductsTab from './ProductsTab'
import OrdersTab from './OrdersTab'
import ShopSettingsTab from './ShopSettingsTab'

const TABS = [
  { id: 'overview',  label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { id: 'products',  label: 'Mes produits',    icon: Package },
  { id: 'orders',    label: 'Commandes',        icon: ClipboardList, badge: true },
  { id: 'settings',  label: 'Ma boutique',      icon: Settings },
]

const SHOP_STATUS = {
  PENDING:   { label: 'En attente de validation', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/15' },
  SUSPENDED: { label: 'Boutique suspendue',        icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-500/15' },
  REJECTED:  { label: 'Boutique rejetée',          icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/15' },
}

// ─── Contract Modal ────────────────────────────────────────────────────────────
function ContractModal({ contract, onSigned }) {
  const [accepted, setAccepted] = useState(false)
  const [signing, setSigning]   = useState(false)
  const [error, setError]       = useState(null)

  const sign = async () => {
    if (!accepted) return
    setSigning(true); setError(null)
    try {
      await api.put('/shops/my/contract/sign', {})
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
        <div className="bg-[#1B4332] px-8 py-5 flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-playfair text-xl font-bold text-white">Contrat de partenariat vendeur</h2>
            <p className="font-syne text-xs text-white/50 mt-0.5">Veuillez lire et signer votre contrat pour accéder au tableau de bord</p>
          </div>
        </div>

        {/* Contract content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: contract.content }}
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
            <button type="button" onClick={() => setAccepted(v => !v)} className="mt-0.5 shrink-0 text-[#1B4332]">
              {accepted ? <CheckSquare size={20} /> : <Square size={20} className="text-gray-400" />}
            </button>
            <span className="font-dm text-sm text-gray-700 leading-relaxed">
              J'ai lu et j'accepte l'intégralité du contrat de partenariat vendeur RizIvoirien, et je m'engage à respecter les conditions qui y sont définies.
            </span>
          </label>
          <button
            onClick={sign}
            disabled={!accepted || signing}
            className="w-full py-3.5 rounded-2xl bg-[#1B4332] text-white font-syne font-bold text-sm hover:bg-[#2D6A4F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

export default function VendorDashboard() {
  const [tab, setTab] = useState('overview')
  const [pendingOrders, setPendingOrders] = useState(0)
  const [shop, setShop] = useState(null)
  const [contract, setContract] = useState(null)
  const [contractSigned, setContractSigned] = useState(true)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/auth') }

  useEffect(() => {
    // Poll pending orders count
    const poll = async () => {
      try {
        const data = await api.get('/shops/my/dashboard')
        if (data.kpis) setPendingOrders(data.kpis.pendingOrders || 0)
        if (data.shop) setShop(data.shop)
      } catch {}
    }
    poll()
    const iv = setInterval(poll, 30000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    // Check contract status
    const checkContract = async () => {
      try {
        const data = await api.get('/shops/my/contract')
        if (data.contract && data.contract.status === 'PENDING_SIGNATURE') {
          setContract(data.contract)
          setContractSigned(false)
        } else {
          setContractSigned(true)
          setContract(null)
        }
      } catch {
        // No contract yet or error — don't block
        setContractSigned(true)
      }
    }
    checkContract()
  }, [])

  const handleContractSigned = () => {
    setContractSigned(true)
    setContract(null)
  }

  const shopStatus = shop?.status
  const statusInfo = SHOP_STATUS[shopStatus]

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex">
      {/* Contract modal overlay — blocks dashboard until signed */}
      {!contractSigned && contract && (
        <ContractModal contract={contract} onSigned={handleContractSigned} />
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-[#1B4332] fixed inset-y-0 left-0 flex flex-col z-40 shadow-2xl">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="text-2xl">🌾</span>
            <span className="font-playfair text-lg font-bold text-white">
              Riz<span className="text-[#E8A217]">Ivoirien</span>
            </span>
          </Link>
          <div className="mt-2.5 inline-flex items-center gap-1.5 bg-white/8 px-2.5 py-1 rounded-full">
            <Store size={10} className="text-[#52B788]" />
            <span className="font-syne text-[10px] font-bold tracking-widest uppercase text-[#52B788]">Espace Vendeur</span>
          </div>
        </div>

        {/* Shop info */}
        <div className="px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
              {shop?.avatar
                ? <img src={shop.avatar} alt="" className="w-full h-full object-cover" />
                : <Store size={16} className="text-white/40" />
              }
            </div>
            <div className="min-w-0">
              <p className="font-syne font-bold text-white text-sm truncate">{shop?.name || user?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {shop?.certified
                  ? <span className="font-syne text-[10px] font-bold text-[#E8A217] flex items-center gap-1">
                      <Star size={8} fill="currentColor" /> Certifiée
                    </span>
                  : <span className="font-syne text-[10px] text-white/35">Plan Basic</span>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Status banner if not ACTIVE */}
        {statusInfo && (
          <div className={`mx-3 mt-3 rounded-xl px-3 py-2.5 ${statusInfo.bg} flex items-start gap-2`}>
            <statusInfo.icon size={13} className={`${statusInfo.color} mt-0.5 shrink-0`} />
            <p className={`font-syne text-[11px] font-bold leading-tight ${statusInfo.color}`}>{statusInfo.label}</p>
          </div>
        )}

        {/* Contract pending banner */}
        {!contractSigned && contract && (
          <div className="mx-3 mt-3 rounded-xl px-3 py-2.5 bg-amber-500/15 flex items-start gap-2">
            <FileText size={13} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="font-syne text-[11px] font-bold leading-tight text-amber-400">Contrat en attente de signature</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {TABS.map(({ id, label, icon: Icon, badge }) => {
            const active = tab === id
            const count = badge ? pendingOrders : 0
            return (
              <button key={id} onClick={() => setTab(id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all ${
                  active ? 'bg-white/12 text-white' : 'text-white/45 hover:bg-white/6 hover:text-white/75'
                }`}>
                <div className="relative shrink-0">
                  <Icon size={16} className={active ? 'text-[#52B788]' : ''} />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </div>
                <span className="font-syne text-sm font-semibold flex-1 text-left">{label}</span>
                {active && <ChevronRight size={13} className="text-[#52B788]" />}
              </button>
            )
          })}
        </nav>

        {/* Footer sidebar */}
        <div className="px-3 py-3 border-t border-white/8 space-y-0.5">
          <Link
            to={shop?.id ? `/shop/${shop.id}` : '/shop'}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/35 hover:text-white/70 hover:bg-white/6 transition-colors"
          >
            <ExternalLink size={15} />
            <span className="font-syne text-sm">Voir la boutique</span>
          </Link>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/35 hover:text-red-400 hover:bg-red-500/8 transition-colors">
            <LogOut size={15} />
            <span className="font-syne text-sm">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 flex-1 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="p-8">
            {tab === 'overview'  && <OverviewTab />}
            {tab === 'products'  && <ProductsTab />}
            {tab === 'orders'    && <OrdersTab />}
            {tab === 'settings'  && <ShopSettingsTab onShopUpdated={s => setShop(s)} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
