import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Store, Truck, Image, CreditCard, BarChart2, Settings, LogOut, Tag, Users, DollarSign, Bell, Printer, FileText, Percent, AlertTriangle, ScrollText, Briefcase, Menu, X, Sprout, Calculator, Route, LifeBuoy } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../api/client'
import AnalyticsTab from './AnalyticsTab'
import OrdersAdminTab from './OrdersAdminTab'
import ShopsAdminTab from './ShopsAdminTab'
import DriversAdminTab from './DriversAdminTab'
import CarouselTab from './CarouselTab'
import SubscriptionsTab from './SubscriptionsTab'
import GlobalAnalyticsTab from './GlobalAnalyticsTab'
import PlatformSettingsTab from './PlatformSettingsTab'
import PromoCodesTab from './PromoCodesTab'
import UsersTab from './UsersTab'
import FinanceTab from './FinanceTab'
import PayslipsAdminTab from './PayslipsAdminTab'
import ContractsAdminTab from './ContractsAdminTab'
import DisputesAdminTab from './DisputesAdminTab'
import AuditLogTab from './AuditLogTab'
import CommercialSettingsTab from './CommercialSettingsTab'
import B2BAdminTab from './B2BAdminTab'
import AccountingRoleTab from './AccountingRoleTab'
import LogisticsAdminTab from './LogisticsAdminTab'
import ApprovalRulesTab from './ApprovalRulesTab'
import SupportAdminTab from './SupportAdminTab'

const TABS = [
  { id: 'analytics', label: 'Vue d\'ensemble',        icon: LayoutDashboard },
  { id: 'orders',    label: 'Commandes',                icon: ClipboardList },
  { id: 'shops',     label: 'Boutiques',                icon: Store,    badge: 'shopsPending' },
  { id: 'drivers',   label: 'Livreurs',                 icon: Truck,    badge: 'driversPending' },
  { id: 'payslips',  label: 'Fiches de paie',           icon: Printer },
  { id: 'contracts', label: 'Contrats',                 icon: FileText },
  { id: 'users',     label: 'Utilisateurs',             icon: Users },
  { id: 'finance',   label: 'Finance',                  icon: DollarSign },
  { id: 'disputes',  label: 'Litiges',                  icon: AlertTriangle, badge: 'disputesPending' },
  { id: 'promos',    label: 'Codes promo',              icon: Tag },
  { id: 'carousel',  label: 'Carousel',                 icon: Image },
  { id: 'subs',      label: 'Abonnements',              icon: CreditCard, badge: 'planRequestsPending' },
  { id: 'global',    label: 'Analytique globale',       icon: BarChart2 },
  { id: 'settings',  label: 'Politique commerciale',    icon: Percent },
  { id: 'audit',      label: 'Journal d\'audit',         icon: ScrollText },
  { id: 'commercial', label: 'Espace Commercial',        icon: Briefcase },
  { id: 'b2b',        label: 'Filière B2B',               icon: Sprout, badge: 'b2bPending' },
  { id: 'accounting-role', label: 'Rôle Comptable',        icon: Calculator },
  { id: 'logistics',  label: 'Logistique',                icon: Route },
  { id: 'approval',   label: 'Modération produits',       icon: ClipboardList, badge: 'moderationPending' },
  { id: 'support',    label: 'Support',                    icon: LifeBuoy, badge: 'supportPending' },
]

export default function AdminDashboard() {
  const [tab, setTab] = useState('analytics')
  const [pending, setPending] = useState({ shopsPending: 0, driversPending: 0, disputesPending: 0, planRequestsPending: 0, b2bPending: 0, moderationPending: 0, supportPending: 0 })
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/auth') }
  const selectTab = (id) => { setTab(id); setMenuOpen(false) }

  const onShopsBadge   = useCallback(n => setPending(p => ({ ...p, shopsPending:   n })), [])
  const onDriversBadge = useCallback(n => setPending(p => ({ ...p, driversPending: n })), [])
  const onSupportBadge = useCallback(n => setPending(p => ({ ...p, supportPending: n })), [])

  // Polling des badges pending toutes les 30s
  useEffect(() => {
    const load = async () => {
      try {
        const [shops, drivers, disputes, planReqs, b2bStats, moderation, supportTickets] = await Promise.all([
          api.get('/admin/shops?status=PENDING'),
          api.get('/admin/drivers?status=PENDING'),
          api.get('/disputes?status=OPEN'),
          api.get('/admin/plan-requests?status=PENDING').catch(() => ({ requests: [] })),
          api.get('/admin/b2b/stats').catch(() => null),
          api.get('/admin/moderation/queue').catch(() => ({ products: [], offers: [] })),
          api.get('/admin/support/tickets').catch(() => []),
        ])
        setPending({
          shopsPending:         shops.shops?.length || 0,
          driversPending:       drivers.drivers?.length || 0,
          disputesPending:      disputes.disputes?.length || 0,
          planRequestsPending:  (planReqs.requests ?? []).length,
          b2bPending:           (b2bStats?.pendingVerifications || 0) + (b2bStats?.reportsPending || 0),
          moderationPending:    (moderation.products?.length || 0) + (moderation.offers?.length || 0),
          supportPending:       supportTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
        })
      } catch {}
    }
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex">
      {/* Bouton menu mobile */}
      <button onClick={() => setMenuOpen(true)}
        className="md:hidden fixed top-4 left-4 z-30 w-10 h-10 bg-[#0F1923] rounded-xl flex items-center justify-center shadow-lg">
        <Menu size={18} className="text-white" />
      </button>

      {/* Overlay mobile */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} className="md:hidden fixed inset-0 bg-black/40 z-40" />
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-[#0F1923] fixed inset-y-0 left-0 flex flex-col z-50 shadow-2xl transition-transform duration-300 ${
        menuOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/6 flex items-start justify-between">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <span className="text-2xl">🌾</span>
              <span className="font-playfair text-lg font-bold text-white">
                Riz<span className="text-[#E8A217]">Ivoirien</span>
              </span>
            </Link>
            <div className="mt-2.5 inline-flex items-center gap-1.5 bg-[#E8A217]/15 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E8A217] animate-pulse" />
              <span className="font-syne text-[10px] font-bold tracking-widest uppercase text-[#E8A217]">Administration</span>
            </div>
          </div>
          <button onClick={() => setMenuOpen(false)} className="md:hidden text-white/40 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* User */}
        <div className="px-5 py-4 border-b border-white/6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E8A217]/20 flex items-center justify-center shrink-0">
              <span className="font-playfair font-bold text-[#E8A217] text-sm">{user?.name?.[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="font-syne font-bold text-white text-sm truncate">{user?.name}</p>
              <p className="font-dm text-[11px] text-white/35 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {TABS.map(({ id, label, icon: Icon, badge }) => {
            const count = badge ? pending[badge] : 0
            const active = tab === id
            return (
              <button key={id} onClick={() => selectTab(id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all group ${
                  active ? 'bg-[#1B4332] text-[#52B788]' : 'text-white/45 hover:bg-white/5 hover:text-white/80'
                }`}>
                {active && <span className="absolute left-0 w-0.5 h-8 bg-[#52B788] rounded-r-full" />}
                <Icon size={16} className={active ? 'text-[#52B788]' : ''} />
                <span className="font-syne text-sm font-semibold flex-1 text-left">{label}</span>
                {count > 0 && (
                  <span className="bg-red-500 text-white font-syne font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer sidebar */}
        <div className="px-3 py-3 border-t border-white/6 space-y-0.5">
          <Link to="/" className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors">
            <Bell size={16} />
            <span className="font-syne text-sm">Voir la marketplace</span>
          </Link>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/35 hover:text-red-400 hover:bg-red-500/8 transition-colors">
            <LogOut size={16} />
            <span className="font-syne text-sm">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="md:ml-64 flex-1 min-h-screen">
        {/* Pas de mode="wait" ni de prop exit : sur cette page, une animation
            de sortie qui ne se résout jamais (onglet en arrière-plan, RAF non
            garanti dans certains environnements) bloquait DÉFINITIVEMENT le
            changement d'onglet — le clic changeait bien l'état React (tab),
            mais l'ancien contenu restait affiché indéfiniment. Même bug déjà
            rencontré et corrigé sur DriverDashboard.jsx (LOT3, Arbitrage XXX
            RIZ) — mêmes causes, même correctif. D'autres pages du projet
            partagent encore ce même risque latent (hors périmètre ici). */}
        <AnimatePresence>
          <motion.div key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="p-8 pt-20 md:pt-8">
            {tab === 'analytics' && <AnalyticsTab />}
            {tab === 'orders'    && <OrdersAdminTab />}
            {tab === 'shops'     && <ShopsAdminTab onBadgeUpdate={onShopsBadge} />}
            {tab === 'drivers'   && <DriversAdminTab onBadgeUpdate={onDriversBadge} />}
            {tab === 'payslips'  && <PayslipsAdminTab />}
            {tab === 'contracts' && <ContractsAdminTab />}
            {tab === 'approval'  && <ApprovalRulesTab />}
            {tab === 'disputes'  && <DisputesAdminTab />}
            {tab === 'audit'     && <AuditLogTab />}
            {tab === 'users'     && <UsersTab />}
            {tab === 'finance'   && <FinanceTab />}
            {tab === 'promos'    && <PromoCodesTab />}
            {tab === 'carousel'  && <CarouselTab />}
            {tab === 'subs'      && <SubscriptionsTab />}
            {tab === 'global'    && <GlobalAnalyticsTab />}
            {tab === 'settings'   && <PlatformSettingsTab />}
            {tab === 'commercial' && <CommercialSettingsTab />}
            {tab === 'b2b'        && <B2BAdminTab />}
            {tab === 'accounting-role' && <AccountingRoleTab />}
            {tab === 'logistics'  && <LogisticsAdminTab />}
            {tab === 'support'    && <SupportAdminTab onBadgeUpdate={onSupportBadge} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
