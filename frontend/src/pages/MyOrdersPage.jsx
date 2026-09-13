import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, ChevronDown, ChevronUp, Phone, Star, X, Truck, AlertTriangle, CheckCircle, Navigation, MapPin, MessageCircle } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { STATUS_LABELS, STATUS_COLORS, STATUS_DOT, fmt, fmtDate, fmtOrderId } from '../utils/status'
import { usePageTitle } from '../hooks/usePageTitle'
import DeliveryMap from '../components/orders/DeliveryMap'
import { QRCodeSVG } from 'qrcode.react'

const STEPS = ['CONFIRMED', 'EN_PREPARATION', 'PRET', 'IN_TRANSIT', 'DELIVERED']
const STEP_LABELS = {
  CONFIRMED: 'Confirmée', EN_PREPARATION: 'En préparation',
  PRET: 'Prête', IN_TRANSIT: 'En route', DELIVERED: 'Livrée',
}
const STEP_ICONS = { CONFIRMED: '✅', EN_PREPARATION: '👨‍🍳', PRET: '📦', IN_TRANSIT: '🚚', DELIVERED: '🎉' }

// LOT 13 (Espace client) : STATUS_LABELS (utils/status.js) est partagé avec
// les vues admin/commercial/vendeur, où "Escaladée admin" est le bon terme
// pour une équipe interne — mais depuis le LOT 10 (échec de livraison),
// N'IMPORTE QUEL acheteur peut désormais atterrir sur ce statut après une
// tentative ratée, pas seulement un cas rare d'affectation jamais acceptée.
// Override local, uniquement pour le badge visible par l'acheteur.
const BUYER_STATUS_LABELS = { ESCALATED: 'Nouvelle tentative en préparation' }

const DISPUTE_REASONS = {
  PRODUCT_NOT_RECEIVED: 'Produit non reçu',
  PRODUCT_DAMAGED:      'Produit endommagé',
  WRONG_PRODUCT:        'Mauvais produit livré',
  DELIVERY_ISSUE:       'Problème de livraison',
  OTHER:                'Autre',
}

const DISPUTE_STATUS = {
  OPEN:              { label: 'Ouvert',              color: 'bg-orange-50 text-orange-700 border-orange-200' },
  UNDER_REVIEW:      { label: 'En cours d\'examen',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
  RESOLVED_REFUND:   { label: 'Remboursé',           color: 'bg-green-50 text-green-700 border-green-200' },
  RESOLVED_REJECTED: { label: 'Refusé',              color: 'bg-red-50 text-red-700 border-red-200' },
  CLOSED:            { label: 'Clôturé',             color: 'bg-charcoal/10 text-charcoal/60 border-charcoal/20' },
}

// ── Tracking livreur (IN_TRANSIT) ────────────────────────────────────────────
// LOT 8 (Logistique) : conserve désormais toute la réponse (eta, destination
// géocodée pour la carte), pas seulement la position du livreur.
function useTracking(orderId, active) {
  const [state, setState] = useState({ tracking: null, eta: null, destination: null, deliveryCode: null, qrToken: null, shipmentStatus: null })

  useEffect(() => {
    if (!active || !orderId) { setState({ tracking: null, eta: null, destination: null, deliveryCode: null, qrToken: null, shipmentStatus: null }); return }

    const poll = () => {
      api.get(`/orders/${orderId}/track`)
        .then(data => setState({
          tracking: data.tracking || null, eta: data.eta || null, destination: data.destination || null,
          deliveryCode: data.deliveryCode || null, qrToken: data.qrToken || null, shipmentStatus: data.shipmentStatus || null,
        }))
        .catch(() => {})
    }
    poll()
    const iv = setInterval(poll, 10000)
    return () => clearInterval(iv)
  }, [orderId, active])

  return state
}

// LOT 3 (Arbitrage XXX RIZ) : QR dynamique — mécanisme PRINCIPAL de preuve de
// livraison une fois le livreur arrivé (Shipment.status === 'ARRIVED'). Le
// code OTP (LOT9) reste affiché en dessous comme solution de secours
// contrôlée, jamais retiré — le backend accepte les deux indépendamment.
function QrCodeBadge({ qrToken, shipmentStatus }) {
  if (!qrToken) return null
  return (
    <div className="mt-2 flex flex-col items-center gap-2 bg-safran/10 border border-safran/30 rounded-xl px-3 py-3">
      <p className="font-dm text-xs text-charcoal/70 text-center">
        {shipmentStatus === 'ARRIVED' ? 'Votre livreur est arrivé — présentez ce QR :' : 'Code de vérification de livraison :'}
      </p>
      <div className="bg-white p-2 rounded-lg">
        <QRCodeSVG value={qrToken} size={140} data-testid="delivery-qr" />
      </div>
    </div>
  )
}

// LOT 9 : code de preuve de livraison à communiquer au livreur — affiché quel
// que soit l'état du GPS (le code est indépendant de la position). LOT 3 :
// devient le secours du QR ci-dessus, toujours disponible en parallèle.
function DeliveryCodeBadge({ code }) {
  if (!code) return null
  return (
    <div className="mt-2 flex items-center justify-between gap-2 bg-charcoal/5 border border-charcoal/10 rounded-xl px-3 py-2">
      <p className="font-dm text-xs text-charcoal/60">Code de secours (si le QR ne peut pas être scanné) :</p>
      <span data-testid="delivery-code" className="font-syne text-lg font-bold tracking-[0.3em] text-charcoal">{code}</span>
    </div>
  )
}

// LOT 4 (Arbitrage XXX RIZ) : action active de l'acheteur — jusqu'ici,
// seul le livreur pouvait clore une livraison. Disponible uniquement une
// fois le QR scanné et validé (shipmentStatus === 'QR_SCANNED').
function ConfirmReceiptButton({ orderId, shipmentStatus }) {
  const [state, setState] = useState('idle') // idle | loading | done | error
  if (shipmentStatus !== 'QR_SCANNED') return null

  const confirm = async () => {
    setState('loading')
    try {
      await api.post(`/orders/${orderId}/confirm-receipt`)
      setState('done')
      // Pas de callback de rafraîchissement remonté depuis MyOrdersPage pour
      // l'instant (OrderCard/TrackingBanner ne reçoivent que orderId) —
      // rechargement complet après un court délai pour laisser le message
      // de succès s'afficher, plutôt que de faire remonter un prop à travers
      // toute la hiérarchie pour une action rare et terminale.
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      setState('error')
    }
  }

  if (state === 'done') return (
    <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
      <CheckCircle size={14} className="text-green-600 shrink-0" />
      <p className="font-dm text-xs text-green-700">Merci ! Livraison confirmée.</p>
    </div>
  )

  return (
    <div className="mt-2 space-y-1">
      <button onClick={confirm} disabled={state === 'loading'}
        className="w-full flex items-center justify-center gap-2 font-syne text-sm font-bold py-3 rounded-xl bg-green-500 text-cream hover:bg-green-600 disabled:opacity-60 transition-colors">
        {state === 'loading'
          ? <div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
          : <><CheckCircle size={16} /> J'ai reçu mon colis</>}
      </button>
      {state === 'error' && <p className="font-dm text-xs text-red-600 text-center">Erreur — réessayez.</p>}
    </div>
  )
}

function TrackingBanner({ orderId }) {
  const { tracking, eta, destination, deliveryCode, qrToken, shipmentStatus } = useTracking(orderId, true)

  if (!tracking) return (
    <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-2xl">
      <div className="flex items-center gap-2">
        <Truck size={14} className="text-blue-500 shrink-0" />
        <p className="font-dm text-xs text-blue-700">Votre livreur est en route — position en cours de récupération…</p>
      </div>
      <QrCodeBadge qrToken={qrToken} shipmentStatus={shipmentStatus} />
      <DeliveryCodeBadge code={deliveryCode} />
      <ConfirmReceiptButton orderId={orderId} shipmentStatus={shipmentStatus} />
    </div>
  )

  const ago = Math.round((Date.now() - tracking.ts) / 1000)
  const agoStr = ago < 60 ? `il y a ${ago}s` : `il y a ${Math.round(ago / 60)}min`
  const mapsUrl = `https://www.google.com/maps?q=${tracking.lat},${tracking.lng}`

  return (
    <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-2xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <p className="font-syne text-xs font-bold text-blue-700">Livreur en route</p>
          <span className="font-dm text-[10px] text-blue-500">(mis à jour {agoStr})</span>
        </div>
        <div className="flex items-center gap-3">
          {eta && (
            <span className="font-syne text-xs font-bold text-blue-700">
              ≈ {eta.minutes} min ({eta.distanceKm} km)
            </span>
          )}
          <a href={mapsUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 font-syne text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
            <Navigation size={11} /> Voir sur Maps
          </a>
        </div>
      </div>
      <DeliveryMap driverPosition={{ lat: tracking.lat, lng: tracking.lng }} destination={destination} />
      <QrCodeBadge qrToken={qrToken} shipmentStatus={shipmentStatus} />
      <DeliveryCodeBadge code={deliveryCode} />
      <ConfirmReceiptButton orderId={orderId} shipmentStatus={shipmentStatus} />
    </div>
  )
}

// ── Modal litige ──────────────────────────────────────────────────────────────
function DisputeModal({ order, onClose, onSubmitted }) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason || description.trim().length < 20) {
      setError('Sélectionnez un motif et décrivez le problème (min. 20 caractères).')
      return
    }
    setLoading(true); setError('')
    try {
      await api.post('/disputes', { orderId: order.id, reason, description: description.trim() })
      setSuccess(true)
      setTimeout(() => { onSubmitted(); onClose() }, 2200)
    } catch (e) {
      setError(e.message || 'Erreur lors du signalement')
    } finally { setLoading(false) }
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}>

        {success ? (
          <div className="p-10 text-center">
            <CheckCircle size={52} className="mx-auto text-green-500 mb-4" />
            <h3 className="font-playfair text-2xl font-bold text-charcoal mb-2">Litige ouvert</h3>
            <p className="font-dm text-charcoal/60">Notre équipe examinera votre demande sous 48h.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center justify-between p-6 border-b border-charcoal/8">
              <div>
                <p className="font-dm text-xs text-charcoal/40">Commande {fmtOrderId(order.id, order.createdAt, order.reference)}</p>
                <h3 className="font-playfair text-xl font-bold text-charcoal">Signaler un problème</h3>
              </div>
              <button type="button" onClick={onClose} aria-label="Fermer" className="p-2 rounded-xl hover:bg-charcoal/6 transition-colors">
                <X size={20} className="text-charcoal/50" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Motif */}
              <div>
                <label className="block font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 mb-2">
                  Motif *
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(DISPUTE_REASONS).map(([key, label]) => (
                    <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      reason === key ? 'border-forest bg-forest/5' : 'border-charcoal/10 hover:border-charcoal/30'
                    }`}>
                      <input type="radio" name="reason" value={key}
                        checked={reason === key} onChange={() => setReason(key)}
                        className="sr-only" />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        reason === key ? 'border-forest' : 'border-charcoal/20'
                      }`}>
                        {reason === key && <div className="w-2 h-2 rounded-full bg-forest" />}
                      </div>
                      <span className="font-dm text-sm text-charcoal">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 mb-2">
                  Description du problème *
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Décrivez précisément le problème rencontré (état du produit, ce qui manque, etc.)…"
                  className="w-full border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest resize-none transition-colors"
                />
                <p className="font-dm text-xs text-charcoal/30 mt-1 text-right">{description.length} / min. 20</p>
              </div>

              {error && (
                <p className="font-dm text-sm text-red-500 bg-red-50 rounded-xl p-3">{error}</p>
              )}
            </div>

            <div className="px-6 pb-6">
              <button type="submit" disabled={loading}
                className="w-full bg-forest text-cream font-syne font-bold py-4 rounded-2xl hover:bg-forest-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" /> Envoi en cours…</>
                ) : (
                  <><AlertTriangle size={16} /> Soumettre le litige</>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Carte de litige existant ──────────────────────────────────────────────────
function DisputeBadge({ dispute }) {
  const s = DISPUTE_STATUS[dispute.status] || DISPUTE_STATUS.OPEN
  return (
    <div className="mt-3 p-3 rounded-2xl border bg-orange-50/50 border-orange-100">
      <div className="flex items-center justify-between mb-1">
        <span className="font-syne text-xs font-bold tracking-wider uppercase text-orange-600/70">Litige #{dispute.id}</span>
        <span className={`font-syne text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
      </div>
      <p className="font-dm text-xs text-charcoal/60">{DISPUTE_REASONS[dispute.reason]}</p>
      {dispute.resolution && (
        <p className="font-dm text-xs text-charcoal/80 mt-1 italic">"{dispute.resolution}"</p>
      )}
      {dispute.status === 'RESOLVED_REFUND' && dispute.refundAmount > 0 && (
        <p className="font-syne text-xs font-bold text-green-700 mt-1">
          💰 Remboursement : {Number(dispute.refundAmount).toLocaleString('fr-FR')} FCFA
        </p>
      )}
    </div>
  )
}

function OrderTimeline({ status }) {
  const idx = STEPS.indexOf(status)
  // LOT 13 : CANCELLED/ESCALATED ne font pas partie de la progression
  // linéaire (idx = -1) — sans ce garde-fou, `i <= idx` est faux pour
  // TOUTES les étapes et l'acheteur voit une frise entièrement grisée,
  // comme si sa commande n'avait jamais même été confirmée. Rare avant le
  // LOT 10 (seul un cas d'affectation jamais acceptée y menait) ; désormais
  // atteint par tout échec de livraison, un parcours normal, pas un cas
  // limite — d'où la nécessité d'un message clair plutôt qu'une frise
  // trompeuse.
  if (idx === -1) {
    const isEscalated = status === 'ESCALATED'
    return (
      <div className={`flex items-center gap-2 my-4 px-4 py-3 rounded-2xl border ${
        isEscalated ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-charcoal/5 border-charcoal/10 text-charcoal/50'
      }`}>
        <span className="text-base">{isEscalated ? '⚠️' : '✕'}</span>
        <p className="font-dm text-sm">
          {isEscalated
            ? 'La livraison a rencontré un problème — notre équipe organise une nouvelle tentative.'
            : 'Cette commande a été annulée.'}
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-0 my-4 overflow-x-auto no-scrollbar">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${i <= idx ? 'bg-forest text-cream' : 'bg-charcoal/10 text-charcoal/30'}`}>
              {i < idx ? '✓' : STEP_ICONS[step]}
            </div>
            <p className={`font-syne text-[10px] font-bold mt-1 text-center whitespace-nowrap ${i <= idx ? 'text-forest' : 'text-charcoal/30'}`}>
              {STEP_LABELS[step]}
            </p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 transition-all ${i < idx ? 'bg-forest' : 'bg-charcoal/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function RatingStars({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          aria-label={`Noter ${i} étoile${i > 1 ? 's' : ''}`}
          aria-pressed={i <= value}>
          <Star size={22} className={(hover || value) >= i ? 'fill-safran text-safran' : 'text-charcoal/20'} />
        </button>
      ))}
    </div>
  )
}

function OrderCard({ order, onReview, onCancel, onRateDriver, onRateShop, onDispute, disputes }) {
  const [open, setOpen] = useState(false)
  const [driverRating, setDriverRating] = useState(0)
  const [ratingDone, setRatingDone] = useState(order.driverRated || false)
  const [shopRating, setShopRating] = useState(0)
  const [shopRatingDone, setShopRatingDone] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const isPending = order.status === 'PENDING'
  const isConfirmed = order.status === 'CONFIRMED'
  const isActive = !['DELIVERED', 'CANCELLED', 'ESCALATED'].includes(order.status)

  // Litige existant pour cette commande ?
  const existingDispute = disputes.find(d => d.orderId === order.id)

  const handleRateDriver = async () => {
    if (!driverRating) return
    await onRateDriver(order.id, driverRating)
    setRatingDone(true)
  }

  return (
    <motion.div layout className="bg-white rounded-3xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-syne font-bold text-charcoal">Commande {fmtOrderId(order.id, order.createdAt, order.reference)}</span>
              <span className={`inline-flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1 rounded-full border ${STATUS_COLORS[order.status] || 'bg-charcoal/10 text-charcoal border-charcoal/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[order.status] || 'bg-charcoal/40'}`} />
                {BUYER_STATUS_LABELS[order.status] || STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <p className="font-dm text-sm text-charcoal/50">{fmtDate(order.createdAt)} · {order.shop?.name}</p>
            <Link to={`/messages?contextType=ORDER&contextId=${order.id}`}
              className="inline-flex items-center gap-1.5 mt-1.5 font-syne text-xs font-bold text-forest hover:underline">
              <MessageCircle size={12} /> Contacter le vendeur
            </Link>
          </div>
          <div className="text-right shrink-0">
            <p className="font-playfair text-2xl font-bold text-charcoal">{fmt(order.total)} F</p>
            <p className="font-dm text-xs text-charcoal/40">+ {fmt(order.deliveryFee)} F livraison</p>
          </div>
        </div>

        {/* Timeline */}
        {!isPending && <OrderTimeline status={order.status} />}

        {/* Litige badge (si litige ouvert) */}
        {existingDispute && <DisputeBadge dispute={existingDispute} />}

        {/* Tracking banner pour les commandes IN_TRANSIT */}
        {order.status === 'IN_TRANSIT' && <TrackingBanner orderId={order.id} />}

        {/* Driver info */}
        {order.driver && isActive && (
          <div className="flex items-center gap-3 mt-3 p-3 bg-forest/5 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-forest/20 flex items-center justify-center">
              <span className="font-bold text-forest text-sm">{order.driver.user?.name?.[0]}</span>
            </div>
            <div className="flex-1">
              <p className="font-syne text-sm font-bold text-charcoal">{order.driver.user?.name}</p>
              <p className="font-dm text-xs text-charcoal/50">⭐ {order.driver.rating?.toFixed(1)} · Votre livreur</p>
            </div>
            <Link to={`/messages?contextType=ORDER_DRIVER&contextId=${order.id}`}
              className="p-2 rounded-full bg-forest/15 text-forest hover:bg-forest hover:text-cream transition-colors">
              <MessageCircle size={14} />
            </Link>
            {order.driver.user?.phone && (
              <a href={`tel:${order.driver.user.phone}`} className="p-2 rounded-full bg-forest text-cream hover:bg-forest-light transition-colors">
                <Phone size={14} />
              </a>
            )}
          </div>
        )}

        <button onClick={() => setOpen(v => !v)} className="mt-4 flex items-center gap-1 font-syne text-xs font-bold text-charcoal/50 hover:text-charcoal transition-colors">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {open ? 'Masquer' : 'Voir'} le détail
        </button>
      </div>

      {/* Detail */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-6 pb-6 border-t border-charcoal/6 pt-4 space-y-4">
              {/* Items */}
              <div>
                <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-3">Articles</p>
                {order.items?.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2">
                    <span className="font-dm text-sm text-charcoal">{item.quantity}× {item.name}{item.unitLabel && <span className="text-charcoal/40"> ({item.unitLabel})</span>}</span>
                    <span className="font-syne text-sm font-bold text-charcoal">{fmt(item.price * item.quantity)} F</span>
                  </div>
                ))}
              </div>

              {/* Address */}
              <div>
                <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-1">Adresse</p>
                <p className="font-dm text-sm text-charcoal">{order.address}</p>
              </div>

              {/* Status history */}
              <div>
                <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-2">Historique</p>
                <div className="space-y-2">
                  {order.statusHistory?.map(h => (
                    <div key={h.id} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-forest mt-1.5 shrink-0" />
                      <div>
                        <span className="font-syne text-xs font-bold text-charcoal">{STATUS_LABELS[h.status] || h.status}</span>
                        {h.note && <span className="font-dm text-xs text-charcoal/50"> · {h.note}</span>}
                        <p className="font-dm text-[10px] text-charcoal/30">{fmtDate(h.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Review CTA */}
              {order.status === 'DELIVERED' && (
                <button onClick={() => onReview(order)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-safran text-safran font-syne font-bold text-sm py-3 rounded-2xl hover:bg-safran hover:text-charcoal transition-colors">
                  <Star size={16} /> Laisser un avis
                </button>
              )}

              {/* Dispute CTA */}
              {order.status === 'DELIVERED' && (
                existingDispute ? null : (
                  <button onClick={() => onDispute(order)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-orange-300 text-orange-600 font-syne font-bold text-sm py-3 rounded-2xl hover:bg-orange-50 transition-colors">
                    <AlertTriangle size={16} /> Signaler un problème
                  </button>
                )
              )}

              {/* Driver rating */}
              {order.status === 'DELIVERED' && order.driverId && (
                <div className="p-4 bg-cream rounded-2xl">
                  <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-3">
                    {ratingDone ? 'Livreur noté' : 'Noter votre livreur'}
                  </p>
                  {ratingDone ? (
                    <p className="font-dm text-sm text-charcoal/60">Merci pour votre évaluation !</p>
                  ) : (
                    <div className="flex items-center gap-4">
                      <RatingStars value={driverRating} onChange={setDriverRating} />
                      <button onClick={handleRateDriver} disabled={!driverRating}
                        className="ml-auto font-syne text-xs font-bold px-4 py-2 rounded-xl bg-forest text-cream disabled:opacity-30 hover:bg-forest-light transition-colors">
                        Valider
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Shop rating */}
              {order.status === 'DELIVERED' && (
                <div className="p-4 bg-safran/5 rounded-2xl">
                  <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 mb-3">
                    {shopRatingDone ? 'Boutique notée' : 'Noter la boutique'}
                  </p>
                  {shopRatingDone ? (
                    <p className="font-dm text-sm text-charcoal/60">Merci pour votre avis !</p>
                  ) : (
                    <div className="flex items-center gap-4">
                      <RatingStars value={shopRating} onChange={setShopRating} />
                      <button
                        onClick={async () => { await onRateShop(order, shopRating); setShopRatingDone(true) }}
                        disabled={!shopRating}
                        className="ml-auto font-syne text-xs font-bold px-4 py-2 rounded-xl bg-safran text-white disabled:opacity-30 hover:bg-safran/90 transition-colors">
                        Valider
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Cancel CTA */}
              {(isPending || isConfirmed) && (
                confirmCancel ? (
                  <div className="flex items-center gap-2">
                    <span className="font-dm text-sm text-charcoal/60 flex-1">Annuler cette commande ?</span>
                    <button onClick={() => { setConfirmCancel(false); onCancel(order.id) }}
                      className="px-4 py-2 bg-red-500 text-white font-syne font-bold text-xs rounded-xl hover:bg-red-600 transition-colors">
                      Confirmer
                    </button>
                    <button onClick={() => setConfirmCancel(false)}
                      className="px-4 py-2 border-2 border-charcoal/15 font-syne text-xs text-charcoal/50 rounded-xl hover:border-charcoal/30 transition-colors">
                      Non
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmCancel(true)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-red-300 text-red-500 font-syne font-bold text-sm py-3 rounded-2xl hover:bg-red-50 transition-colors">
                    <X size={16} /> Annuler la commande
                  </button>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function MyOrdersPage() {
  usePageTitle('Mes commandes')

  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [disputeTarget, setDisputeTarget] = useState(null)
  const [cancelError, setCancelError] = useState(null)
  const [rateError, setRateError] = useState(null)
  const successId = params.get('success')

  const loadData = async () => {
    try {
      const [ords, disps] = await Promise.all([
        api.get('/orders/my'),
        api.get('/disputes/my'),
      ])
      setOrders(ords)
      setDisputes(disps)
    } catch {
      // silencieux
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) { navigate('/auth'); return }
    loadData()
    const interval = setInterval(loadData, 20000)
    return () => clearInterval(interval)
  }, [user])

  const handleReview = (order) => {
    const slug = order.items?.[0]?.product?.slug
    if (slug) navigate(`/product/${slug}`)
  }

  const handleCancel = async (orderId) => {
    setCancelError(null)
    try {
      await api.delete(`/orders/${orderId}`)
      setOrders(prev => prev.map(o => o.id === orderId
        ? { ...o, status: 'CANCELLED', statusHistory: [...(o.statusHistory || []), { id: Date.now(), status: 'CANCELLED', note: "Annulée par l'acheteur", createdAt: new Date().toISOString() }] }
        : o
      ))
    } catch (e) {
      setCancelError(e.message || "Erreur lors de l'annulation")
    }
  }

  const handleRateDriver = async (orderId, rating) => {
    setRateError(null)
    try {
      await api.post(`/orders/${orderId}/rate-driver`, { rating })
    } catch (e) {
      setRateError(e.message || 'Erreur lors de la notation')
    }
  }

  const handleRateShop = async (order, rating) => {
    setRateError(null)
    try {
      await api.post('/shop-reviews', { shopId: order.shopId, orderId: order.id, rating })
    } catch (e) {
      setRateError(e.message || 'Erreur lors de la notation')
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 pt-24 pb-16">
        <div className="mb-8">
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Mon espace</p>
          <h1 className="font-playfair text-4xl font-bold text-charcoal">Mes commandes</h1>
        </div>

        {/* Error banners */}
        {cancelError && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 font-dm text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            <span className="flex-1">{cancelError}</span>
            <button onClick={() => setCancelError(null)} aria-label="Fermer"><X size={14} /></button>
          </div>
        )}
        {rateError && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 font-dm text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            <span className="flex-1">{rateError}</span>
            <button onClick={() => setRateError(null)} aria-label="Fermer"><X size={14} /></button>
          </div>
        )}

        {/* Success banner */}
        <AnimatePresence>
          {successId && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 bg-green-50 border-2 border-green-200 rounded-2xl p-5 flex items-start gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-syne font-bold text-green-800">Commande {fmtOrderId(successId)} confirmée !</p>
                <p className="font-dm text-sm text-green-600">Le vendeur a été notifié. Vous serez livré dans les prochaines heures.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-3xl h-32 animate-pulse shadow-card" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24">
            <Package size={48} className="mx-auto text-charcoal/20 mb-4" />
            <h2 className="font-playfair text-2xl font-bold text-charcoal mb-2">Aucune commande</h2>
            <p className="font-dm text-charcoal/50 mb-6">Commencez par parcourir notre catalogue.</p>
            <Link to="/shop" className="btn-primary">Découvrir les produits</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                disputes={disputes}
                onReview={handleReview}
                onCancel={handleCancel}
                onRateDriver={handleRateDriver}
                onRateShop={handleRateShop}
                onDispute={setDisputeTarget}
              />
            ))}
          </div>
        )}
      </div>
      <Footer />

      {/* Modal litige */}
      <AnimatePresence>
        {disputeTarget && (
          <DisputeModal
            order={disputeTarget}
            onClose={() => setDisputeTarget(null)}
            onSubmitted={loadData}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
