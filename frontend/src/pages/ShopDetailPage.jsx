import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, MapPin, Package, Clock, Truck, ShoppingBag, Phone, Mail,
         MessageCircle, Facebook, Instagram, CalendarDays, AlertTriangle, AlertCircle, Megaphone } from 'lucide-react'
import { api } from '../api/client'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import ProductCard from '../components/shop/ProductCard'
import SEOHead from '../components/SEOHead'

const fmt = n => Number(n || 0).toLocaleString('fr-FR')

// Corrigé (phase 1 post-audit) : seule la note agrégée (shop.rating) était
// affichée — un acheteur qui décide de faire confiance à une boutique n'avait
// aucun avis réel à lire, alors que ShopReview existe et est déjà collecté
// (formulaire post-livraison). GET /shop-reviews/:shopId est public, aucune
// auth requise pour le lire.
function ShopReviewsSection({ shopId }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/shop-reviews/${shopId}`).then(setReviews).catch(() => {}).finally(() => setLoading(false))
  }, [shopId])

  if (loading || reviews.length === 0) return null

  return (
    <div className="mt-16">
      <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-4">
        Avis clients ({reviews.length})
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reviews.map(r => (
          <div key={r.id} className="bg-white rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-2 gap-3">
              <p className="font-syne text-sm font-bold text-charcoal truncate">{r.user?.name || 'Client'}</p>
              <div className="flex items-center gap-0.5 shrink-0">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={13} className={i <= r.rating ? 'fill-safran text-safran' : 'text-charcoal/15'} />
                ))}
              </div>
            </div>
            {r.comment && <p className="font-dm text-sm text-charcoal/60">{r.comment}</p>}
            <p className="font-dm text-xs text-charcoal/30 mt-2">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const PAYMENT_LABELS = {
  cash:         '💵 Espèces',
  orange_money: '🟠 Orange Money',
  mtn_money:    '🟡 MTN MoMo',
  wave:         '🔵 Wave',
  bank:         '🏦 Virement',
}

export default function ShopDetailPage() {
  const { id } = useParams()
  const [shop, setShop]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true); setError(null)
    api.get(`/shops/${id}`)
      .then(setShop)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [id])

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
    </div>
  )

  // "Boutique introuvable" (ci-dessous) est réservé au vrai 404 — une panne
  // réseau/serveur affichait auparavant EXACTEMENT le même message, laissant
  // croire à tort que la boutique n'existe pas.
  if (error) return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4">
      <AlertCircle size={48} className="text-red-300" />
      <p className="font-playfair text-2xl font-bold text-charcoal">Impossible de charger cette boutique</p>
      <p className="font-dm text-charcoal/50">{error}</p>
      <button onClick={load} className="btn-primary">Réessayer</button>
    </div>
  )

  if (!shop) return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4">
      <p className="font-playfair text-2xl font-bold text-charcoal">Boutique introuvable</p>
      <Link to="/shop" className="btn-primary">Voir toutes les boutiques</Link>
    </div>
  )

  // Données dérivées
  let payments = []
  try { payments = JSON.parse(shop.paymentMethods || '[]') } catch {}

  const hasPracticalInfo = shop.openingHours || shop.deliveryZones || shop.minOrder > 0
    || shop.preparationTime || shop.since
  const hasContact = shop.phone || shop.email || shop.whatsapp
  const hasSocial  = shop.facebook || shop.instagram

  return (
    <div className="min-h-screen bg-cream">
      <SEOHead
        title={`${shop.name} — RizIvoirien`}
        description={shop.description || `Découvrez les produits de ${shop.name} sur RizIvoirien.`}
        ogImage={shop.coverImage || ''}
      />
      <Navbar />

      {/* ── Annonce temporaire ── */}
      {shop.announcementActive && shop.announcement && (
        <div className="fixed top-16 left-0 right-0 z-30 bg-[#E8A217] text-white py-2.5 px-6 flex items-center justify-center gap-2 shadow-md">
          <Megaphone size={15} className="shrink-0" />
          <p className="font-syne text-sm font-bold text-center">{shop.announcement}</p>
        </div>
      )}

      {/* ── Cover ── */}
      <div className={`relative h-72 overflow-hidden ${shop.announcementActive && shop.announcement ? 'mt-[104px]' : 'mt-16'}`}>
        {shop.coverImage ? (
          <img src={shop.coverImage} alt={shop.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-forest to-forest-dark" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/20 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 px-8 pb-8 flex items-end gap-5">
          {shop.avatar && (
            <img src={shop.avatar} alt="" className="w-20 h-20 rounded-2xl border-4 border-cream object-cover shrink-0 shadow-xl" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {shop.certified ? (
                <span className="font-syne text-xs font-bold bg-gold text-charcoal px-3 py-1 rounded-full">★ Certifiée</span>
              ) : (
                <span className="font-syne text-xs font-bold bg-white/15 text-cream/50 border border-cream/25 px-3 py-1 rounded-full">Non certifiée</span>
              )}
              {shop.paused && (
                <span className="font-syne text-xs font-bold bg-amber-500 text-white px-3 py-1 rounded-full flex items-center gap-1">
                  <AlertTriangle size={11} /> En pause
                </span>
              )}
            </div>
            <h1 className="font-playfair text-4xl font-bold text-cream leading-tight">{shop.name}</h1>
            {shop.speciality && (
              <p className="font-dm text-sm text-cream/60 mt-0.5">{shop.speciality}</p>
            )}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {shop.location && (
                <span className="flex items-center gap-1 font-dm text-sm text-cream/60">
                  <MapPin size={13} /> {shop.location}
                </span>
              )}
              {shop.rating > 0 && (
                <span className="flex items-center gap-1 font-dm text-sm text-cream/60">
                  <Star size={13} fill="currentColor" className="text-safran" />
                  {shop.rating.toFixed(1)}
                  {shop.reviewCount > 0 && <span className="text-cream/40">({shop.reviewCount})</span>}
                </span>
              )}
              {shop.since && (
                <span className="flex items-center gap-1 font-dm text-sm text-cream/60">
                  <CalendarDays size={13} /> Depuis {shop.since}
                </span>
              )}
              <span className="flex items-center gap-1 font-dm text-sm text-cream/60">
                <Package size={13} /> {shop.products?.length || 0} produits
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bandeau pause ── */}
      {shop.paused && shop.pauseNote && (
        <div className="bg-amber-50 border-b border-amber-200 px-8 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <p className="font-dm text-sm text-amber-800">{shop.pauseNote}</p>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">

        {/* ── Grille info + contact ── */}
        {(shop.description || hasPracticalInfo || hasContact || payments.length > 0) && (
          <div className="grid md:grid-cols-3 gap-5">

            {/* Description + tags */}
            {shop.description && (
              <div className="md:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-3">À propos</p>
                <p className="font-dm text-charcoal/70 leading-relaxed">{shop.description}</p>
                {shop.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {shop.tags.split(',').map(t => t.trim()).filter(Boolean).map((tag, i) => (
                      <span key={i} className="font-dm text-xs text-charcoal/50 bg-charcoal/5 px-2.5 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Infos pratiques + Contact */}
            <div className="space-y-4">

              {hasPracticalInfo && (
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-3">
                  <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">Infos pratiques</p>
                  {shop.openingHours && (
                    <InfoRow icon={Clock} label="Horaires" value={shop.openingHours} />
                  )}
                  {shop.deliveryZones && (
                    <InfoRow icon={Truck} label="Livraison" value={shop.deliveryZones} />
                  )}
                  {shop.minOrder > 0 && (
                    <InfoRow icon={ShoppingBag} label="Min. commande" value={`${fmt(shop.minOrder)} FCFA`} />
                  )}
                  {shop.preparationTime > 0 && (
                    <InfoRow icon={Clock} label="Préparation" value={`${shop.preparationTime} min`} />
                  )}
                </div>
              )}

              {(hasContact || payments.length > 0) && (
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-3">
                  <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">Contact</p>

                  {shop.whatsapp && (
                    <a href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-green-500 text-white font-syne text-sm font-bold hover:bg-green-600 transition-colors">
                      <MessageCircle size={15} /> WhatsApp
                    </a>
                  )}
                  {shop.phone && (
                    <a href={`tel:${shop.phone}`}
                      className="flex items-center gap-2.5 font-dm text-sm text-charcoal hover:text-forest transition-colors">
                      <Phone size={14} className="text-charcoal/40 shrink-0" /> {shop.phone}
                    </a>
                  )}
                  {shop.email && (
                    <a href={`mailto:${shop.email}`}
                      className="flex items-center gap-2.5 font-dm text-sm text-charcoal hover:text-forest transition-colors">
                      <Mail size={14} className="text-charcoal/40 shrink-0" /> {shop.email}
                    </a>
                  )}

                  {payments.length > 0 && (
                    <div className="pt-2 border-t border-charcoal/6">
                      <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-2">Paiements acceptés</p>
                      <div className="flex flex-wrap gap-1.5">
                        {payments.map(p => (
                          <span key={p} className="font-dm text-xs text-charcoal/60 bg-charcoal/5 px-2 py-1 rounded-full">
                            {PAYMENT_LABELS[p] || p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasSocial && (
                    <div className="flex items-center gap-3 pt-2 border-t border-charcoal/6">
                      {shop.facebook && (
                        <a href={`https://facebook.com/${shop.facebook}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 font-dm text-xs text-blue-600 hover:underline">
                          <Facebook size={14} /> Facebook
                        </a>
                      )}
                      {shop.instagram && (
                        <a href={`https://instagram.com/${shop.instagram.replace('@', '')}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 font-dm text-xs text-pink-600 hover:underline">
                          <Instagram size={14} /> Instagram
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Produits ── */}
        {shop.products?.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl block mb-4">🌾</span>
            <p className="font-playfair text-2xl font-bold text-charcoal">Aucun produit pour l'instant</p>
            <p className="font-dm text-charcoal/40 mt-2">Cette boutique n'a pas encore ajouté de produits.</p>
          </div>
        ) : (
          <div>
            <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-4">
              {shop.products?.length} produit{shop.products?.length > 1 ? 's' : ''}
            </p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 auto-rows-[320px]"
            >
              {shop.products?.map((product, i) => (
                <motion.div key={product.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="h-full"
                >
                  <ProductCard product={{ ...product, images: (() => { try { return JSON.parse(product.images) } catch { return [] } })() }} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        <ShopReviewsSection shopId={shop.id} />
      </div>

      <Footer />
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-[#E8A217] shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40">{label}</p>
        <p className="font-dm text-sm text-charcoal">{value}</p>
      </div>
    </div>
  )
}
