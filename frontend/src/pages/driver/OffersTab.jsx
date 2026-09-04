import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../../api/client'
import { fmt, fmtOrderId } from '../../utils/status'
import { Check, X, MapPin, Package, Clock, Zap, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')

function Countdown({ expiresAt, createdAt }) {
  const [remaining, setRemaining] = useState(0)
  const totalDuration = Math.max(1, Math.floor((new Date(expiresAt) - new Date(createdAt)) / 1000))

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000))
      setRemaining(diff)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [expiresAt])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const pct = (remaining / totalDuration) * 100

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-12 h-12 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="17" fill="none" stroke="#f0f0f0" strokeWidth="4" />
          <circle
            cx="20" cy="20" r="17"
            fill="none"
            stroke={remaining < 120 ? '#C4501A' : '#1B4332'}
            strokeWidth="4"
            strokeDasharray={`${(pct / 100) * 106.8} 106.8`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Clock size={14} className={remaining < 120 ? 'text-terra' : 'text-forest'} />
        </div>
      </div>
      <div>
        <p className={`font-playfair text-xl font-bold ${remaining < 120 ? 'text-terra' : 'text-charcoal'}`}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </p>
        <p className="font-dm text-xs text-charcoal/40">avant expiration</p>
      </div>
    </div>
  )
}

export default function OffersTab({ online, onAccepted, hasActiveDelivery, onGoToDelivery }) {
  const [offers, setOffers] = useState([])
  const [commission, setCommission] = useState(0.15)
  const [acting, setActing] = useState(null)
  const [actError, setActError] = useState(null)
  const [sseConnected, setSseConnected] = useState(false)
  const [penaltyMsg, setPenaltyMsg] = useState(null)
  const esRef = useRef(null)

  // ── Chargement initial + polling ─────────────────────────────────────────
  const loadOffers = useCallback(() => {
    api.get('/drivers/offers').then(({ offers, commission }) => {
      if (offers) setOffers(offers)
      if (commission != null) setCommission(commission)
    }).catch(() => {})
  }, [])

  // ── SSE connexion ─────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('rz_token')
    if (!online || !token) {
      setSseConnected(false)
      if (esRef.current) { esRef.current.close(); esRef.current = null }
      return
    }

    // Ouvrir le stream SSE avec le token en query param (EventSource ne supporte pas les headers)
    const url = `${BASE}/api/drivers/events?token=${token}`
    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('connected', () => setSseConnected(true))

    es.addEventListener('new_offer', (e) => {
      try {
        const payload = JSON.parse(e.data)
        // Le SSE peut envoyer { offer, commission } ou juste l'offre directement
        const offer = payload.offer ?? payload
        if (payload.commission != null) setCommission(payload.commission)
        setOffers(prev => {
          if (prev.find(o => o.id === offer.id)) return prev
          return [offer, ...prev]
        })
      } catch {}
    })

    es.addEventListener('penalty_warning', (e) => {
      try { setPenaltyMsg({ type: 'warning', text: JSON.parse(e.data).message }) } catch {}
    })

    es.addEventListener('penalty_suspended', (e) => {
      try { setPenaltyMsg({ type: 'suspended', text: JSON.parse(e.data).message }) } catch {}
    })

    es.onerror = () => setSseConnected(false)

    return () => {
      es.close()
      esRef.current = null
      setSseConnected(false)
    }
  }, [online])  // token lu depuis localStorage à l'intérieur, pas en dépendance

  // Polling toutes les 15s — toujours actif (SSE peut manquer des événements)
  useEffect(() => {
    if (online) loadOffers()
    const t = setInterval(() => {
      if (online) loadOffers()
    }, 15000)
    return () => clearInterval(t)
  }, [loadOffers, online])

  const handleAccept = async (offerId) => {
    setActing(offerId); setActError(null)
    try {
      await api.post(`/drivers/offers/${offerId}/accept`, {})
      setOffers(os => os.filter(o => o.id !== offerId))
      if (onAccepted) onAccepted()
    } catch (err) { setActError(err.message || 'Erreur lors de l\'acceptation') }
    finally { setActing(null) }
  }

  const handleRefuse = async (offerId) => {
    setActing(offerId); setActError(null)
    try {
      await api.post(`/drivers/offers/${offerId}/refuse`, {})
      setOffers(os => os.filter(o => o.id !== offerId))
    } catch (err) { setActError(err.message || 'Erreur lors du refus') }
    finally { setActing(null) }
  }

  if (!online) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-charcoal/8 flex items-center justify-center mb-6 text-4xl">😴</div>
        <h2 className="font-playfair text-2xl font-bold text-charcoal mb-2">Vous êtes hors ligne</h2>
        <p className="font-dm text-charcoal/50 max-w-xs">Activez votre statut en ligne pour recevoir des offres de livraison.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {penaltyMsg && (
        <div className={`flex items-start gap-3 rounded-2xl p-4 border ${
          penaltyMsg.type === 'suspended'
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <span className="text-xl shrink-0">{penaltyMsg.type === 'suspended' ? '⛔' : '⚠️'}</span>
          <p className="font-dm text-sm text-charcoal/80 flex-1">{penaltyMsg.text}</p>
          <button onClick={() => setPenaltyMsg(null)} className="text-charcoal/30 hover:text-charcoal transition-colors shrink-0">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="font-playfair text-2xl font-bold text-charcoal">
          {offers.length ? `${offers.length} offre${offers.length > 1 ? 's' : ''}` : 'Aucune offre'}
        </h2>
        <div className="flex items-center gap-2">
          {sseConnected ? (
            <>
              <Zap size={12} className="text-green-500" />
              <span className="font-syne text-xs font-bold text-green-600">Temps réel</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="font-syne text-xs font-bold text-amber-600">Actualisation 15s</span>
            </>
          )}
        </div>
      </div>

      {actError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{actError}</p>
          <button onClick={() => setActError(null)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}

      <AnimatePresence>
        {offers.map(offer => (
          <motion.div
            key={offer.id}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-3xl shadow-card overflow-hidden"
          >
            {/* Header */}
            <div className="bg-forest p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-syne text-xs font-bold tracking-wider uppercase text-cream/50 mb-1">Nouvelle offre</p>
                  <p className="font-playfair text-2xl font-bold text-cream">Commande {fmtOrderId(offer.order?.id, offer.order?.createdAt)}</p>
                </div>
                <Countdown expiresAt={offer.expiresAt} createdAt={offer.createdAt} />
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Badge multi-boutiques */}
              {offer.order?.pickupCount > 1 && (
                <div className="flex items-center gap-2 bg-safran/10 border border-safran/20 rounded-xl px-3 py-2">
                  <Package size={13} className="text-safran shrink-0" />
                  <p className="font-syne text-xs font-bold text-charcoal/70">
                    {offer.order.pickupCount} points de collecte
                  </p>
                </div>
              )}

              {/* Shop → Client */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-cream rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Package size={13} className="text-forest" />
                    <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">
                      {offer.order?.pickupCount > 1 ? `Collecte principale` : 'Récupération'}
                    </p>
                  </div>
                  <p className="font-syne text-sm font-bold text-charcoal">{offer.order?.shop?.name}</p>
                  <p className="font-dm text-xs text-charcoal/50 mt-0.5">{offer.order?.shop?.location}</p>
                </div>
                <div className="bg-cream rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin size={13} className="text-terra" />
                    <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">Livraison</p>
                  </div>
                  <p className="font-syne text-sm font-bold text-charcoal">{offer.order?.buyer?.name}</p>
                  <p className="font-dm text-xs text-charcoal/50 mt-0.5">{offer.order?.address}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-2">Articles</p>
                {offer.order?.items?.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-charcoal/5 last:border-0">
                    <p className="font-dm text-sm text-charcoal">{item.quantity}× {item.name}</p>
                    <p className="font-syne text-sm font-bold text-charcoal">{fmt((item.price ?? 0) * item.quantity)} F</p>
                  </div>
                ))}
              </div>

              {/* Revenue */}
              <div className="bg-safran/10 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-syne text-xs font-bold text-safran-dark uppercase tracking-wider mb-0.5">Votre gain</p>
                  <p className="font-playfair text-2xl font-bold text-charcoal">
                    {fmt(Math.round(offer.order?.deliveryFee * commission))} FCFA
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-syne text-xs text-charcoal/40">Total commande</p>
                  <p className="font-syne text-sm font-bold text-charcoal">{fmt(offer.order?.total)} F</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleRefuse(offer.id)}
                  disabled={acting === offer.id}
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-red-200 text-red-500 font-syne font-bold text-sm py-3.5 rounded-2xl hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <X size={18} /> Refuser
                </button>
                <button
                  onClick={() => handleAccept(offer.id)}
                  disabled={acting === offer.id}
                  className="flex-[2] flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold text-sm py-3.5 rounded-2xl hover:bg-forest-light transition-colors disabled:opacity-50"
                >
                  {acting === offer.id
                    ? <div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                    : <Check size={18} />
                  }
                  Accepter la livraison
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {!offers.length && (
        hasActiveDelivery ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">🚚</div>
            <h3 className="font-playfair text-xl font-bold text-charcoal mb-2">Livraison en cours</h3>
            <p className="font-dm text-sm text-charcoal/50 mb-4">Vous avez une livraison active en cours.</p>
            {onGoToDelivery && (
              <button onClick={onGoToDelivery} className="bg-forest text-cream font-syne font-bold text-sm px-5 py-2.5 rounded-2xl hover:bg-forest/90 transition-colors">
                Voir ma livraison →
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">🚚</div>
            <h3 className="font-playfair text-xl font-bold text-charcoal mb-2">En attente d'offres</h3>
            <p className="font-dm text-sm text-charcoal/50">Les nouvelles offres apparaissent automatiquement ici.</p>
          </div>
        )
      )}
    </div>
  )
}
