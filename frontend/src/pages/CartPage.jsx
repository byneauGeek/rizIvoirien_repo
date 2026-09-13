import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, ArrowLeft, Scale, MapPin, X, LogIn, UserPlus, MessageCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import { firstImage } from '../utils/images'
import { effectiveUnitPrice } from '../utils/pricing'

const fmt = (n) => Number(n).toLocaleString('fr-FR')

// LOT REVISION (retour utilisateur) : un acheteur non connecté qui cliquait
// "Commander" était renvoyé silencieusement vers /auth, sans explication ni
// possibilité de créer un compte acheteur (la page de connexion ne proposait
// que "connexion" ou "ouvrir une boutique"). Contacter la boutique reste
// possible sans compte via ses coordonnées publiques (ShopDetailPage), donc
// proposé ici plutôt qu'un canal de messagerie qui exige une authentification.
function AuthGateModal({ onClose, singleShop }) {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-charcoal/8">
          <h3 className="font-playfair text-xl font-bold text-charcoal">Un compte est requis</h3>
          <button onClick={onClose} aria-label="Fermer" className="p-2 rounded-xl hover:bg-charcoal/6 transition-colors">
            <X size={18} className="text-charcoal/50" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          <p className="font-dm text-sm text-charcoal/60 mb-2">
            Connectez-vous ou créez un compte acheteur pour finaliser votre commande.
          </p>
          <button onClick={() => navigate('/auth')}
            className="w-full flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-3.5 rounded-2xl hover:bg-forest-light transition-colors">
            <LogIn size={16} /> Se connecter
          </button>
          <button onClick={() => navigate('/register', { state: { from: '/cart' } })}
            className="w-full flex items-center justify-center gap-2 border-2 border-forest text-forest font-syne font-bold py-3.5 rounded-2xl hover:bg-forest/5 transition-colors">
            <UserPlus size={16} /> Créer un compte acheteur
          </button>
          {singleShop && (
            <button onClick={() => navigate(`/shop/${singleShop.id}`)}
              className="w-full flex items-center justify-center gap-2 font-syne text-sm font-semibold text-charcoal/50 hover:text-forest transition-colors pt-2">
              <MessageCircle size={14} /> Une question avant d'acheter ? Contacter {singleShop.name}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function CartPage() {
  const { items, total, count, dispatch } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [estimate, setEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const [showAuthGate, setShowAuthGate] = useState(false)

  // Appel estimate (sans adresse) pour afficher le minimum garanti.
  // LOT REVISION (retour utilisateur) : /orders/estimate-delivery exige une
  // authentification côté backend — appelé sans condition, un visiteur non
  // connecté déclenchait un 401 dès le chargement de la page, qui provoque
  // une redirection GLOBALE vers /auth (AuthContext, handler 401) avant même
  // qu'il ait pu voir le panier ou cliquer sur quoi que ce soit.
  const fetchEstimate = useCallback(async () => {
    if (!items.length || !user) { setEstimate(null); return }
    setEstimating(true)
    try {
      const result = await api.post('/orders/estimate-delivery', {
        items: items.map(i => ({ productId: i.id, quantity: i.qty })),
      })
      setEstimate(result)
    } catch { setEstimate(null) }
    finally { setEstimating(false) }
  }, [items, user])

  useEffect(() => { fetchEstimate() }, [fetchEstimate])

  const deliveryFee   = estimate?.deliveryFee ?? null
  const weightKg      = estimate?.weightKg    ?? 0
  const leadDays      = estimate?.leadDays    ?? 1

  const shopNames  = [...new Set(items.map(i => i.shopName || i.shop?.name).filter(Boolean))]
  const isMultiShop = shopNames.length > 1
  const singleShop = !isMultiShop && items[0]
    ? { id: items[0].shopId ?? items[0].shop?.id, name: items[0].shopName ?? items[0].shop?.name }
    : null

  const handleCheckout = () => {
    if (!user || user.role !== 'BUYER') { setShowAuthGate(true); return }
    navigate('/checkout')
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 pt-28 pb-16">
        <div className="mb-8">
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Votre sélection</p>
          <h1 className="font-playfair text-4xl font-bold text-charcoal">
            Panier <span className="text-charcoal/30 text-2xl font-normal">({count} article{count !== 1 ? 's' : ''})</span>
          </h1>
        </div>

        {items.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-24 h-24 rounded-full bg-forest/8 flex items-center justify-center">
              <ShoppingBag size={36} className="text-forest/40" />
            </div>
            <div className="text-center">
              <p className="font-playfair text-2xl font-bold text-charcoal mb-2">Votre panier est vide</p>
              <p className="font-dm text-charcoal/50">Découvrez nos produits et ajoutez-en au panier.</p>
            </div>
            <Link to="/shop" className="btn-primary">Découvrir les produits</Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
            {/* Items */}
            <div className="space-y-4">
              <AnimatePresence>
                {items.map((item) => (
                  <motion.div key={`${item.id}-${item.variantId ?? 'base'}`} layout
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.25 }}
                    className="bg-white rounded-3xl p-5 shadow-card flex gap-5">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-forest/5">
                      {firstImage(item.images) && (
                        <img src={firstImage(item.images)} alt={item.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-playfair text-lg font-bold text-charcoal leading-tight">{item.name}</p>
                          <p className="font-dm text-sm text-charcoal/40 mt-0.5">{item.shopName || item.shop?.name}</p>
                          {item.unit && <p className="font-dm text-xs text-charcoal/30 mt-0.5">{item.unit} · {item.qty * parseFloat(String(item.unit).match(/^(\d+(?:\.\d+)?)/)?.[1] || 0)} kg au total</p>}
                        </div>
                        <button onClick={() => dispatch({ type: 'REMOVE', id: item.id, variantId: item.variantId })}
                          aria-label="Supprimer l'article"
                          className="p-2 rounded-xl text-charcoal/30 hover:text-terra hover:bg-terra/10 transition-colors shrink-0">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-3 bg-cream rounded-2xl px-3 py-2">
                          <button
                            onClick={() => item.qty === 1
                              ? dispatch({ type: 'REMOVE', id: item.id, variantId: item.variantId })
                              : dispatch({ type: 'UPDATE_QTY', id: item.id, variantId: item.variantId, qty: item.qty - 1 })}
                            aria-label="Diminuer la quantité"
                            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-charcoal hover:bg-forest/10 transition-colors">
                            <Minus size={12} />
                          </button>
                          <span className="font-syne font-bold text-sm text-charcoal w-6 text-center">{item.qty}</span>
                          <button
                            onClick={() => dispatch({ type: 'UPDATE_QTY', id: item.id, variantId: item.variantId, qty: item.qty + 1 })}
                            aria-label="Augmenter la quantité"
                            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-charcoal hover:bg-forest/10 transition-colors">
                            <Plus size={12} />
                          </button>
                        </div>
                        <p className="font-playfair text-xl font-bold text-charcoal">
                          {fmt(effectiveUnitPrice(item, item.qty) * item.qty)} <span className="text-sm font-normal text-charcoal/40">FCFA</span>
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <Link to="/shop" className="inline-flex items-center gap-2 font-syne text-sm font-semibold text-charcoal/50 hover:text-forest transition-colors mt-2">
                <ArrowLeft size={14} /> Continuer les achats
              </Link>
            </div>

            {/* Summary */}
            <div className="lg:sticky lg:top-24 h-fit">
              <div className="bg-white rounded-3xl p-6 shadow-card">
                <h2 className="font-playfair text-xl font-bold text-charcoal mb-6">Récapitulatif</h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="font-dm text-sm text-charcoal/60">Sous-total ({count} article{count !== 1 ? 's' : ''})</span>
                    <span className="font-dm text-sm font-semibold text-charcoal">{fmt(total)} FCFA</span>
                  </div>

                  {/* Livraison dynamique */}
                  <div className="flex justify-between items-start">
                    <span className="font-dm text-sm text-charcoal/60">Livraison estimée</span>
                    <span className="font-dm text-sm font-semibold text-charcoal text-right">
                      {estimating ? (
                        <span className="text-charcoal/30">Calcul…</span>
                      ) : deliveryFee != null ? (
                        deliveryFee === 0 ? <span className="text-green-600">Gratuite ✓</span> : `${fmt(deliveryFee)} FCFA`
                      ) : '—'}
                    </span>
                  </div>

                  {/* Détail poids */}
                  {weightKg > 0 && (
                    <div className="flex items-center gap-2 text-xs text-charcoal/40 font-dm">
                      <Scale size={12} />
                      <span>{weightKg} kg · frais finaux calculés selon votre adresse</span>
                    </div>
                  )}

                  <div className="border-t border-charcoal/8 pt-3 flex justify-between">
                    <span className="font-syne text-sm font-bold text-charcoal">Total estimé</span>
                    <span className="font-playfair text-xl font-bold text-charcoal">
                      {deliveryFee != null ? fmt(total + deliveryFee) : fmt(total)} FCFA
                    </span>
                  </div>
                </div>

                {isMultiShop && (
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
                    <span className="text-lg shrink-0">🛍️</span>
                    <div>
                      <p className="font-syne text-sm font-bold text-charcoal">
                        Panier multi-boutiques ({shopNames.length} boutiques)
                      </p>
                      <p className="font-dm text-xs text-charcoal/60 mt-0.5">
                        Des frais de collecte supplémentaires peuvent s'appliquer pour chaque boutique additionnelle.
                        Le montant exact sera calculé à l'étape suivante.
                      </p>
                    </div>
                  </div>
                )}

                <motion.button whileTap={{ scale: 0.98 }} onClick={handleCheckout}
                  className="w-full flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-4 rounded-2xl hover:bg-forest-light transition-colors">
                  Commander <ArrowRight size={16} />
                </motion.button>

                {!user && (
                  <p className="font-dm text-xs text-charcoal/40 text-center mt-3">Connexion requise pour commander</p>
                )}

                <div className="mt-5 pt-5 border-t border-charcoal/8 space-y-2">
                  {[
                    { icon: '✓', text: 'Paiement sécurisé à la livraison' },
                    { icon: <MapPin size={10} />, text: `Livraison sous ${leadDays} jour${leadDays > 1 ? 's' : ''}` },
                    { icon: '✓', text: 'Produits 100% ivoiriens' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-forest/10 flex items-center justify-center text-forest text-[10px]">{item.icon}</span>
                      <span className="font-dm text-xs text-charcoal/50">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />

      <AnimatePresence>
        {showAuthGate && (
          <AuthGateModal onClose={() => setShowAuthGate(false)} singleShop={singleShop} />
        )}
      </AnimatePresence>
    </div>
  )
}
