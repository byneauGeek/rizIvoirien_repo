import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, Menu, X, Search, Bell, User, ChevronDown, Package, LogOut, Settings, Heart, MailWarning, Star, Truck, AlertTriangle, Crown, FileText, MessageCircle } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../api/client'
import FlashSaleBanner from '../home/FlashSaleBanner'

const NAV_LINKS = [
  { label: 'Accueil', href: '/' },
  { label: 'Boutiques', href: '/shop' },
  { label: 'Produits', href: '/shop' },
]

const ROLE_DASHBOARD = { SELLER: '/vendor', DRIVER: '/driver', ADMIN: '/admin', COMMERCIAL: '/commercial' }

// LOT AUDIT-G6 (audit XXX RIZ) : la cloche était 100% générique (même <div>
// pour ~20 types distincts, aucune icône ni navigation) — gap confirmé par
// grep exhaustif de tous les appels notify() du backend. `path` reçoit le
// user courant pour cibler le bon tableau de bord selon son rôle ; les types
// B2B_* renvoient vers /account (onglet "Capacités B2B", LOT B2B-2) plutôt
// qu'une route de profil spécifique (producer/cooperative/trader/...), le
// type de notification ne permettant pas de savoir laquelle sans requête
// supplémentaire.
const NOTIF_META = {
  NEW_ORDER:                 { icon: Package,       path: (u) => ROLE_DASHBOARD[u.role] || '/' },
  ORDER_VALIDATED:           { icon: Package,       path: () => '/orders' },
  ORDER_CANCELLED:           { icon: Package,       path: () => '/orders' },
  ORDER_PENDING_VALIDATION:  { icon: Package,       path: () => '/orders' },
  DELIVERED:                 { icon: Truck,         path: () => '/orders' },
  LOW_STOCK:                 { icon: AlertTriangle, path: (u) => ROLE_DASHBOARD[u.role] || '/' },
  NEW_DISPUTE:               { icon: AlertTriangle, path: () => '/admin' },
  DISPUTE_UPDATE:            { icon: AlertTriangle, path: () => '/orders' },
  MANUAL_ASSIGNMENT:         { icon: Truck,         path: () => '/driver' },
  PLAN_UPGRADE_REQUEST:      { icon: Crown,         path: () => '/admin' },
  PLAN_UPGRADE_APPROVED:     { icon: Crown,         path: (u) => ROLE_DASHBOARD[u.role] || '/' },
  PLAN_UPGRADE_REJECTED:     { icon: Crown,         path: (u) => ROLE_DASHBOARD[u.role] || '/' },
  NEW_REVIEW:                { icon: Star,          path: () => '/vendor' },
  DELIVERY_CONFIRMED:        { icon: Truck,         path: () => '/driver' },
  ORDER_VALIDATION_EXPIRING: { icon: AlertTriangle, path: (u) => ROLE_DASHBOARD[u.role] || '/' },
  PRODUCT_PENDING_REVIEW:    { icon: Package,       path: () => '/admin' },
  PRODUCT_APPROVED:          { icon: Package,       path: () => '/vendor' },
  PRODUCT_REJECTED:          { icon: Package,       path: () => '/vendor' },
  OFFER_PENDING_REVIEW:      { icon: FileText,      path: () => '/admin' },
  OFFER_APPROVED:            { icon: FileText,      path: () => '/account' },
  OFFER_REJECTED:            { icon: FileText,      path: () => '/account' },
}
const notifMetaFor = (type) => {
  if (NOTIF_META[type]) return NOTIF_META[type]
  if (type?.startsWith('SHOP_'))   return { icon: Package,  path: () => '/vendor' }
  if (type?.startsWith('DRIVER_')) return { icon: Truck,    path: () => '/driver' }
  if (type?.startsWith('B2B_'))    return { icon: FileText, path: () => '/account' }
  return { icon: Bell, path: () => null }
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState({ notifications: [], unread: 0 })
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [emailUnverified, setEmailUnverified] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const { count } = useCart()
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const searchRef = useRef(null)
  const accountRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Fermer les dropdowns en cliquant ailleurs
  useEffect(() => {
    const handler = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Charger les notifications si connecté
  useEffect(() => {
    if (!user) return
    const load = () => api.get('/notifications').then(setNotifs).catch(() => {})
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Compteur de messages non lus (badge, cohérent avec la cloche ci-dessus)
  useEffect(() => {
    if (!user) return
    const load = () => api.get('/conversations')
      .then((list) => setUnreadMessages(list.reduce((sum, c) => sum + c.unreadCount, 0)))
      .catch(() => {})
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Vérification email
  useEffect(() => {
    setEmailUnverified(!!localStorage.getItem('rz_email_unverified'))
  }, [user])

  const resendVerification = async () => {
    setResending(true)
    try {
      await api.post('/auth/resend-verification', {})
      setResendSent(true)
      setTimeout(() => setResendSent(false), 4000)
    } catch {}
    finally { setResending(false) }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQ.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQ.trim())}`)
      setSearchOpen(false)
      setSearchQ('')
    }
  }

  const handleLogout = () => { logout(); navigate('/'); setAccountOpen(false) }

  const isHome = pathname === '/'
  const dark = scrolled || !isHome
  const textColor = dark ? 'text-charcoal' : 'text-cream/90'
  const hoverBg = dark ? 'hover:bg-forest/8' : 'hover:bg-white/10'

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${dark ? 'bg-cream/95 backdrop-blur-md shadow-[0_1px_0_rgba(27,67,50,0.08)]' : 'bg-transparent'}`}>
        {!user && !scrolled && <FlashSaleBanner discount={15} code="FLASH15" hours={6} />}
        {user && emailUnverified && (
          <div className="bg-amber-500 px-4 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white">
              <MailWarning size={15} className="shrink-0" />
              <span className="font-dm text-sm">Vérifiez votre adresse email pour activer toutes les fonctionnalités.</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={resendVerification} disabled={resending || resendSent}
                className="font-syne text-xs font-bold text-white underline underline-offset-2 disabled:opacity-60">
                {resending ? 'Envoi…' : resendSent ? 'Envoyé ✓' : 'Renvoyer'}
              </button>
              <button onClick={() => { localStorage.removeItem('rz_email_unverified'); setEmailUnverified(false) }}
                className="text-white/70 hover:text-white">
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="text-2xl leading-none">🌾</span>
            <span className={`font-playfair text-xl font-bold tracking-tight transition-colors duration-300 ${dark ? 'text-charcoal' : 'text-cream'}`}>
              Riz<span className="text-safran">Ivoirien</span>
            </span>
          </Link>

          {/* Desktop links */}
          <ul className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={label}>
                <Link to={href} className={`font-syne text-sm font-medium transition-colors duration-200 hover:text-safran ${textColor}`}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Search bar (desktop) */}
          <AnimatePresence>
            {searchOpen && (
              <motion.form
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSearch}
                className="hidden md:flex items-center overflow-hidden"
              >
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Rechercher un produit..."
                  autoFocus
                  className="w-full bg-white border-2 border-forest/20 rounded-full px-4 py-2 font-dm text-sm text-charcoal placeholder-charcoal/40 focus:outline-none focus:border-forest"
                />
              </motion.form>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* Search toggle */}
            <button onClick={() => { setSearchOpen(v => !v); setTimeout(() => searchRef.current?.focus(), 50) }}
              className={`hidden md:flex p-2 rounded-full transition-colors ${hoverBg} ${textColor}`}>
              <Search size={18} />
            </button>

            {/* Cart */}
            <Link to="/cart" className={`relative p-2 rounded-full transition-colors ${hoverBg} ${textColor}`}>
              <ShoppingBag size={18} />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-safran text-charcoal rounded-full text-[10px] font-syne font-bold flex items-center justify-center">
                  {count}
                </span>
              )}
            </Link>

            {user ? (
              <>
                {/* Messages */}
                <Link to="/messages" className={`relative p-2 rounded-full transition-colors ${hoverBg} ${textColor}`}>
                  <MessageCircle size={18} />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-terra text-cream rounded-full text-[10px] font-bold flex items-center justify-center">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  )}
                </Link>

                {/* Notifications bell */}
                <div className="relative">
                  <button onClick={() => setNotifOpen(v => !v)}
                    className={`relative p-2 rounded-full transition-colors ${hoverBg} ${textColor}`}>
                    <Bell size={18} />
                    {notifs.unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-terra text-cream rounded-full text-[10px] font-bold flex items-center justify-center">
                        {notifs.unread > 9 ? '9+' : notifs.unread}
                      </span>
                    )}
                  </button>
                  <AnimatePresence>
                    {notifOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-charcoal/6 overflow-hidden z-50"
                      >
                        <div className="px-4 py-3 border-b border-charcoal/6 flex items-center justify-between">
                          <span className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">Notifications</span>
                          {notifs.unread > 0 && (
                            <button onClick={() => { api.put('/notifications/read-all'); setNotifs(n => ({...n, unread: 0, notifications: n.notifications.map(x => ({...x, read: true}))})) }}
                              className="font-dm text-xs text-forest hover:underline">Tout lire</button>
                          )}
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                          {notifs.notifications.length === 0
                            ? <p className="font-dm text-sm text-charcoal/40 text-center py-8">Aucune notification</p>
                            : notifs.notifications.slice(0, 10).map(n => {
                              const { icon: Icon, path } = notifMetaFor(n.type)
                              const target = path(user)
                              return (
                                <button key={n.id} onClick={() => {
                                  setNotifOpen(false)
                                  if (!n.read) {
                                    api.put(`/notifications/${n.id}/read`).catch(() => {})
                                    setNotifs(prev => ({
                                      unread: Math.max(0, prev.unread - 1),
                                      notifications: prev.notifications.map(x => x.id === n.id ? { ...x, read: true } : x),
                                    }))
                                  }
                                  if (target) navigate(target)
                                }}
                                  className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-charcoal/4 hover:bg-charcoal/3 transition-colors ${!n.read ? 'bg-forest/4' : ''}`}>
                                  <Icon size={15} className="text-forest shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <p className="font-syne text-xs font-bold text-charcoal">{n.title}</p>
                                    <p className="font-dm text-xs text-charcoal/60 mt-0.5">{n.message}</p>
                                  </div>
                                </button>
                              )
                            })
                          }
                        </div>
                        <div className="px-4 py-2 text-center">
                          <button onClick={() => setNotifOpen(false)} className="font-dm text-xs text-charcoal/40 hover:text-charcoal">Fermer</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Account dropdown */}
                <div ref={accountRef} className="relative">
                  <button onClick={() => setAccountOpen(v => !v)}
                    className={`hidden md:flex items-center gap-2 font-syne text-sm font-semibold px-3 py-2 rounded-full transition-all ${hoverBg} ${textColor}`}>
                    <div className="w-6 h-6 rounded-full bg-safran/20 flex items-center justify-center">
                      <span className="font-bold text-safran text-xs">{user.name?.[0]}</span>
                    </div>
                    <span className="max-w-[80px] truncate">{user.name?.split(' ')[0]}</span>
                    <ChevronDown size={13} />
                  </button>
                  <AnimatePresence>
                    {accountOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-charcoal/6 overflow-hidden z-50"
                      >
                        {/* LOT B2B-2 : "Mon compte" (→ Capacités B2B incluses) ouvert à tout
                            rôle — seuls "Mes commandes"/"Ma wishlist" restent propres au BUYER. */}
                        <Link to="/account" onClick={() => setAccountOpen(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-charcoal/4 transition-colors">
                          <User size={15} className="text-charcoal/40" />
                          <span className="font-syne text-sm font-semibold text-charcoal">Mon compte</span>
                        </Link>
                        {user.role === 'BUYER' && (
                          <>
                            <Link to="/orders" onClick={() => setAccountOpen(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-charcoal/4 transition-colors">
                              <Package size={15} className="text-charcoal/40" />
                              <span className="font-syne text-sm font-semibold text-charcoal">Mes commandes</span>
                            </Link>
                            <Link to="/wishlist" onClick={() => setAccountOpen(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-charcoal/4 transition-colors">
                              <Heart size={15} className="text-charcoal/40" />
                              <span className="font-syne text-sm font-semibold text-charcoal">Ma wishlist</span>
                            </Link>
                          </>
                        )}
                        {ROLE_DASHBOARD[user.role] && (
                          <Link to={ROLE_DASHBOARD[user.role]} onClick={() => setAccountOpen(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-charcoal/4 transition-colors">
                            <Settings size={15} className="text-charcoal/40" />
                            <span className="font-syne text-sm font-semibold text-charcoal">Mon espace</span>
                          </Link>
                        )}
                        <div className="border-t border-charcoal/6">
                          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-terra/6 transition-colors text-left">
                            <LogOut size={15} className="text-terra" />
                            <span className="font-syne text-sm font-semibold text-terra">Déconnexion</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <Link to="/auth" className={`hidden md:inline-flex font-syne text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200 ${hoverBg} ${textColor}`}>
                  Se connecter
                </Link>
                <Link to="/register/seller" className="hidden md:inline-flex btn-accent text-sm px-5 py-2">
                  Vendre ici
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button className={`md:hidden p-2 rounded-full transition-colors ${dark ? 'text-charcoal' : 'text-cream'}`} onClick={() => setMobileOpen(v => !v)}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 z-40 bg-cream/98 backdrop-blur-md border-b border-forest/10 md:hidden"
          >
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="px-6 pt-4 pb-2">
              <div className="flex items-center bg-white border-2 border-charcoal/10 rounded-full px-4 py-2.5 gap-2 focus-within:border-forest transition-colors">
                <Search size={16} className="text-charcoal/30 shrink-0" />
                <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Rechercher..." className="flex-1 font-dm text-sm text-charcoal bg-transparent focus:outline-none" />
              </div>
            </form>
            <ul className="flex flex-col py-2 px-6 gap-1">
              {NAV_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link to={href} onClick={() => setMobileOpen(false)} className="block font-syne font-medium text-base py-3 text-charcoal hover:text-forest transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
              {user ? (
                <>
                  <li><Link to="/account" onClick={() => setMobileOpen(false)} className="block font-syne font-medium text-base py-3 text-charcoal">Mon compte</Link></li>
                  <li><Link to="/messages" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 font-syne font-medium text-base py-3 text-charcoal">
                    Messages {unreadMessages > 0 && <span className="w-5 h-5 bg-terra text-cream rounded-full text-[10px] font-bold flex items-center justify-center">{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
                  </Link></li>
                  {user.role === 'BUYER' && (
                    <li><Link to="/orders" onClick={() => setMobileOpen(false)} className="block font-syne font-medium text-base py-3 text-charcoal">Mes commandes</Link></li>
                  )}
                  {ROLE_DASHBOARD[user.role] && (
                    <li><Link to={ROLE_DASHBOARD[user.role]} onClick={() => setMobileOpen(false)} className="block font-syne font-medium text-base py-3 text-forest">Mon espace</Link></li>
                  )}
                  <li className="pt-2">
                    <button onClick={() => { handleLogout(); setMobileOpen(false) }} className="w-full btn-outline text-terra border-terra/30 text-center">Déconnexion</button>
                  </li>
                </>
              ) : (
                <li className="pt-3 flex flex-col gap-2">
                  <Link to="/auth" onClick={() => setMobileOpen(false)} className="btn-outline text-center">Se connecter</Link>
                  <Link to="/register/seller" onClick={() => setMobileOpen(false)} className="btn-accent text-center">Vendre ici</Link>
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
