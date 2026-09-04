import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { api } from '../api/client'
import Navbar from '../components/layout/Navbar'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas')
    if (password.length < 6) return setError('Minimum 6 caractères')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => navigate('/auth'), 3000)
    } catch (err) {
      setError(err.message || 'Lien invalide ou expiré')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-cream">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
          <div className="bg-white rounded-3xl p-10 shadow-card text-center max-w-md w-full">
            <AlertCircle size={40} className="mx-auto text-red-400 mb-4" />
            <h1 className="font-playfair text-xl font-bold text-charcoal mb-2">Lien invalide</h1>
            <p className="font-dm text-charcoal/50 mb-6">Ce lien de réinitialisation est invalide ou a expiré.</p>
            <Link to="/forgot-password" className="inline-block bg-forest text-cream font-syne font-bold px-6 py-3 rounded-2xl hover:bg-forest/90 transition-colors text-sm">
              Demander un nouveau lien
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 py-16">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl p-10 shadow-card text-center"
              >
                <div className="w-16 h-16 rounded-full bg-forest/10 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle size={32} className="text-forest" />
                </div>
                <h1 className="font-playfair text-2xl font-bold text-charcoal mb-3">Mot de passe mis à jour !</h1>
                <p className="font-dm text-charcoal/60 mb-6">
                  Votre mot de passe a été réinitialisé avec succès. Vous allez être redirigé vers la connexion…
                </p>
                <div className="w-6 h-6 border-2 border-forest/20 border-t-forest rounded-full animate-spin mx-auto" />
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-10 shadow-card"
              >
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-forest/8 flex items-center justify-center mx-auto mb-4">
                    <Lock size={26} className="text-forest" />
                  </div>
                  <h1 className="font-playfair text-2xl font-bold text-charcoal">Nouveau mot de passe</h1>
                  <p className="font-dm text-sm text-charcoal/50 mt-2">Choisissez un mot de passe sécurisé d'au moins 6 caractères.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">
                      Nouveau mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        required
                        className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 pr-12 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors"
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal/60 transition-colors">
                        {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">
                      Confirmer le mot de passe
                    </label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors"
                    />
                  </div>

                  {error && <p className="font-dm text-sm text-red-500">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-3.5 rounded-2xl hover:bg-forest/90 transition-colors disabled:opacity-60"
                  >
                    {loading
                      ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                      : <><Lock size={16} /> Réinitialiser le mot de passe</>
                    }
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
