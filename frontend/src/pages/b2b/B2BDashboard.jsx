import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Package, Search, Users, LogOut, ChevronRight, Menu, X, MessageSquare, DollarSign } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { B2B_ROLE_META } from './roleMeta'
import ProfileTab from './ProfileTab'
import ListingsTab from './ListingsTab'
import MarketplaceTab from './MarketplaceTab'
import MembersTab from './MembersTab'
import ContactsTab from './ContactsTab'
import TransactionsTab from './TransactionsTab'

// LOT 11 (Arbitrage XXX RIZ) : une capacité B2B activée (LOT2 — un BUYER
// devenu aussi TRADER, par exemple) ne change jamais User.role, seulement le
// rôle PRINCIPAL — mais /producer, /cooperative, /trader, /processor,
// /exporter mènent tous vers CE MÊME composant. Utiliser user.role pour
// savoir "avec quelle casquette" afficher ce dashboard cassait systématiquement
// (crash : B2B_ROLE_META[user.role] undefined) pour quiconque y accède via
// une capacité plutôt que son rôle principal. La route elle-même dit déjà
// sans ambiguïté quelle capacité est consultée.
const PATH_TO_ROLE = {
  '/producer': 'PRODUCER', '/cooperative': 'COOPERATIVE', '/trader': 'TRADER',
  '/processor': 'PROCESSOR', '/exporter': 'EXPORTER',
}

export default function B2BDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const effectiveRole = PATH_TO_ROLE[location.pathname] || user.role
  const meta = B2B_ROLE_META[effectiveRole]
  const [tab, setTab] = useState('profile')
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/auth') }
  const selectTab = (id) => { setTab(id); setMenuOpen(false) }

  const TABS = [
    { id: 'profile',     label: 'Mon profil',       icon: User },
    { id: 'listings',    label: `Mes ${meta.kind === 'offer' ? 'offres' : 'demandes'}`, icon: Package },
    { id: 'marketplace', label: 'Rechercher',        icon: Search },
    { id: 'contacts',    label: 'Mes contacts',      icon: MessageSquare },
    { id: 'transactions', label: 'Transactions',     icon: DollarSign },
    ...(effectiveRole === 'COOPERATIVE' ? [{ id: 'members', label: 'Membres', icon: Users }] : []),
  ]

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

      <aside className={`w-60 bg-[#0F1923] fixed inset-y-0 left-0 flex flex-col z-50 shadow-2xl transition-transform duration-300 ${
        menuOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        <div className="px-5 py-5 border-b border-white/6 flex items-start justify-between">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <span className="text-xl">🌾</span>
              <span className="font-playfair text-base font-bold text-white">
                Riz<span className="text-[#E8A217]">Ivoirien</span>
              </span>
            </Link>
            <div className="mt-2 inline-flex items-center gap-1.5 bg-[#E8A217]/15 px-2.5 py-1 rounded-full">
              <meta.icon size={9} className="text-[#E8A217]" />
              <span className="font-syne text-[9px] font-bold tracking-widest uppercase text-[#E8A217]">{meta.label}</span>
            </div>
          </div>
          <button onClick={() => setMenuOpen(false)} className="md:hidden text-white/40 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-4 border-b border-white/6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E8A217]/20 flex items-center justify-center shrink-0">
              <span className="font-playfair font-bold text-[#E8A217] text-sm">{user?.name?.[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="font-syne font-bold text-white text-sm truncate">{user?.name}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button key={id} onClick={() => selectTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  active ? 'bg-[#E8A217]/15 text-[#E8A217]' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                }`}>
                <Icon size={15} className="shrink-0" />
                <span className="font-syne text-sm font-semibold flex-1">{label}</span>
                {active && <ChevronRight size={12} className="text-[#E8A217]" />}
              </button>
            )
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/6">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/35 hover:text-red-400 hover:bg-red-500/8 transition-colors">
            <LogOut size={14} />
            <span className="font-syne text-sm">Déconnexion</span>
          </button>
        </div>
      </aside>

      <main className="md:ml-60 flex-1 min-h-screen">
        {/* LOT 11 : ni mode="wait" ni exit — même bug déjà rencontré et
            corrigé ailleurs (DriverDashboard.jsx LOT3, AdminDashboard.jsx
            LOT9, AccountPage.jsx LOT11) : ici constaté en direct pendant la
            vérification de ce lot (le clic change bien l'onglet actif dans
            la barre latérale, mais le contenu précédent reste affiché). */}
        <AnimatePresence>
          <motion.div key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="p-6 pt-20 md:pt-6">
            {tab === 'profile' && <ProfileTab effectiveRole={effectiveRole} />}
            {tab === 'listings' && <ListingsTab effectiveRole={effectiveRole} />}
            {tab === 'marketplace' && <MarketplaceTab />}
            {tab === 'contacts' && <ContactsTab />}
            {tab === 'transactions' && <TransactionsTab />}
            {tab === 'members' && effectiveRole === 'COOPERATIVE' && <MembersTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
