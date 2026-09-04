import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowLeft, CheckCircle, Send } from 'lucide-react'
import { api } from '../api/client'
import Navbar from '../components/layout/Navbar'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 py-16">
        <div className="w-full max-w-md">

          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl p-10 shadow-card text-center"
              >
                <div className="w-16 h-16 rounded-full bg-forest/10 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle size={32} className="text-forest" />
                </div>
                <h1 className="font-playfair text-2xl font-bold text-charcoal mb-3">Email envoyé !</h1>
                <p className="font-dm text-charcoal/60 mb-2">
                  Si un compte est associé à <strong className="text-charcoal">{email}</strong>, vous recevrez un lien de réinitialisation dans quelques minutes.
                </p>
                <p className="font-dm text-sm text-charcoal/40 mb-8">
                  Vérifiez également votre dossier spam.
                </p>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 font-syne text-sm font-bold text-forest hover:underline"
                >
                  <ArrowLeft size={14} /> Retour à la connexion
                </Link>
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
                    <Mail size={26} className="text-forest" />
                  </div>
                  <h1 className="font-playfair text-2xl font-bold text-charcoal">Mot de passe oublié ?</h1>
                  <p className="font-dm text-sm text-charcoal/50 mt-2">
                    Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1.5">
                      Adresse email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="vous@exemple.ci"
                      required
                      className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors"
                    />
                  </div>

                  {error && (
                    <p className="font-dm text-sm text-red-500">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-3.5 rounded-2xl hover:bg-forest/90 transition-colors disabled:opacity-60"
                  >
                    {loading
                      ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                      : <><Send size={16} /> Envoyer le lien</>
                    }
                  </button>
                </form>

                <p className="text-center mt-6 font-dm text-sm text-charcoal/40">
                  <Link to="/auth" className="inline-flex items-center gap-1 text-forest hover:underline font-semibold">
                    <ArrowLeft size={13} /> Retour à la connexion
                  </Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  )
}
