import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Plus, Check, Tag, Truck, ArrowRight, ChevronDown, ChevronUp, Scale, Navigation, Store } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import Navbar from '../components/layout/Navbar'
import { usePageTitle } from '../hooks/usePageTitle'
import { firstImage } from '../utils/images'

const fmt = n => Number(n).toLocaleString('fr-FR')

export default function CheckoutPage() {
  usePageTitle('Commander')

  const { items, total, dispatch } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [addresses, setAddresses]       = useState([])
  const [selectedAddr, setSelectedAddr] = useState(null)
  const [newAddr, setNewAddr]           = useState({ label: '', address: '', city: 'Abidjan' })
  const [showNewAddr, setShowNewAddr]   = useState(false)
  const [note, setNote]                 = useState('')
  const [promoCode, setPromoCode]       = useState('')
  const [promo, setPromo]               = useState(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [placing, setPlacing]           = useState(false)
  // Clé d'idempotence — unique par session de checkout, prévient la double-soumission
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(true)

  const [estimate, setEstimate]         = useState(null)
  const [estimating, setEstimating]     = useState(false)
  // LOT 11 (Arbitrage XXX RIZ) : la grille tarifaire (LOT6) sait déjà calculer
  // un prix différent par niveau de service, mais aucun panier ne le
  // proposait jusqu'ici — l'acheteur restait toujours en STANDARD par défaut,
  // rendant l'axe SERVICE_LEVEL inaccessible en pratique.
  const [serviceLevel, setServiceLevel] = useState('STANDARD')

  useEffect(() => {
    if (!user) { navigate('/auth'); return }
    if (user.role !== 'BUYER') { navigate('/'); return }
    if (items.length === 0) { navigate('/cart'); return }

    api.get('/addresses').then(list => {
      setAddresses(list)
      const def = list.find(a => a.isDefault) || list[0]
      if (def) setSelectedAddr(def.id)
    }).catch(() => {})
  }, [user, items])

  // Recalcule les frais à chaque changement d'adresse
  const fetchEstimate = useCallback(async (addrId) => {
    if (!items.length) return
    const addr = addresses.find(a => a.id === addrId)
    if (!addr) return
    setEstimating(true)
    try {
      const result = await api.post('/orders/estimate-delivery', {
        items: items.map(i => ({ productId: i.id, quantity: i.qty })),
        address: `${addr.address}, ${addr.city}`,
        serviceLevel,
      })
      setEstimate(result)
    } catch { setEstimate(null) }
    finally { setEstimating(false) }
  }, [items, addresses, serviceLevel])

  useEffect(() => {
    if (selectedAddr && addresses.length) fetchEstimate(selectedAddr)
  }, [selectedAddr, fetchEstimate])

  const deliveryFee = estimate?.deliveryFee ?? 0
  const discount    = promo?.discount || 0
  const grandTotal  = total + deliveryFee - discount

  const [promoError, setPromoError] = useState(null)
  const [addrError,  setAddrError]  = useState(null)

  const handlePromo = async (e) => {
    e.preventDefault()
    if (!promoCode.trim()) return
    setPromoLoading(true); setPromoError(null)
    try {
      const result = await api.post('/promo/validate', { code: promoCode, orderTotal: total })
      setPromo(result)
    } catch (err) { setPromoError(err.message); setPromo(null) }
    finally { setPromoLoading(false) }
  }

  const handleNewAddr = async (e) => {
    e.preventDefault()
    setAddrError(null)
    try {
      const created = await api.post('/addresses', { ...newAddr, isDefault: addresses.length === 0 })
      setAddresses(a => [...a, created])
      setSelectedAddr(created.id)
      setShowNewAddr(false)
      setNewAddr({ label: '', address: '', city: 'Abidjan' })
    } catch (err) { setAddrError(err.message) }
  }

  const [orderError, setOrderError] = useState(null)

  const handleOrder = async () => {
    if (!selectedAddr) return setOrderError('Veuillez sélectionner une adresse de livraison')
    const addr = addresses.find(a => a.id === selectedAddr)
    if (!addr) return
    setPlacing(true); setOrderError(null)
    try {
      const result = await api.post('/orders', {
        items: items.map(i => ({ productId: i.id, quantity: i.qty })),
        address: `${addr.address}, ${addr.city}`,
        note: note || undefined,
        promoCode: promo ? promoCode : undefined,
        idempotencyKey,
        deliveryFee: typeof estimate?.deliveryFee === 'number' ? estimate.deliveryFee : undefined,
        serviceLevel,
      })
      dispatch({ type: 'CLEAR' })
      const firstId = result.multiShop ? result.firstOrderId : result.id
      navigate(`/orders?success=${firstId}`)
    } catch (err) { setOrderError(err.message) }
    finally { setPlacing(false) }
  }

  if (!user || items.length === 0) return null

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <div className="mb-8">
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Finalisation</p>
          <h1 className="font-playfair text-4xl font-bold text-charcoal">Commander</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          {/* Left */}
          <div className="space-y-6">
            {/* Delivery address */}
            <div className="bg-white rounded-3xl p-6 shadow-card">
              <h2 className="font-playfair text-xl font-bold text-charcoal mb-5 flex items-center gap-2">
                <MapPin size={18} className="text-forest" /> Adresse de livraison
              </h2>
              <div className="space-y-3">
                {addresses.map(addr => (
                  <label key={addr.id} className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedAddr === addr.id ? 'border-forest bg-forest/4' : 'border-charcoal/10 hover:border-charcoal/20'}`}>
                    <input type="radio" name="addr" value={addr.id} checked={selectedAddr === addr.id}
                      onChange={() => setSelectedAddr(addr.id)} className="mt-1 accent-forest" />
                    <div className="flex-1">
                      <p className="font-syne text-sm font-bold text-charcoal">{addr.label}</p>
                      <p className="font-dm text-sm text-charcoal/60">{addr.address}</p>
                      <p className="font-dm text-sm text-charcoal/60">{addr.city}</p>
                      {addr.isDefault && <span className="font-syne text-[10px] font-bold text-forest">Par défaut</span>}
                    </div>
                    {selectedAddr === addr.id && <Check size={16} className="text-forest mt-1" />}
                  </label>
                ))}

                <button onClick={() => setShowNewAddr(v => !v)}
                  className="w-full flex items-center gap-2 font-syne text-sm font-bold text-forest border-2 border-dashed border-forest/30 rounded-2xl p-4 hover:bg-forest/4 transition-colors">
                  <Plus size={16} /> Nouvelle adresse
                </button>

                <AnimatePresence>
                  {showNewAddr && (
                    <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      onSubmit={handleNewAddr} className="overflow-hidden">
                      <div className="space-y-3 pt-2">
                        {[
                          { key: 'label',   placeholder: 'Libellé (ex: Maison, Bureau)', required: true },
                          { key: 'address', placeholder: 'Rue, quartier, numéro…',        required: true },
                          { key: 'city',    placeholder: 'Ville' },
                        ].map(({ key, placeholder, required }) => (
                          <input key={key} type="text" placeholder={placeholder} required={required}
                            value={newAddr[key]} onChange={e => setNewAddr(a => ({ ...a, [key]: e.target.value }))}
                            className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-forest transition-colors" />
                        ))}
                        {addrError && (
                          <p className="font-dm text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{addrError}</p>
                        )}
                        <button type="submit" className="w-full bg-forest text-cream font-syne font-bold py-3 rounded-xl hover:bg-forest-light transition-colors">
                          Enregistrer l'adresse
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* LOT 11 : niveau de service — indépendant de la zone/du poids,
                affecte directement le prix via la grille tarifaire (LOT6). */}
            <div className="bg-white rounded-3xl p-6 shadow-card">
              <h2 className="font-playfair text-xl font-bold text-charcoal mb-4 flex items-center gap-2">
                <Truck size={18} className="text-forest" /> Rapidité de livraison
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'ECONOMIC', label: 'Économique', hint: 'Le plus abordable' },
                  { id: 'STANDARD', label: 'Standard', hint: 'Recommandé' },
                  { id: 'EXPRESS',  label: 'Express',   hint: 'Le plus rapide' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setServiceLevel(opt.id)}
                    className={`text-center p-3 rounded-2xl border-2 transition-all ${
                      serviceLevel === opt.id ? 'border-forest bg-forest/4' : 'border-charcoal/10 hover:border-charcoal/20'
                    }`}>
                    <p className="font-syne text-sm font-bold text-charcoal">{opt.label}</p>
                    <p className="font-dm text-[11px] text-charcoal/40 mt-0.5">{opt.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Breakdown frais de livraison */}
            {(estimate || estimating) && (
              <div className="bg-white rounded-3xl p-6 shadow-card">
                <h2 className="font-playfair text-xl font-bold text-charcoal mb-4 flex items-center gap-2">
                  <Truck size={18} className="text-forest" /> Détail de la livraison
                </h2>
                {estimating ? (
                  <div className="flex items-center gap-3 text-charcoal/40">
                    <div className="w-4 h-4 border-2 border-charcoal/20 border-t-charcoal/60 rounded-full animate-spin" />
                    <span className="font-dm text-sm">Calcul en cours…</span>
                  </div>
                ) : estimate && (
                  <div className="space-y-3">
                    {/* Badge multi-boutiques */}
                    {estimate.additionalShops > 0 && (
                      <div className="flex items-center gap-2 bg-safran/10 border border-safran/20 rounded-2xl px-4 py-2.5">
                        <Store size={14} className="text-safran shrink-0" />
                        <p className="font-dm text-sm text-charcoal/70 flex-1">
                          Panier de <strong>{estimate.shops?.length}</strong> boutiques — {estimate.additionalShops} collecte{estimate.additionalShops > 1 ? 's' : ''} additionnelle{estimate.additionalShops > 1 ? 's' : ''} incluse{estimate.additionalShops > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                    <div className={`grid gap-3 ${estimate.additionalShops > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                      <div className="bg-cream rounded-2xl p-3 text-center">
                        <p className="font-syne text-[10px] font-bold text-charcoal/40 uppercase tracking-wider mb-1">Base fixe</p>
                        <p className="font-playfair text-lg font-bold text-charcoal">{fmt(estimate.breakdown.base)}</p>
                        <p className="font-dm text-[10px] text-charcoal/30">FCFA</p>
                      </div>
                      <div className="bg-cream rounded-2xl p-3 text-center">
                        <p className="font-syne text-[10px] font-bold text-charcoal/40 uppercase tracking-wider mb-1">Poids</p>
                        <p className="font-playfair text-lg font-bold text-charcoal">{fmt(estimate.breakdown.weightCost)}</p>
                        <p className="font-dm text-[10px] text-charcoal/30">{estimate.weightKg} kg</p>
                      </div>
                      <div className={`rounded-2xl p-3 text-center ${estimate.geocoded ? 'bg-cream' : 'bg-charcoal/4'}`}>
                        <p className="font-syne text-[10px] font-bold text-charcoal/40 uppercase tracking-wider mb-1">Distance</p>
                        <p className="font-playfair text-lg font-bold text-charcoal">{fmt(estimate.breakdown.distanceCost)}</p>
                        <p className="font-dm text-[10px] text-charcoal/30">
                          {estimate.geocoded ? `${estimate.distanceKm} km` : 'non géolocalisé'}
                        </p>
                      </div>
                      {estimate.additionalShops > 0 && (
                        <div className="bg-safran/10 rounded-2xl p-3 text-center">
                          <p className="font-syne text-[10px] font-bold text-safran/70 uppercase tracking-wider mb-1">Collectes</p>
                          <p className="font-playfair text-lg font-bold text-charcoal">{fmt(estimate.breakdown.pickupCost)}</p>
                          <p className="font-dm text-[10px] text-charcoal/30">+{estimate.additionalShops} boutique{estimate.additionalShops > 1 ? 's' : ''}</p>
                        </div>
                      )}
                    </div>

                    {!estimate.geocoded && (
                      <div className="flex items-start gap-2 bg-safran/8 rounded-xl px-3 py-2">
                        <Navigation size={13} className="text-safran mt-0.5 shrink-0" />
                        <p className="font-dm text-xs text-charcoal/60">
                          Adresse non géolocalisée — les frais de distance seront calculés à la confirmation.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-charcoal/8">
                      <span className="font-syne text-sm font-bold text-charcoal">Total livraison</span>
                      <span className={`font-playfair text-2xl font-bold ${deliveryFee === 0 ? 'text-green-600' : 'text-charcoal'}`}>
                        {deliveryFee === 0 ? 'Gratuite ✓' : `${fmt(deliveryFee)} FCFA`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Note */}
            <div className="bg-white rounded-3xl p-6 shadow-card">
              <h2 className="font-playfair text-xl font-bold text-charcoal mb-4">Note pour le vendeur</h2>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="Instructions spéciales, horaires de livraison…" rows={3}
                className="w-full border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-forest transition-colors resize-none" />
            </div>

            {/* Paiement */}
            <div className="bg-white rounded-3xl p-6 shadow-card">
              <h2 className="font-playfair text-xl font-bold text-charcoal mb-4 flex items-center gap-2">
                <Truck size={18} className="text-forest" /> Mode de paiement
              </h2>
              <label className="flex items-center gap-4 p-4 rounded-2xl border-2 border-forest bg-forest/4 cursor-pointer">
                <input type="radio" checked readOnly className="accent-forest" />
                <div>
                  <p className="font-syne text-sm font-bold text-charcoal">💵 Paiement à la livraison</p>
                  <p className="font-dm text-xs text-charcoal/50">Payez en espèces au livreur lors de la réception</p>
                </div>
                <Check size={16} className="text-forest ml-auto" />
              </label>
            </div>

            {/* Code promo */}
            <div className="bg-white rounded-3xl p-6 shadow-card">
              <h2 className="font-playfair text-xl font-bold text-charcoal mb-4 flex items-center gap-2">
                <Tag size={18} className="text-forest" /> Code promo
              </h2>
              {promo ? (
                <div className="flex items-center justify-between bg-green-50 border-2 border-green-200 rounded-2xl px-4 py-3">
                  <div>
                    <p className="font-syne text-sm font-bold text-green-700">✓ {promoCode.toUpperCase()} appliqué</p>
                    <p className="font-dm text-xs text-green-600">-{fmt(promo.discount)} FCFA de réduction</p>
                  </div>
                  <button onClick={() => { setPromo(null); setPromoCode('') }} className="font-syne text-xs text-red-500 hover:underline">Retirer</button>
                </div>
              ) : (
                <>
                  <form onSubmit={handlePromo} className="flex gap-3">
                    <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="CODE2024" className="flex-1 border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-forest uppercase tracking-wider" />
                    <button type="submit" disabled={promoLoading || !promoCode}
                      className="bg-charcoal text-cream font-syne font-bold text-sm px-6 py-3 rounded-xl hover:bg-charcoal/80 transition-colors disabled:opacity-50">
                      {promoLoading ? '…' : 'Appliquer'}
                    </button>
                  </form>
                  {promoError && <p className="font-dm text-xs text-red-600 mt-2">{promoError}</p>}
                </>
              )}
            </div>
          </div>

          {/* Right — summary */}
          <div className="lg:sticky lg:top-24 h-fit space-y-4">
            <div className="bg-white rounded-3xl shadow-card overflow-hidden">
              <button onClick={() => setOrderSummaryOpen(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 font-playfair text-xl font-bold text-charcoal">
                Ma commande ({items.reduce((s, i) => s + i.qty, 0)})
                {orderSummaryOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              <AnimatePresence>
                {orderSummaryOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="px-6 pb-4 space-y-3">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-forest/5 shrink-0">
                            {firstImage(item.images) && <img src={firstImage(item.images)} alt={item.name} className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-syne text-sm font-bold text-charcoal truncate">{item.name}</p>
                            <p className="font-dm text-xs text-charcoal/40">x{item.qty}{item.unit ? ` · ${item.unit}` : ''}</p>
                          </div>
                          <p className="font-playfair text-sm font-bold text-charcoal shrink-0">{fmt(item.price * item.qty)} F</p>
                        </div>
                      ))}
                      {estimate && (
                        <div className="flex items-center gap-2 pt-2 border-t border-charcoal/6 text-xs text-charcoal/40 font-dm">
                          <Scale size={11} />
                          <span>{estimate.weightKg} kg total · {estimate.geocoded ? `${estimate.distanceKm} km` : 'distance à confirmer'}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-card space-y-3">
              <div className="flex justify-between font-dm text-sm text-charcoal/60">
                <span>Sous-total</span><span>{fmt(total)} FCFA</span>
              </div>
              <div className="flex justify-between font-dm text-sm text-charcoal/60">
                <span className="flex items-center gap-1">
                  Livraison
                  {estimating && <span className="w-3 h-3 border border-charcoal/30 border-t-charcoal/60 rounded-full animate-spin inline-block" />}
                </span>
                <span className={deliveryFee === 0 && estimate ? 'text-green-600 font-semibold' : ''}>
                  {estimating ? '…' : estimate ? (deliveryFee === 0 ? 'Gratuite' : `${fmt(deliveryFee)} FCFA`) : '—'}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between font-dm text-sm text-green-600">
                  <span>Réduction ({promoCode})</span><span>-{fmt(discount)} FCFA</span>
                </div>
              )}
              <div className="border-t border-charcoal/8 pt-3 flex justify-between">
                <span className="font-syne text-sm font-bold text-charcoal">Total TTC</span>
                <span className="font-playfair text-2xl font-bold text-charcoal">{fmt(grandTotal)} FCFA</span>
              </div>
            </div>

            {orderError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <p className="font-dm text-sm text-red-600">{orderError}</p>
              </div>
            )}

            <motion.button whileTap={{ scale: 0.98 }} onClick={handleOrder}
              disabled={placing || !selectedAddr || estimating}
              className="w-full flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-4 rounded-2xl hover:bg-forest-light transition-colors disabled:opacity-60 text-lg">
              {placing
                ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                : <><span>Confirmer la commande</span> <ArrowRight size={18} /></>}
            </motion.button>

            <p className="font-dm text-xs text-charcoal/40 text-center">
              En commandant, vous acceptez de payer {fmt(grandTotal)} FCFA à la livraison
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
