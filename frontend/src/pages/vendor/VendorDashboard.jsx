import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Package, Store, FileText, LogOut, ChevronRight, AlertTriangle, Bell, Star, BarChart2, Crown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api/client'
import { motion, AnimatePresence } from 'framer-motion'
import VendorOverviewTab      from './VendorOverviewTab'
import VendorOrdersTab        from './VendorOrdersTab'
import VendorProductsTab      from './VendorProductsTab'
import VendorShopTab          from './VendorShopTab'
import VendorContractTab      from './VendorContractTab'
import VendorReviewsTab       from './VendorReviewsTab'
import VendorAnalyticsTab     from './VendorAnalyticsTab'
import VendorSubscriptionTab  from './VendorSubscriptionTab'

const TABS = [
  { id: 'overview',      label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { id: 'orders',        label: 'Commandes',        icon: ClipboardList,  badge: true },
  { id: 'products',      label: 'Produits',          icon: Package },
  { id: 'analytics',     label: 'Analytiques',       icon: BarChart2 },
  { id: 'reviews',       label: 'Avis clients',      icon: Star },
  { id: 'shop',          label: 'Ma boutique',       icon: Store },
  { id: 'subscription',  label: 'Abonnement',        icon: Crown },
  { id: 'contract',      label: 'Mon contrat',       icon: FileText },
]

export default function VendorDashboard() {
  const [tab, setTab]           = useState('overview')
  const [shopStatus, setShopStatus] = useState(null)
  const [shopPlan, setShopPlan] = useState('BASIC')
  const [restrictions, setRestrictions] = useState({ basicCanAnalytics: true, basicMaxProducts: 0 })
  const [pendingOrders, setPendingOrders] = useState(0)
  const [contractPending, setContractPending] = useState(false)
  const [shopDirty, setShopDirty] = useState(false)
  const { user, logout }        = useAuth()
  const navigate                = useNavigate()

  const handleLogout = () => { logout(); navigate('/auth') }

  const navigateTo = (id) => {
    if (tab === 'shop' && shopDirty && id !== 'shop') {
      if (!window.confirm('Vous avez des modifications non enregistrées. Quitter sans sauvegarder ?')) return
    }
    setTab(id)
  }

  useEffect(() => {
    const onNavigate = (e) => navigateTo(e.detail)
    window.addEventListener('vendor-navigate', onNavigate)
    return () => window.removeEventListener('vendor-navigate', onNavigate)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const [dash, orders] = await Promise.all([
          api.get('/shops/my/dashboard'),
          api.get('/orders/shop/list?status=CONFIRMED&limit=1'),
        ])
        setShopStatus(dash.shop?.status)
        setShopPlan(dash.shop?.plan || 'BASIC')
        setRestrictions({
          basicCanAnalytics: dash.basicCanAnalytics ?? true,
          basicMaxProducts:  dash.basicMaxProducts  ?? 0,
        })
        setPendingOrders(orders.total || 0)

        const contractData = await api.get('/shops/my/contract')
        if (contractData.contract && !contractData.contractSigned) {
          setContractPending(true)
        }
      } catch {}
    }
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [])

  const isActive = shopStatus === 'ACTIVE'

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0F1923] fixed inset-y-0 left-0 flex flex-col z-40 shadow-2xl">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="text-xl">🌾</span>
            <span className="font-playfair text-base font-bold text-white">
              Riz<span className="text-[#E8A217]">Ivoirien</span>
            </span>
          </Link>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-[#E8A217]/15 px-2.5 py-1 rounded-full">
            <Store size={9} className="text-[#E8A217]" />
            <span className="font-syne text-[9px] font-bold tracking-widest uppercase text-[#E8A217]">Espace Vendeur</span>
          </div>
        </div>

        {/* Vendor info */}
        <div className="px-4 py-4 border-b border-white/6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E8A217]/20 flex items-center justify-center shrink-0">
              <span className="font-playfair font-bold text-[#E8A217] text-sm">{user?.name?.[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="font-syne font-bold text-white text-sm truncate">{user?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400' : 'bg-amber-400'}`} />
                <span className="font-dm text-[10px] text-white/35">
                  {shopStatus === 'ACTIVE' ? 'Boutique active' : shopStatus === 'PENDING' ? 'En attente de validation' : 'Boutique suspendue'}
                </span>
              </div>
            </div>
          </div>

          {!isActive && shopStatus && (
            <div className="mt-2 flex items-start gap-1.5 bg-amber-500/10 rounded-lg px-2.5 py-2">
              <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="font-syne text-[10px] text-amber-400 leading-tight">
                {shopStatus === 'PENDING' ? 'Dossier en cours d\'examen' : 'Compte suspendu — contactez le support'}
              </p>
            </div>
          )}

          {contractPending && (
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
            const showBadge = badge && pendingOrders > 0
            const showContractBadge = id === 'contract' && contractPending
            return (
              <button key={id} onClick={() => navigateTo(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  active ? 'bg-[#E8A217]/15 text-[#E8A217]' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                }`}>
                <div className="relative shrink-0">
                  <Icon size={15} />
                  {(showBadge || showContractBadge) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                  )}
                </div>
                <span className="font-syne text-sm font-semibold flex-1">{label}</span>
                {showBadge && (
                  <span className="bg-red-500 text-white font-syne font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                    {pendingOrders > 9 ? '9+' : pendingOrders}
                  </span>
                )}
                {active && !showBadge && <ChevronRight size={12} className="text-[#E8A217]" />}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/6 space-y-0.5">
          <Link to="/" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors">
            <Bell size={14} />
            <span className="font-syne text-sm">Voir la marketplace</span>
          </Link>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/35 hover:text-red-400 hover:bg-red-500/8 transition-colors">
            <LogOut size={14} />
            <span className="font-syne text-sm">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 flex-1 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="p-6">
            {tab === 'overview'      && <VendorOverviewTab shopStatus={shopStatus} />}
            {tab === 'orders'        && <VendorOrdersTab />}
            {tab === 'products'      && <VendorProductsTab />}
            {tab === 'analytics'     && <VendorAnalyticsTab restrictions={restrictions} shopPlan={shopPlan} />}
            {tab === 'reviews'       && <VendorReviewsTab />}
            {tab === 'shop'          && <VendorShopTab onDirtyChange={setShopDirty} />}
            {tab === 'subscription'  && <VendorSubscriptionTab />}
            {tab === 'contract'      && <VendorContractTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
