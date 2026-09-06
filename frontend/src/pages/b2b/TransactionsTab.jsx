import { useEffect, useState } from 'react'
import { AlertCircle, DollarSign, Truck, CheckCircle, MapPin, FileText, Download } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import DOMPurify from 'dompurify'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

const SHIPMENT_LABEL = {
  PENDING_PICKUP: 'En attente du livreur', PICKED_UP: 'Colis récupéré', IN_TRANSIT: 'En route',
  ARRIVED: 'Livreur arrivé', QR_SCANNED: 'QR vérifié', DELIVERED: 'Livrée', FAILED: 'Échec de livraison',
}
const SHIPMENT_COLOR = {
  PENDING_PICKUP: 'text-charcoal/40 bg-charcoal/5', PICKED_UP: 'text-blue-600 bg-blue-50', IN_TRANSIT: 'text-blue-600 bg-blue-50',
  ARRIVED: 'text-amber-600 bg-amber-50', QR_SCANNED: 'text-amber-600 bg-amber-50',
  DELIVERED: 'text-green-600 bg-green-50', FAILED: 'text-red-600 bg-red-50',
}

// LOT 11 (Arbitrage XXX RIZ) : le backend savait déjà tout faire (demande de
// livraison LOT2/6, QR/OTP LOT3, confirmation active LOT4/5) mais aucune UI
// acheteur B2B n'existait — cette page ne faisait qu'afficher un statut
// DECLARED/ANNULÉE, ignorant totalement needsLogistics/Shipment. Un acheteur
// B2B ne pouvait donc, en pratique, ni demander de livraison ni suivre/
// confirmer sa réception, malgré un backend complet et testé.
function useB2BTracking(txId, active) {
  const [state, setState] = useState({ shipmentStatus: null, deliveryCode: null, qrToken: null })

  useEffect(() => {
    if (!active || !txId) return
    let cancelled = false
    const poll = () => {
      api.get(`/b2b/transactions/${txId}/track`)
        .then(data => { if (!cancelled) setState(data) })
        .catch(() => {})
    }
    poll()
    const iv = setInterval(poll, 10000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [txId, active])

  return state
}

function RequestLogisticsForm({ tx, onDone }) {
  const [address, setAddress] = useState('')
  const [serviceLevel, setServiceLevel] = useState('STANDARD')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!address.trim()) return
    setSubmitting(true); setError(null)
    try {
      await api.put(`/b2b/transactions/${tx.id}/request-logistics`, { deliveryAddress: address.trim(), serviceLevel })
      onDone()
    } catch (err) { setError(err.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  return (
    <form onSubmit={submit} className="mt-3 pt-3 border-t border-charcoal/8 space-y-2">
      {error && <p className="font-dm text-xs text-red-600">{error}</p>}
      <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Adresse de livraison" required
        className="w-full border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm focus:outline-none focus:border-forest" />
      <div className="flex gap-2">
        <select value={serviceLevel} onChange={e => setServiceLevel(e.target.value)}
          className="border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm focus:outline-none focus:border-forest">
          <option value="ECONOMIC">Économique</option>
          <option value="STANDARD">Standard</option>
          <option value="EXPRESS">Express</option>
        </select>
        <button type="submit" disabled={submitting}
          className="flex-1 bg-forest text-cream font-syne text-xs font-bold rounded-xl px-4 py-2 hover:bg-forest-light disabled:opacity-60">
          {submitting ? '…' : 'Demander la livraison'}
        </button>
      </div>
      <p className="font-dm text-[11px] text-charcoal/40">Le tarif est calculé automatiquement selon la zone et le poids déclaré.</p>
    </form>
  )
}

function ShipmentTracking({ tx, onConfirmed }) {
  const active = !['DELIVERED', 'FAILED', 'CANCELLED'].includes(tx.shipment?.status)
  const { shipmentStatus, deliveryCode, qrToken } = useB2BTracking(tx.id, active)
  const status = shipmentStatus || tx.shipment?.status
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setConfirming(true); setError(null)
    try {
      await api.post(`/b2b/transactions/${tx.id}/confirm-receipt`)
      setConfirmed(true)
      onConfirmed()
    } catch (err) { setError(err.message || 'Erreur') }
    finally { setConfirming(false) }
  }

  return (
    <div className="mt-3 pt-3 border-t border-charcoal/8 space-y-2">
      <div className="flex items-center gap-2">
        <Truck size={13} className="text-charcoal/40" />
        <span className={`font-syne text-[10px] font-bold px-2.5 py-1 rounded-full ${SHIPMENT_COLOR[status] || 'text-charcoal/40 bg-charcoal/5'}`}>
          {SHIPMENT_LABEL[status] || status}
        </span>
        {tx.shipment?.failureReason && <span className="font-dm text-xs text-red-600">({tx.shipment.failureReason})</span>}
      </div>

      {qrToken && (
        <div className="flex flex-col items-center gap-2 bg-safran/10 border border-safran/30 rounded-xl px-3 py-3 max-w-[200px]">
          <p className="font-dm text-xs text-charcoal/70 text-center">
            {status === 'ARRIVED' ? 'Votre livreur est arrivé — présentez ce QR :' : 'Code de vérification :'}
          </p>
          <div className="bg-white p-2 rounded-lg">
            <QRCodeSVG value={qrToken} size={120} data-testid="b2b-delivery-qr" />
          </div>
        </div>
      )}
      {deliveryCode && (
        <div className="flex items-center justify-between gap-2 bg-charcoal/5 border border-charcoal/10 rounded-xl px-3 py-2 max-w-[280px]">
          <p className="font-dm text-xs text-charcoal/60">Code de secours :</p>
          <span data-testid="b2b-delivery-code" className="font-syne text-base font-bold tracking-[0.3em] text-charcoal">{deliveryCode}</span>
        </div>
      )}

      {error && <p className="font-dm text-xs text-red-600">{error}</p>}
      {confirmed ? (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <CheckCircle size={14} className="text-green-600 shrink-0" />
          <p className="font-dm text-xs text-green-700">Merci ! Livraison confirmée.</p>
        </div>
      ) : status === 'QR_SCANNED' && (
        <button onClick={confirm} disabled={confirming}
          className="w-full flex items-center justify-center gap-2 font-syne text-sm font-bold py-2.5 rounded-xl bg-green-500 text-cream hover:bg-green-600 disabled:opacity-60">
          {confirming ? '…' : <><CheckCircle size={14} /> J'ai reçu mon colis</>}
        </button>
      )}
    </div>
  )
}

const downloadInvoice = async (invoice) => {
  const { default: html2pdf } = await import('html2pdf.js')
  await html2pdf()
    .set({
      margin: [15, 15, 15, 15],
      filename: `${invoice.invoiceNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(DOMPurify.sanitize(invoice.content))
    .save()
}

// LOT AUDIT-ACC-01 (audit XXX RIZ) : "la coopérative doit pouvoir gérer les
// factures dans son espace comptabilité... accéder à la commande/vente
// concernée" — directement satisfait ici, pas un onglet séparé (c'est déjà
// la vue de la vente). Réservé au vendeur (jamais visible côté acheteur en
// génération, seulement en consultation une fois émise).
function InvoiceAction({ tx }) {
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/b2b/transactions/${tx.id}/invoice`)
      .then(setInvoice)
      .catch(() => {}) // pas de facture encore émise — état normal, pas une erreur
      .finally(() => setLoading(false))
  }, [tx.id])

  const generate = async () => {
    setError(''); setLoading(true)
    try {
      const created = await api.post(`/b2b/transactions/${tx.id}/invoice`)
      setInvoice(created)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return null
  return (
    <div className="mt-3 pt-3 border-t border-charcoal/8 flex items-center gap-2">
      {error && <p className="font-dm text-xs text-red-600">{error}</p>}
      {invoice ? (
        <button onClick={() => downloadInvoice(invoice)}
          className="flex items-center gap-1.5 font-syne text-xs font-bold text-forest hover:underline">
          <Download size={12} /> Télécharger la facture ({invoice.invoiceNumber})
        </button>
      ) : (
        <button onClick={generate}
          className="flex items-center gap-1.5 font-syne text-xs font-bold text-charcoal/60 hover:text-forest">
          <FileText size={12} /> Générer la facture
        </button>
      )}
    </div>
  )
}

export default function TransactionsTab() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/b2b/transactions')
      setTransactions(data.transactions || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const cancel = async (id) => {
    setBusyId(id)
    try {
      await api.post(`/b2b/transactions/${id}/cancel`)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-playfair text-2xl font-bold text-charcoal">Mes transactions déclarées</h1>
      <p className="font-dm text-sm text-charcoal/40 -mt-4">
        Un simple constat d'accord commercial — aucun paiement ne transite par la plateforme.
      </p>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <DollarSign className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucune transaction déclarée pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map(tx => {
            const iAmBuyer = tx.buyerUserId === user.id
            const canRequestLogistics = iAmBuyer && tx.status === 'DECLARED' && !tx.needsLogistics
            const hasActiveLogistics = tx.needsLogistics && tx.shipment
            return (
              <div key={tx.id} className="bg-white border border-charcoal/10 rounded-2xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-syne font-bold text-charcoal text-sm">
                      {tx.product} — {fmt(tx.quantity)} {tx.unit}
                    </p>
                    <p className="font-dm text-xs text-charcoal/40">
                      {iAmBuyer ? `Vendeur : ${tx.seller.name}` : `Acheteur : ${tx.buyer.name}`} · {fmtDate(tx.createdAt)}
                    </p>
                    {tx.amount != null && <p className="font-dm text-sm text-charcoal/60 mt-1">{fmt(tx.amount)} FCFA</p>}
                    {tx.notes && <p className="font-dm text-xs text-charcoal/40 mt-1 italic">{tx.notes}</p>}
                    {tx.needsLogistics && tx.deliveryAddress && (
                      <p className="font-dm text-xs text-charcoal/40 mt-1 flex items-center gap-1"><MapPin size={11} /> {tx.deliveryAddress}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${
                      tx.status === 'DECLARED' ? 'text-green-600 bg-green-50'
                        : tx.status === 'DELIVERED' ? 'text-green-600 bg-green-50'
                        : tx.status === 'ESCALATED' ? 'text-amber-600 bg-amber-50'
                        : 'text-charcoal/40 bg-charcoal/5'
                    }`}>
                      {tx.status === 'DECLARED' ? 'Déclarée' : tx.status === 'IN_TRANSIT' ? 'En livraison'
                        : tx.status === 'DELIVERED' ? 'Livrée' : tx.status === 'ESCALATED' ? 'Réaffectation en cours' : 'Annulée'}
                    </span>
                    {tx.status === 'DECLARED' && !tx.needsLogistics && (
                      <button onClick={() => cancel(tx.id)} disabled={busyId === tx.id}
                        className="font-syne text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50">
                        {busyId === tx.id ? '…' : 'Annuler'}
                      </button>
                    )}
                  </div>
                </div>

                {canRequestLogistics && <RequestLogisticsForm tx={tx} onDone={load} />}
                {hasActiveLogistics && <ShipmentTracking tx={tx} onConfirmed={load} />}
                {!iAmBuyer && tx.amount != null && tx.status !== 'CANCELLED' && <InvoiceAction tx={tx} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
