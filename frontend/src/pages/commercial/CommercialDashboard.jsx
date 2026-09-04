import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, FileText, RefreshCw, Tag, LogOut, ShoppingBag, Menu, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../api/client'
import CommandesTab from './CommandesTab'
import PipelineTab from './PipelineTab'
import DemandesTab from './DemandesTab'
import ContratsTab from './ContratsTab'
import RenouvellementTab from './RenouvellementTab'
import InviteCodesTab from './InviteCodesTab'

const ACCENT = '#4F46E5' // indigo

const TABS = [
  { id: 'commandes',       label: 'Commandes',          icon: ShoppingBag, badge: 'pendingValidation' },
  { id: 'pipeline',        label: 'Pipeline',           icon: LayoutDashboard },
  { id: 'demandes',        label: 'Demandes plan',      icon: TrendingUp,  badge: 'pendingUpgrades' },
  { id: 'contrats',        label: 'Contrats',           icon: FileText,    badge: 'pendingContracts' },
  { id: 'renouvellements', label: 'Renouvellements',    icon: RefreshCw,   badge: 'expiringSubs' },
  { id: 'invitations',     label: 'Codes invitation',   icon: Tag },
]

const KPI_CARDS = [
  { key: 'pendingValidation',   label: 'À valider',           color: 'bg-blue-500',   icon: '📞' },
  { key: 'pendingApplications', label: 'Candidatures',        color: 'bg-amber-500',  icon: '🏪' },
  { key: 'pendingContracts',    label: 'Contrats à signer',   color: 'bg-indigo-500', icon: '📄' },
  { key: 'pendingUpgrades',     label: 'Demandes plan',       color: 'bg-purple-500', icon: '📈' },
  { key: 'expiringSubs',        label: 'Renouvellements <30j', color: 'bg-red-500',   icon: '🔔' },
]

export default function CommercialDashboard() {
  const [tab, setTab] = useState('commandes')
  const [kpis, setKpis] = useState({ pendingValidation: 0, pendingApplications: 0, pendingContracts: 0, pendingUpgrades: 0, expiringSubs: 0 })
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/auth') }
  const selectTab = (id) => { setTab(id); setMenuOpen(false) }

  const loadKpis = async () => {
    try {
      const data = await api.get('/commercial/kpis')
      setKpis(data)
    } catch {}
  }

  useEffect(() => {
    loadKpis()
    const iv = setInterval(loadKpis, 30000)
    return () => clearInterval(iv)
  }, [])

  const refreshKpis = () => loadKpis()

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
                Riz<span className="text-safran">Ivoirien</span>
              </span>
            </Link>
            <div className="mt-2.5 inline-flex items-center gap-1.5 bg-indigo-500/15 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="font-syne text-[10px] font-bold tracking-widest uppercase text-indigo-300">Commercial</span>
            </div>
          </div>
          <button onClick={() => setMenuOpen(false)} className="md:hidden text-white/40 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* User */}
        <div className="px-5 py-4 border-b border-white/6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
              <span className="font-playfair font-bold text-indigo-400 text-sm">{user?.name?.[0]}</span>
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
            const count = badge ? (kpis[badge] ?? 0) : 0
            const active = tab === id
            return (
              <button key={id} onClick={() => selectTab(id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all relative ${
                  active ? 'bg-indigo-900/50 text-indigo-300' : 'text-white/45 hover:bg-white/5 hover:text-white/80'
                }`}>
                {active && <span className="absolute left-0 w-0.5 h-8 bg-indigo-400 rounded-r-full" />}
                <Icon size={16} className={active ? 'text-indigo-400' : ''} />
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

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/6 space-y-0.5">
          <Link to="/" className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors">
            <ShoppingBag size={16} />
            <span className="font-syne text-sm">Marketplace</span>
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
        {/* KPI bar */}
        <div className="px-4 md:px-8 pt-20 md:pt-8 pb-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {KPI_CARDS.map(({ key, label, color, icon }) => (
            <div key={key} className="bg-white rounded-2xl px-5 py-4 shadow-sm flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center text-xl shrink-0`}>
                {icon}
              </div>
              <div>
                <p className="font-dm text-xs text-charcoal/50">{label}</p>
                <p className="font-syne text-2xl font-bold text-charcoal">{kpis[key] ?? 0}</p>
              </div>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="p-4 md:p-8">
            {tab === 'commandes'       && <CommandesTab onRefreshKpis={refreshKpis} />}
            {tab === 'pipeline'        && <PipelineTab onRefreshKpis={refreshKpis} />}
            {tab === 'demandes'        && <DemandesTab onRefreshKpis={refreshKpis} />}
            {tab === 'contrats'        && <ContratsTab onRefreshKpis={refreshKpis} />}
            {tab === 'renouvellements' && <RenouvellementTab />}
            {tab === 'invitations'     && <InviteCodesTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
