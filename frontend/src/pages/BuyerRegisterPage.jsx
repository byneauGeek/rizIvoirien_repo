import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

// LOT REVISION (retour utilisateur) : aucune page d'inscription acheteur
// n'existait — POST /api/auth/register (BUYER par défaut) était du code mort
// côté frontend, jamais appelé depuis aucune page. La seule façon de devenir
// acheteur était une redirection silencieuse vers /auth, qui ne propose que
// la connexion ou l'ouverture d'une boutique.
export default function BuyerRegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSession } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Après inscription, retour à la page d'où l'acheteur venait (ex. panier)
  // plutôt qu'un renvoi générique vers l'accueil.
  const redirectTo = location.state?.from || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('Le mot de passe doit contenir au moins 6 caractères.')
    if (password !== confirmPassword) return setError('Les mots de passe ne correspondent pas.')
    setLoading(true)
    try {
      const data = await api.post('/auth/register', { name, email, phone: phone || undefined, password })
      setSession(data)
      navigate(redirectTo)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="max-w-md mx-auto px-6 pt-28 pb-16">
        <h1 className="font-playfair text-4xl font-bold text-charcoal mb-2">Créer un compte</h1>
        <p className="font-dm text-charcoal/50 mb-8">Rejoignez RizIvoirien pour commander en quelques clics.</p>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-5">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="font-dm text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 block mb-2">Nom complet</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="Konan Yao"
              className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors" />
          </div>
          <div>
            <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 block mb-2">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="vous@exemple.ci"
              className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors" />
          </div>
          <div>
            <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 block mb-2">Téléphone (optionnel)</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="07 00 00 00 00"
              className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors" />
          </div>
          <div>
            <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 block mb-2">Mot de passe</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                required minLength={6} placeholder="••••••••"
                className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 pr-12 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal/60 transition-colors">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 block mb-2">Confirmer le mot de passe</label>
            <input type={showPw ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              required placeholder="••••••••"
              className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-4 rounded-2xl hover:bg-forest-light transition-colors disabled:opacity-60">
            {loading
              ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
              : <><span>Créer mon compte</span> <ArrowRight size={16} /></>
            }
          </button>
        </form>

        <p className="font-dm text-sm text-charcoal/40 mt-8 text-center">
          Déjà inscrit ? <Link to="/auth" className="text-forest font-bold">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
