import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../../api/client'
import { fmt, fmtDate, STATUS_LABELS, fmtOrderId } from '../../utils/status'
import {
  Phone, MapPin, Package, Navigation, CheckCircle2,
  Radio, Banknote, CreditCard, StickyNote,
  Store, User, Clock, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'

const PAYMENT_LABELS = {
  CASH_ON_DELIVERY: { label: 'Paiement en espèces à la livraison', icon: Banknote, color: 'bg-amber-50 text-amber-800 border-amber-200' },
  MOBILE_MONEY:     { label: 'Mobile Money (déjà payé)',            icon: CreditCard, color: 'bg-blue-50 text-blue-800 border-blue-200' },
  CARD:             { label: 'Carte bancaire (déjà payé)',          icon: CreditCard, color: 'bg-blue-50 text-blue-800 border-blue-200' },
}

function InfoRow({ icon: Icon, label, value, href, iconColor = 'text-charcoal/40' }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-charcoal/5 last:border-0">
      <Icon size={15} className={`mt-0.5 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="font-syne text-[10px] font-bold tracking-wider uppercase text-charcoal/35">{label}</p>
        {href ? (
          <a href={href} className="font-dm text-sm text-forest font-semibold hover:underline">{value}</a>
        ) : (
          <p className="font-dm text-sm text-charcoal">{value}</p>
        )}
      </div>
    </div>
  )
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-3xl shadow-card overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-charcoal/2 transition-colors">
        <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50">{title}</p>
        {open ? <ChevronUp size={14} className="text-charcoal/30" /> : <ChevronDown size={14} className="text-charcoal/30" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// LOT 3 (Arbitrage XXX RIZ) : scanner de QR — absent jusqu'ici, tout se
// faisait par saisie de code. html5-qrcode gère la demande de permission
// caméra et le décodage ; on ne fait que réagir au premier scan valide et
// arrêter immédiatement le flux vidéo (`hasScanned`, sinon la caméra
// continue de décoder pendant l'appel réseau et peut redéclencher onScan
// plusieurs fois pour le même QR).
function QrScanner({ onScan, onClose }) {
  const hasScannedRef = useRef(false)
  // html5-qrcode's stop() peut lever une exception SYNCHRONE (pas seulement
  // une promesse rejetée) si le scanner n'a jamais réellement démarré (ex.
  // permission caméra refusée) — un .catch() seul ne protège pas contre ça,
  // et une exception non interceptée dans un useEffect fait planter tout
  // l'arbre React (constaté en le testant : ErrorBoundary déclenchée,
  // "Cannot stop, scanner is not running or paused"). D'où ce garde-fou
  // explicite (hasStartedRef) EN PLUS d'un try/catch synchrone.
  const hasStartedRef = useRef(false)
  const [error, setError] = useState(null)

  const safeStop = (qr) => {
    if (!hasStartedRef.current) return
    try { qr.stop().catch(() => {}) } catch { /* déjà arrêté ou jamais démarré */ }
  }

  useEffect(() => {
    const qr = new Html5Qrcode('qr-reader')
    let stopped = false
    qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 220 },
      (decodedText) => {
        if (hasScannedRef.current || stopped) return
        hasScannedRef.current = true
        safeStop(qr)
        onScan(decodedText)
      },
      () => {} // pas de QR détecté sur cette frame — pas une erreur
    ).then(() => { hasStartedRef.current = true })
      .catch(() => setError('Caméra indisponible — vérifiez les autorisations du navigateur.'))

    return () => { stopped = true; safeStop(qr) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="bg-white rounded-3xl shadow-card p-5 space-y-3">
      <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50">Scanner le QR du client</p>
      {error ? (
        <p className="font-dm text-sm text-red-600">{error}</p>
      ) : (
        <div id="qr-reader" className="rounded-2xl overflow-hidden" />
      )}
      <button onClick={onClose}
        className="w-full font-syne font-bold text-sm py-3 rounded-2xl border-2 border-charcoal/10 text-charcoal/60 hover:bg-charcoal/5 transition-colors">
        Annuler
      </button>
    </div>
  )
}

export default function DeliveryTab({ onDelivered }) {
  const [order, setOrder] = useState(null)
  const [commission, setCommission] = useState(0.15)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [advanceError, setAdvanceError] = useState(null)
  const [showOtpInput, setShowOtpInput] = useState(false)
  const [otp, setOtp] = useState('')
  const [showFailInput, setShowFailInput] = useState(false)
  const [failReason, setFailReason] = useState('')
  const [gpsActive, setGpsActive] = useState(false)
  const [gpsDenied, setGpsDenied] = useState(false)
  // LOT 3 (Arbitrage XXX RIZ) : sous-état Shipment (ARRIVED/QR_SCANNED),
  // invisible jusqu'ici côté driver — GET /drivers/active-delivery ne
  // renvoyait que Order.status, insuffisant pour savoir si le QR a déjà été
  // généré ou scanné.
  const [shipmentStatus, setShipmentStatus] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const gpsRef = useRef(null)

  const load = useCallback(() => {
    api.get('/drivers/active-delivery')
      .then(({ order, commission, shipmentStatus }) => {
        setOrder(order)
        setCommission(commission)
        setShipmentStatus(shipmentStatus)
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 20000)
    return () => clearInterval(iv)
  }, [load])

  // ── GPS : envoi position toutes les 30s quand IN_TRANSIT ──────────────────
  useEffect(() => {
    if (!order || order.status !== 'IN_TRANSIT') {
      setGpsActive(false)
      setGpsDenied(false)
      if (gpsRef.current) { clearInterval(gpsRef.current); gpsRef.current = null }
      return
    }
    const sendLocation = () => {
      if (!navigator.geolocation) { setGpsDenied(true); return }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsDenied(false)
          api.post('/drivers/location', {
            lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, orderId: order.id,
          }).then(() => setGpsActive(true)).catch(() => setGpsActive(false))
        },
        (err) => {
          setGpsActive(false)
          if (err.code === err.PERMISSION_DENIED) setGpsDenied(true)
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    }
    sendLocation()
    gpsRef.current = setInterval(sendLocation, 30000)
    return () => { if (gpsRef.current) { clearInterval(gpsRef.current); gpsRef.current = null }; setGpsActive(false) }
  }, [order?.id, order?.status])

  // LOT 9 : passer à DELIVERED exige désormais le code communiqué par
  // l'acheteur (preuve de livraison) — l'appel n'est déclenché qu'après
  // saisie, via handleConfirmDelivery ci-dessous.
  const advance = async () => {
    if (!order) return
    const next = order.status === 'PRET' || order.status === 'CONFIRMED' ? 'IN_TRANSIT' : 'DELIVERED'
    if (next === 'DELIVERED') { setShowOtpInput(true); setAdvanceError(null); return }
    setUpdating(true); setAdvanceError(null)
    try {
      await api.put(`/drivers/delivery/${order.id}/status`, { status: next })
      load()
    } catch (err) { setAdvanceError(err.message || 'Erreur lors de la mise à jour') }
    finally { setUpdating(false) }
  }

  const confirmDelivery = async () => {
    if (!order || otp.trim().length !== 4) return
    setUpdating(true); setAdvanceError(null)
    try {
      await api.put(`/drivers/delivery/${order.id}/status`, { status: 'DELIVERED', otp: otp.trim() })
      setShowOtpInput(false); setOtp('')
      if (onDelivered) onDelivered()
      // LOT 17 : GET /drivers/active-delivery ne renvoie QUE PRET/CONFIRMED/
      // IN_TRANSIT — un load() immédiat ici renvoie order:null et l'écran
      // "Livraison réussie !" ci-dessous n'apparaît alors jamais, remplacé
      // instantanément par l'état vide "Aucune livraison en cours" (trouvé
      // par le premier test E2E de ce programme, jamais par les tests
      // d'intégration API). Mise à jour locale optimiste : on sait déjà que
      // ça a réussi, pas besoin de re-fetch pour l'afficher ; le poll
      // périodique (20s) fera naturellement retomber sur l'état vide ensuite.
      setOrder(prev => (prev ? { ...prev, status: 'DELIVERED' } : prev))
    } catch (err) { setAdvanceError(err.message || 'Code incorrect') }
    finally { setUpdating(false) }
  }

  // LOT 10 : signaler un échec — absent jusqu'ici, le livreur n'avait aucune
  // échappatoire face à un client injoignable ou une adresse introuvable.
  const reportFailure = async () => {
    if (!order || !failReason.trim()) return
    setUpdating(true); setAdvanceError(null)
    try {
      await api.put(`/drivers/delivery/${order.id}/status`, { status: 'FAILED', failureReason: failReason.trim() })
      setShowFailInput(false); setFailReason('')
      load()
    } catch (err) { setAdvanceError(err.message || 'Erreur lors du signalement') }
    finally { setUpdating(false) }
  }

  // LOT 3 : mécanisme PRINCIPAL de preuve de livraison — génère le QR côté
  // serveur, affiché à l'acheteur (jamais renvoyé ici). Le code de secours
  // (OTP, LOT9) reste accessible indépendamment via showOtpInput.
  const markArrived = async () => {
    if (!order) return
    setUpdating(true); setAdvanceError(null)
    try {
      await api.put(`/drivers/delivery/${order.id}/status`, { status: 'ARRIVED' })
      load()
    } catch (err) { setAdvanceError(err.message || 'Erreur lors de la mise à jour') }
    finally { setUpdating(false) }
  }

  const onQrScanned = async (decodedText) => {
    if (!order) return
    setUpdating(true); setAdvanceError(null)
    try {
      await api.put(`/drivers/delivery/${order.id}/status`, { status: 'QR_SCANNED', qrToken: decodedText })
      setShowScanner(false)
      load()
    } catch (err) { setAdvanceError(err.message || 'QR invalide ou expiré'); setShowScanner(false) }
    finally { setUpdating(false) }
  }

  const mapsUrl = (address) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`
  const coordsUrl = (lat, lng) =>
    `https://www.google.com/maps?q=${lat},${lng}`

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
    </div>
  )

  if (!order) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-4">📭</div>
      <h2 className="font-playfair text-2xl font-bold text-charcoal mb-2">Aucune livraison en cours</h2>
      <p className="font-dm text-charcoal/50 max-w-xs">Acceptez une offre dans l'onglet Offres pour commencer une livraison.</p>
    </div>
  )

  const isDelivered = order.status === 'DELIVERED'
  const canAdvance = ['PRET', 'CONFIRMED', 'IN_TRANSIT'].includes(order.status)
  const nextStatus = order.status === 'IN_TRANSIT' ? 'DELIVERED'
    : (order.status === 'PRET' || order.status === 'CONFIRMED') ? 'IN_TRANSIT' : null
  const gain = Math.round(order.deliveryFee * commission)
  const payment = PAYMENT_LABELS[order.paymentMethod] || PAYMENT_LABELS.CASH_ON_DELIVERY
  const PayIcon = payment.icon
  const isCash = order.paymentMethod === 'CASH_ON_DELIVERY' || !order.paymentMethod

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="font-playfair text-2xl font-bold text-charcoal">Livraison en cours</h2>
        <div className="flex items-center gap-2">
          {order?.status === 'IN_TRANSIT' && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-syne font-bold ${
              gpsActive ? 'bg-green-100 text-green-700' : 'bg-charcoal/8 text-charcoal/40'
            }`}>
              <Radio size={11} className={gpsActive ? 'animate-pulse' : ''} />
              {gpsActive ? 'GPS actif' : 'GPS…'}
            </div>
          )}
          <span className="font-syne text-xs font-bold text-forest bg-forest/10 px-3 py-1 rounded-full animate-pulse">Live</span>
        </div>
      </div>

      {/* ── Alerte GPS refusé ── */}
      {gpsDenied && order?.status === 'IN_TRANSIT' && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <Radio size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-syne text-xs font-bold text-amber-800">Géolocalisation désactivée</p>
            <p className="font-dm text-xs text-amber-700 mt-0.5">
              Activez la localisation dans les paramètres de votre navigateur pour partager votre position en temps réel.
            </p>
          </div>
        </div>
      )}

      {/* ── Résumé commande ── */}
      <div className="bg-forest rounded-3xl p-5 text-cream">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="font-syne text-xs font-bold uppercase tracking-wider text-cream/50 mb-0.5">Commande</p>
            <p className="font-playfair text-3xl font-bold">{fmtOrderId(order.id, order.createdAt)}</p>
            <p className={`mt-1 inline-flex items-center gap-1.5 font-syne text-xs font-bold px-2.5 py-1 rounded-full ${
              order.status === 'IN_TRANSIT' ? 'bg-blue-500/30 text-blue-100' :
              order.status === 'PRET'       ? 'bg-safran/30 text-safran'     : 'bg-white/10 text-cream/70'
            }`}>
              {STATUS_LABELS[order.status] || order.status}
            </p>
          </div>
          <div className="text-right">
            <p className="font-dm text-xs text-cream/50 mb-0.5">Votre gain</p>
            <p className="font-playfair text-3xl font-bold text-safran">{fmt(gain)} F</p>
            <p className="font-dm text-xs text-cream/40 mt-0.5">sur {fmt(order.deliveryFee)} F de frais</p>
          </div>
        </div>

        {/* Paiement — info critique */}
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border ${payment.color}`}>
          <PayIcon size={16} className="shrink-0" />
          <div>
            <p className="font-syne text-xs font-bold">{payment.label}</p>
            {isCash && (
              <p className="font-dm text-xs mt-0.5">
                À encaisser : <span className="font-bold">{fmt(order.total + order.deliveryFee)} FCFA</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Récupération (shop) ── */}
      <Section title="📦 Point de récupération">
        <InfoRow icon={Store}     label="Boutique"   value={order.shop?.name} iconColor="text-forest" />
        <InfoRow icon={MapPin}    label="Adresse"    value={order.shop?.location}
          href={order.shop?.latitude ? coordsUrl(order.shop.latitude, order.shop.longitude) : mapsUrl(order.shop?.location || '')} />
        <InfoRow icon={Phone}     label="Téléphone"  value={order.shop?.phone}  href={`tel:${order.shop?.phone}`} iconColor="text-forest" />
        <div className="mt-3">
          <a href={order.shop?.latitude
              ? coordsUrl(order.shop.latitude, order.shop.longitude)
              : mapsUrl(order.shop?.location || '')}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 bg-forest text-cream font-syne text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-forest-light transition-colors">
            <Navigation size={13} /> Itinéraire vers la boutique
          </a>
        </div>
      </Section>

      {/* ── Livraison (acheteur) ── */}
      <Section title="🏠 Point de livraison">
        <InfoRow icon={User}   label="Client"    value={order.buyer?.name} iconColor="text-terra" />
        <InfoRow icon={MapPin} label="Adresse"   value={order.address} href={mapsUrl(order.address)} />
        <InfoRow icon={Phone}  label="Téléphone" value={order.buyer?.phone} href={`tel:${order.buyer?.phone}`} iconColor="text-terra" />
        {order.note && (
          <div className="mt-3 p-3 bg-safran/8 rounded-2xl border border-safran/15">
            <div className="flex items-center gap-1.5 mb-1">
              <StickyNote size={12} className="text-safran-dark" />
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-safran-dark">Instructions du client</p>
            </div>
            <p className="font-dm text-sm text-charcoal italic">"{order.note}"</p>
          </div>
        )}
        <div className="mt-3">
          <a href={mapsUrl(order.address)} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 bg-terra/90 text-cream font-syne text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-terra transition-colors">
            <Navigation size={13} /> Itinéraire vers le client
          </a>
        </div>
      </Section>

      {/* ── Articles ── */}
      <Section title="🛒 Articles à livrer">
        <div className="space-y-0 divide-y divide-charcoal/5">
          {order.items?.map(item => (
            <div key={item.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="font-dm text-sm text-charcoal font-medium">{item.quantity}× {item.name || item.product?.name}</p>
                {item.product?.unit && <p className="font-dm text-xs text-charcoal/40">{item.product.unit}</p>}
              </div>
              <p className="font-syne text-sm font-bold text-charcoal">{fmt(item.price * item.quantity)} F</p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-charcoal/8 space-y-1">
          <div className="flex justify-between">
            <p className="font-dm text-sm text-charcoal/60">Produits</p>
            <p className="font-syne text-sm font-semibold text-charcoal">{fmt(order.total)} F</p>
          </div>
          <div className="flex justify-between">
            <p className="font-dm text-sm text-charcoal/60">Livraison</p>
            <p className="font-syne text-sm font-semibold text-charcoal">{fmt(order.deliveryFee)} F</p>
          </div>
          {isCash && (
            <div className="flex justify-between pt-2 border-t border-charcoal/8 mt-1">
              <p className="font-syne text-sm font-bold text-charcoal">💵 Total à encaisser</p>
              <p className="font-playfair text-lg font-bold text-charcoal">{fmt(order.total + order.deliveryFee)} F</p>
            </div>
          )}
        </div>
      </Section>

      {/* ── Historique ── */}
      <Section title="📋 Historique" defaultOpen={false}>
        <div className="space-y-2">
          {order.statusHistory?.map(h => (
            <div key={h.id} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-forest mt-1.5 shrink-0" />
              <div>
                <p className="font-syne text-xs font-bold text-charcoal">{STATUS_LABELS[h.status] || h.status}</p>
                {h.note && <p className="font-dm text-xs text-charcoal/50">{h.note}</p>}
                <p className="font-dm text-[10px] text-charcoal/30">{fmtDate(h.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {advanceError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{advanceError}</p>
          <button onClick={() => setAdvanceError(null)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}

      {/* ── CTA principal ──
          Ni mode="wait", ni même `exit` sur ces panneaux : AnimatePresence
          retarde le démontage d'un élément SORTANT jusqu'à la fin de SA
          PROPRE animation `exit`, indépendamment du mode — si cette
          animation ne se termine jamais (onglet en arrière-plan, livreur qui
          bascule sur ses SMS pour lire le code ; constaté aussi en testant :
          l'ancien panneau reste affiché EN PLUS du nouveau, indéfiniment,
          même une fois le state React correct), le livreur reste bloqué sur
          un écran obsolète. Ces panneaux sont des étapes FONCTIONNELLES d'un
          parcours de livraison, pas une décoration — la fiabilité prime sur
          le fondu de sortie. `initial`/`animate` suffisent pour une entrée
          soignée ; pas besoin d'AnimatePresence du tout sans `exit` à
          coordonner. */}
      <>
        {!isDelivered && canAdvance && showOtpInput && (
          <motion.div key="otp"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-card p-5 space-y-3">
            <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50">Code de livraison</p>
            <p className="font-dm text-sm text-charcoal/60">Demandez au client le code à 4 chiffres reçu par e-mail.</p>
            <input
              type="text" inputMode="numeric" maxLength={4} value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
              className="w-full text-center font-syne text-3xl font-bold tracking-[0.5em] py-3 rounded-2xl border-2 border-charcoal/10 focus:border-forest outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowOtpInput(false); setOtp(''); setAdvanceError(null) }}
                className="flex-1 font-syne font-bold text-sm py-3 rounded-2xl border-2 border-charcoal/10 text-charcoal/60 hover:bg-charcoal/5 transition-colors">
                Annuler
              </button>
              <button onClick={confirmDelivery} disabled={updating || otp.length !== 4}
                className="flex-[2] flex items-center justify-center gap-2 font-syne font-bold text-sm py-3 rounded-2xl bg-green-500 text-cream hover:bg-green-600 disabled:opacity-50 transition-colors">
                {updating
                  ? <div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                  : <><CheckCircle2 size={16} /> Confirmer</>}
              </button>
            </div>
          </motion.div>
        )}

        {!isDelivered && canAdvance && showFailInput && (
          <motion.div key="fail"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-card p-5 space-y-3">
            <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50">Signaler un échec de livraison</p>
            <textarea
              rows={3} value={failReason} onChange={e => setFailReason(e.target.value)}
              placeholder="Ex : client injoignable, adresse introuvable, refus de réception…"
              className="w-full text-sm p-3 rounded-2xl border-2 border-charcoal/10 focus:border-red-400 outline-none resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowFailInput(false); setFailReason(''); setAdvanceError(null) }}
                className="flex-1 font-syne font-bold text-sm py-3 rounded-2xl border-2 border-charcoal/10 text-charcoal/60 hover:bg-charcoal/5 transition-colors">
                Annuler
              </button>
              <button onClick={reportFailure} disabled={updating || !failReason.trim()}
                className="flex-[2] flex items-center justify-center gap-2 font-syne font-bold text-sm py-3 rounded-2xl bg-red-500 text-cream hover:bg-red-600 disabled:opacity-50 transition-colors">
                {updating
                  ? <div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                  : <><AlertCircle size={16} /> Signaler l'échec</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* LOT 3 : scanner de QR — remplace temporairement le CTA pendant le scan. */}
        {!isDelivered && canAdvance && showScanner && (
          <motion.div key="scanner" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <QrScanner onScan={onQrScanned} onClose={() => setShowScanner(false)} />
          </motion.div>
        )}

        {!isDelivered && canAdvance && !showOtpInput && !showFailInput && !showScanner && (
          <motion.div key="cta" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            {nextStatus !== 'DELIVERED' ? (
              <button onClick={advance} disabled={updating}
                className="w-full flex items-center justify-center gap-2 font-syne font-bold text-base py-4 rounded-2xl bg-forest text-cream hover:bg-forest-light transition-all disabled:opacity-60">
                {updating
                  ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                  : <><Package size={20} /> Colis récupéré · En route</>}
              </button>
            ) : shipmentStatus === 'ARRIVED' ? (
              <button onClick={() => setShowScanner(true)} disabled={updating}
                className="w-full flex items-center justify-center gap-2 font-syne font-bold text-base py-4 rounded-2xl bg-green-500 text-cream hover:bg-green-600 transition-all disabled:opacity-60">
                <CheckCircle2 size={20} /> Scanner le QR du client
              </button>
            ) : shipmentStatus === 'QR_SCANNED' ? (
              <>
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                  <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                  <p className="font-dm text-sm text-green-700">QR vérifié — finalisez avec le code de secours ci-dessous.</p>
                </div>
                <button onClick={() => setShowOtpInput(true)} disabled={updating}
                  className="w-full flex items-center justify-center gap-2 font-syne font-bold text-base py-4 rounded-2xl bg-green-500 text-cream hover:bg-green-600 transition-all disabled:opacity-60">
                  <CheckCircle2 size={20} /> Confirmer la livraison
                </button>
              </>
            ) : (
              <button onClick={markArrived} disabled={updating}
                className="w-full flex items-center justify-center gap-2 font-syne font-bold text-base py-4 rounded-2xl bg-forest text-cream hover:bg-forest-light transition-all disabled:opacity-60">
                {updating
                  ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                  : <><MapPin size={20} /> Je suis arrivé</>}
              </button>
            )}
            {nextStatus === 'DELIVERED' && shipmentStatus !== 'QR_SCANNED' && (
              <button onClick={() => setShowOtpInput(true)}
                className="w-full text-center font-dm text-xs text-charcoal/40 hover:text-forest transition-colors py-1">
                Confirmer avec un code de secours à la place
              </button>
            )}
            {nextStatus === 'DELIVERED' && (
              <button onClick={() => setShowFailInput(true)}
                className="w-full text-center font-dm text-xs text-charcoal/40 hover:text-red-500 transition-colors py-1">
                Signaler un problème avec cette livraison
              </button>
            )}
          </motion.div>
        )}

        {isDelivered && (
          <motion.div key="done"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-green-50 border-2 border-green-200 rounded-3xl p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-playfair text-xl font-bold text-green-800">Livraison réussie !</p>
            <p className="font-dm text-sm text-green-600 mt-1">
              Gain encaissé : <span className="font-bold">{fmt(gain)} FCFA</span>
            </p>
          </motion.div>
        )}
      </>
    </div>
  )
}
