import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, LogOut, ChevronRight, Menu, X, AlertCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api/client'
import { PERMISSION_GROUPS } from '../admin/accountingPermissions'

// LOT 1 : uniquement la preuve que le rôle + les permissions fonctionnent de
// bout en bout (accès à l'espace, permissions réellement affichées). Le vrai
// contenu (transactions, paiements, trésorerie, paie...) arrive aux lots
// suivants — cette page est le squelette qui les accueillera.
export default function AccountingDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [access, setAccess] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const handleLogout = () => { logout(); navigate('/auth') }

  useEffect(() => {
    api.get('/accounting/me')
      .then(setAccess)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const TABS = [{ id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard }]

  const allLabels = PERMISSION_GROUPS.flatMap(g => g.permissions)
  const labelFor = (key) => allLabels.find(p => p.key === key)?.label || key

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex">
      <button onClick={() => setMenuOpen(true)}
        className="md:hidden fixed top-4 left-4 z-30 w-10 h-10 bg-[#0F1923] rounded-xl flex items-center justify-center shadow-lg">
        <Menu size={18} className="text-white" />
      </button>

      {menuOpen && <div onClick={() => setMenuOpen(false)} className="md:hidden fixed inset-0 bg-black/40 z-40" />}

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
              <ShieldCheck size={9} className="text-[#E8A217]" />
              <span className="font-syne text-[9px] font-bold tracking-widest uppercase text-[#E8A217]">
                {user.role === 'ADMIN' ? 'Comptabilité (Admin)' : 'Responsable Comptable'}
              </span>
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
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setMenuOpen(false)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all bg-[#E8A217]/15 text-[#E8A217]">
              <Icon size={15} className="shrink-0" />
              <span className="font-syne text-sm font-semibold flex-1">{label}</span>
              <ChevronRight size={12} className="text-[#E8A217]" />
            </button>
          ))}
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
        <AnimatePresence mode="wait">
          <motion.div key="overview"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }} className="p-6 pt-20 md:pt-6 max-w-2xl">
            <h1 className="font-playfair text-2xl font-bold text-charcoal mb-1">Espace Comptabilité</h1>
            <p className="font-dm text-sm text-charcoal/50 mb-6">
              Bienvenue, {user?.name}. Le tableau de bord, les transactions, la trésorerie et la paie
              arrivent dans les prochains lots — ceci confirme que votre accès est correctement configuré.
            </p>

            {loading ? (
              <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
            ) : error ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <p className="font-dm text-sm text-red-600">{error}</p>
              </div>
            ) : (
              <div className="bg-white border border-charcoal/10 rounded-2xl p-5">
                <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-3">
                  Permissions accordées ({access.permissions.length})
                </p>
                {access.permissions.length === 0 ? (
                  <p className="font-dm text-sm text-charcoal/40">
                    Aucune permission ne vous a encore été attribuée. Contactez un administrateur.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {access.permissions.map(p => (
                      <li key={p} className="font-dm text-sm text-charcoal flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-forest shrink-0" /> {labelFor(p)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
