import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/client'
import { MapPin, CheckCircle2, AlertCircle, Package, Route as RouteIcon } from 'lucide-react'

const STATUS_LABEL = {
  PENDING_PICKUP: 'À récupérer', PICKED_UP: 'En route', IN_TRANSIT: 'En route',
  ARRIVED: 'Arrivé', QR_SCANNED: 'QR vérifié', DELIVERED: 'Livré', FAILED: 'Échec',
}
const STATUS_COLOR = {
  PENDING_PICKUP: 'bg-gray-100 text-gray-500', PICKED_UP: 'bg-blue-100 text-blue-700', IN_TRANSIT: 'bg-blue-100 text-blue-700',
  ARRIVED: 'bg-amber-100 text-amber-700', QR_SCANNED: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-green-100 text-green-700', FAILED: 'bg-red-100 text-red-700',
}

// LOT 11 (Arbitrage XXX RIZ) : écran manquant depuis le LOT7 — l'admin pouvait
// déjà créer/gérer une tournée (LogisticsAdminTab.jsx), mais le livreur n'avait
// AUCUN moyen de la voir ni d'avancer d'arrêt en arrêt. Volontairement plus
// sobre que DeliveryTab.jsx (pas de scanner QR par arrêt — irréaliste
// d'embarquer N caméras simultanées dans une seule liste) : la progression
// PENDING_PICKUP→ARRIVED reste identique, la clôture finale passe par le code
// de secours (OTP), un chemin déjà pleinement indépendant et testé (LOT3/5) —
// jamais un raccourci qui contournerait la preuve de livraison.
function stopStatusUrl(shipment) {
  return shipment.orderId
    ? `/drivers/delivery/${shipment.orderId}/status`
    : `/drivers/delivery/b2b/${shipment.b2bTransactionId}/status`
}

function StopCard({ stop, routeId, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showOtp, setShowOtp] = useState(false)
  const [otp, setOtp] = useState('')

  const shipment = stop.shipment
  const label = shipment.orderId ? `Commande #${shipment.orderId}` : `Transaction B2B #${shipment.b2bTransactionId}`

  const advanceShipment = async (status, extra = {}) => {
    setBusy(true); setError(null)
    try {
      await api.put(stopStatusUrl(shipment), { status, ...extra })
      // La livraison "arrive" au sens Shipment (ARRIVED) déclenche aussi le
      // passage de l'ARRÊT lui-même à ARRIVED (bascule la tournée en
      // IN_PROGRESS côté serveur) — best-effort : si déjà fait (double clic,
      // ou l'admin a modifié la tournée entretemps), l'erreur est ignorée,
      // elle ne bloque jamais la vraie progression de la livraison.
      if (status === 'ARRIVED' && stop.status === 'PENDING') {
        await api.put(`/drivers/routes/${routeId}/stops/${stop.id}/arrive`, {}).catch(() => {})
      }
      onChanged()
    } catch (err) { setError(err.message || 'Erreur') }
    finally { setBusy(false) }
  }

  const closeStop = async () => {
    setBusy(true); setError(null)
    try {
      await api.put(`/drivers/routes/${routeId}/stops/${stop.id}/complete`, {})
      onChanged()
    } catch (err) { setError(err.message || 'Erreur') }
    finally { setBusy(false) }
  }

  const confirmWithOtp = async () => {
    if (otp.trim().length !== 4) return
    await advanceShipment('DELIVERED', { otp: otp.trim() })
    setShowOtp(false); setOtp('')
  }

  const isStopTerminal = ['COMPLETED', 'FAILED'].includes(stop.status)

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-card space-y-3 ${isStopTerminal ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-syne text-xs font-bold text-charcoal/40">Arrêt #{stop.order}</p>
          <p className="font-dm text-sm font-semibold text-charcoal">{label}</p>
          <p className="font-dm text-xs text-charcoal/50 flex items-center gap-1 mt-0.5">
            <MapPin size={11} /> {shipment.dropoffAddress}
          </p>
        </div>
        <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[shipment.status] || 'bg-gray-100 text-gray-400'}`}>
          {STATUS_LABEL[shipment.status] || shipment.status}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertCircle size={12} className="text-red-500 shrink-0" />
          <p className="font-dm text-xs text-red-600 flex-1">{error}</p>
        </div>
      )}

      {!isStopTerminal && shipment.status === 'PENDING_PICKUP' && (
        <button onClick={() => advanceShipment('IN_TRANSIT')} disabled={busy}
          className="w-full flex items-center justify-center gap-2 font-syne font-bold text-sm py-2.5 rounded-xl bg-forest text-cream hover:bg-forest-light disabled:opacity-60">
          <Package size={14} /> Colis récupéré · En route
        </button>
      )}
      {!isStopTerminal && ['PICKED_UP', 'IN_TRANSIT'].includes(shipment.status) && (
        <button onClick={() => advanceShipment('ARRIVED')} disabled={busy}
          className="w-full flex items-center justify-center gap-2 font-syne font-bold text-sm py-2.5 rounded-xl bg-forest text-cream hover:bg-forest-light disabled:opacity-60">
          <MapPin size={14} /> Je suis arrivé
        </button>
      )}
      {!isStopTerminal && ['ARRIVED', 'QR_SCANNED'].includes(shipment.status) && !showOtp && (
        <button onClick={() => setShowOtp(true)} disabled={busy}
          className="w-full flex items-center justify-center gap-2 font-syne font-bold text-sm py-2.5 rounded-xl bg-green-500 text-cream hover:bg-green-600 disabled:opacity-60">
          <CheckCircle2 size={14} /> Confirmer avec le code de secours
        </button>
      )}
      {showOtp && (
        <div className="flex gap-2">
          <input type="text" inputMode="numeric" maxLength={4} value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="0000"
            className="flex-1 text-center font-syne text-lg font-bold tracking-widest py-2 rounded-xl border-2 border-charcoal/10 focus:border-forest outline-none" />
          <button onClick={confirmWithOtp} disabled={busy || otp.length !== 4}
            className="px-4 rounded-xl bg-green-500 text-cream font-syne text-xs font-bold disabled:opacity-50">OK</button>
        </div>
      )}

      {['DELIVERED', 'FAILED'].includes(shipment.status) && !isStopTerminal && (
        <button onClick={closeStop} disabled={busy}
          className="w-full flex items-center justify-center gap-2 font-syne font-bold text-sm py-2.5 rounded-xl bg-charcoal text-cream hover:bg-charcoal/80 disabled:opacity-60">
          Clôturer cet arrêt de la tournée
        </button>
      )}
    </div>
  )
}

export default function RouteTab() {
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    api.get('/drivers/routes/active')
      .then(({ route }) => setRoute(route))
      .catch(() => setRoute(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 20000)
    return () => clearInterval(iv)
  }, [load])

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
    </div>
  )

  if (!route) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <RouteIcon size={48} className="text-charcoal/15 mb-4" />
      <h2 className="font-playfair text-2xl font-bold text-charcoal mb-2">Aucune tournée en cours</h2>
      <p className="font-dm text-charcoal/50 max-w-xs">Une tournée à plusieurs arrêts vous sera assignée ici par l'administration si nécessaire.</p>
    </div>
  )

  const sortedStops = [...route.stops].sort((a, b) => a.order - b.order)
  const completedCount = sortedStops.filter(s => ['COMPLETED', 'FAILED'].includes(s.status)).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-playfair text-2xl font-bold text-charcoal">Ma tournée</h2>
        <span className="font-syne text-xs font-bold text-charcoal/40">{completedCount}/{sortedStops.length} arrêts terminés</span>
      </div>
      <div className="space-y-3">
        {sortedStops.map(stop => (
          <StopCard key={stop.id} stop={stop} routeId={route.id} onChanged={load} />
        ))}
      </div>
    </div>
  )
}
