import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Briefcase } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'

export default function CommercialRegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', inviteCode: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.post('/auth/register-commercial', {
        name:       form.name,
        email:      form.email,
        phone:      form.phone,
        password:   form.password,
        inviteCode: form.inviteCode.trim().toUpperCase(),
      })
      // Store credentials and log in
      await login(form.email, form.password)
      navigate('/commercial')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full font-dm text-sm bg-white border border-charcoal/20 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder:text-charcoal/30'

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
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <Briefcase className="text-indigo-300" size={24} />
            </div>
          </div>
          <h2 className="font-playfair text-4xl font-bold italic text-cream leading-tight mb-4">
            Espace<br />Service Commercial
          </h2>
          <p className="font-dm text-cream/50 text-base max-w-sm mx-auto">
            Gérez le pipeline partenaires, les contrats, les demandes de plan et les renouvellements d'abonnement.
          </p>
          <div className="mt-10 bg-indigo-500/10 border border-indigo-400/20 rounded-2xl px-6 py-4 text-left">
            <p className="font-syne text-xs font-bold tracking-widest uppercase text-indigo-300 mb-2">Accès réservé</p>
            <p className="font-dm text-sm text-cream/60">
              Un code d'invitation est requis pour créer un compte commercial. Contactez l'administrateur pour obtenir le vôtre.
            </p>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="w-full lg:w-[480px] flex items-center justify-center bg-cream px-8 py-12">
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

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Briefcase className="text-indigo-600" size={20} />
            </div>
            <div>
              <h1 className="font-playfair text-2xl font-bold text-charcoal">Espace Commercial</h1>
              <p className="font-dm text-sm text-charcoal/50">Créez votre compte avec un code d'invitation</p>
            </div>
          </div>

          <div className="h-px bg-charcoal/10 my-6" />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <p className="font-dm text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-syne text-xs font-bold text-charcoal/60 uppercase tracking-wider block mb-1.5">
                Nom complet
              </label>
              <input
                type="text"
                placeholder="Jean Kouassi"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
                className={inputCls}
              />
            </div>

            <div>
              <label className="font-syne text-xs font-bold text-charcoal/60 uppercase tracking-wider block mb-1.5">
                Adresse email
              </label>
              <input
                type="email"
                placeholder="jean@rizivoirien.ci"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                required
                className={inputCls}
              />
            </div>

            <div>
              <label className="font-syne text-xs font-bold text-charcoal/60 uppercase tracking-wider block mb-1.5">
                Téléphone
              </label>
              <input
                type="tel"
                placeholder="+225 07 00 00 00 00"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="font-syne text-xs font-bold text-charcoal/60 uppercase tracking-wider block mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required
                  minLength={6}
                  className={inputCls + ' pr-12'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal/70 transition-colors"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="font-syne text-xs font-bold text-charcoal/60 uppercase tracking-wider block mb-1.5">
                Code d'invitation
              </label>
              <input
                type="text"
                placeholder="RIZ-XXXXXXX"
                value={form.inviteCode}
                onChange={e => set('inviteCode', e.target.value.toUpperCase())}
                required
                className={inputCls + ' font-mono tracking-widest uppercase'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-syne font-bold text-sm py-3.5 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-all mt-2"
            >
              {loading ? 'Création en cours…' : 'Créer mon compte commercial'}
            </button>
          </form>

          <p className="font-dm text-sm text-charcoal/50 text-center mt-6">
            Déjà un compte ?{' '}
            <Link to="/auth" className="text-indigo-600 font-bold hover:underline">
              Se connecter
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
