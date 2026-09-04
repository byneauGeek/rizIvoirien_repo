import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { api } from '../api/client'
import Navbar from '../components/layout/Navbar'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState('loading') // loading | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Lien invalide'); return }
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => setStatus('success'))
      .catch(err => { setStatus('error'); setMessage(err.message || 'Lien invalide ou expiré') })
  }, [token])

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-12 shadow-card text-center max-w-md w-full"
        >
          {status === 'loading' && (
            <>
              <Loader2 size={40} className="mx-auto text-forest animate-spin mb-5" />
              <h1 className="font-playfair text-xl font-bold text-charcoal">Vérification en cours…</h1>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-forest/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={34} className="text-forest" />
              </div>
              <h1 className="font-playfair text-2xl font-bold text-charcoal mb-3">Email vérifié !</h1>
              <p className="font-dm text-charcoal/60 mb-8">
                Votre adresse email a été confirmée avec succès. Votre compte est maintenant pleinement actif.
              </p>
              <Link
                to="/auth"
                className="inline-block bg-forest text-cream font-syne font-bold px-8 py-3.5 rounded-2xl hover:bg-forest/90 transition-colors"
              >
                Se connecter
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                <XCircle size={34} className="text-red-400" />
              </div>
              <h1 className="font-playfair text-2xl font-bold text-charcoal mb-3">Lien invalide</h1>
              <p className="font-dm text-charcoal/60 mb-8">
                {message || 'Ce lien de vérification est invalide ou a expiré.'}
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  to="/auth"
                  className="inline-block bg-forest text-cream font-syne font-bold px-8 py-3.5 rounded-2xl hover:bg-forest/90 transition-colors"
                >
                  Se connecter
                </Link>
                <p className="font-dm text-xs text-charcoal/40">
                  Connectez-vous pour renvoyer un email de vérification depuis votre compte.
                </p>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
