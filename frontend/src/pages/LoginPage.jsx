import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ArrowRight, Store, Truck, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROLE_REDIRECT = {
  ADMIN:       '/admin',
  SELLER:      '/vendor',
  DRIVER:      '/driver',
  BUYER:       '/',
  COMMERCIAL:  '/commercial',
  ACCOUNTANT:  '/accounting',
  PRODUCER:    '/producer',
  COOPERATIVE: '/cooperative',
  TRADER:      '/trader',
  PROCESSOR:   '/processor',
  EXPORTER:    '/exporter',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(ROLE_REDIRECT[user.role] || '/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (e, pw) => { setEmail(e); setPassword(pw) }

  return (
    <div className="min-h-screen bg-forest-dark flex">
      {/* Left — visual */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-kente opacity-40" />
        <img
          src="https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=900&q=80"
          alt="Rizières"
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="relative z-10 text-center px-12">
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="text-4xl">🌾</span>
            <span className="font-playfair text-3xl font-bold text-cream">
              Riz<span className="text-safran">Ivoirien</span>
            </span>
          </div>
          <h2 className="font-playfair text-5xl font-bold italic text-cream leading-tight mb-4">
            Le riz local,<br />directement<br />chez vous.
          </h2>
          <p className="font-dm text-cream/50 text-lg">
            Plateforme officielle du riz ivoirien
          </p>

          {/* Demo accounts — dev only, never rendered in a production build */}
          {import.meta.env.DEV && (
            <div className="mt-12 space-y-2 text-left">
              <p className="font-syne text-xs font-bold tracking-widest uppercase text-cream/30 mb-3">
                Comptes démo (dev uniquement)
              </p>
              {[
                { role: 'Admin',    email: 'admin@rizivoirien.ci',    pw: 'admin123',    color: 'text-red-300' },
                { role: 'Vendeur',  email: 'vendeur1@rizivoirien.ci', pw: 'vendeur123',  color: 'text-safran' },
                { role: 'Livreur',  email: 'livreur@rizivoirien.ci',  pw: 'livreur123',  color: 'text-blue-300' },
                { role: 'Acheteur', email: 'acheteur@rizivoirien.ci', pw: 'acheteur123', color: 'text-green-300' },
              ].map(({ role, email: e, pw, color }) => (
                <button
                  key={role}
                  onClick={() => fillDemo(e, pw)}
                  className="w-full flex items-center justify-between bg-cream/5 hover:bg-cream/10 border border-cream/10 rounded-xl px-4 py-3 transition-colors text-left"
                >
                  <span className={`font-syne text-xs font-bold ${color}`}>{role}</span>
                  <span className="font-dm text-xs text-cream/40">{e}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right — form */}
      <div className="w-full lg:w-[440px] flex items-center justify-center bg-cream px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <span className="text-2xl">🌾</span>
            <span className="font-playfair text-xl font-bold text-charcoal">
              Riz<span className="text-safran">Ivoirien</span>
            </span>
          </div>

          <h1 className="font-playfair text-3xl font-bold text-charcoal mb-1">Connexion</h1>
          <p className="font-dm text-charcoal/50 mb-8">Accédez à votre espace personnel</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 block mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.ci" required
                className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors" />
            </div>
            <div>
              <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 block mb-2">Mot de passe</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 pr-12 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal/60 transition-colors">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-terra/10 border border-terra/20 rounded-xl px-4 py-3 font-dm text-sm text-terra">
                {error}
              </motion.div>
            )}

            <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-4 rounded-2xl hover:bg-forest-light transition-colors disabled:opacity-60">
              {loading
                ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                : <><span>Se connecter</span> <ArrowRight size={16} /></>
              }
            </motion.button>

            <div className="text-center">
              <Link to="/forgot-password" className="font-dm text-sm text-charcoal/40 hover:text-forest transition-colors">
                Mot de passe oublié ?
              </Link>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-charcoal/8 space-y-3">
            <Link to="/register"
              className="flex items-center justify-center gap-1.5 bg-charcoal/5 text-charcoal font-syne text-sm font-bold py-3 rounded-xl hover:bg-charcoal/10 transition-colors">
              <UserPlus size={14} /> Créer un compte acheteur
            </Link>
            <div className="flex gap-3">
              <Link to="/register/seller"
                className="flex-1 flex items-center justify-center gap-1.5 border border-charcoal/15 text-charcoal/50 font-syne text-xs font-bold py-2.5 rounded-xl hover:border-[#1B4332] hover:text-[#1B4332] transition-colors">
                <Store size={12} /> Ouvrir une boutique
              </Link>
              <Link to="/register/driver"
                className="flex-1 flex items-center justify-center gap-1.5 border border-charcoal/15 text-charcoal/50 font-syne text-xs font-bold py-2.5 rounded-xl hover:border-[#1B4332] hover:text-[#1B4332] transition-colors">
                <Truck size={12} /> Devenir livreur
              </Link>
            </div>
            <div className="flex justify-center">
              <Link to="/" className="font-dm text-xs text-charcoal/40 hover:text-charcoal/60 transition-colors">
                ← Retour à l'accueil
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
