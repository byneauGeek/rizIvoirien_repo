import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Star, MapPin, ShoppingBag, ArrowLeft, Minus, Plus, Check, Leaf, Heart, AlertCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import ProductCard from '../components/shop/ProductCard'
import { api } from '../api/client'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { parseImages } from '../utils/images'
import { usePageTitle } from '../hooks/usePageTitle'
import SEOHead from '../components/SEOHead'
import { effectiveUnitPrice } from '../utils/pricing'

const fmt = n => Number(n).toLocaleString('fr-FR')

function ReviewStars({ rating, size = 16, interactive = false, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <button key={i} type={interactive ? 'button' : undefined}
          onMouseEnter={interactive ? () => setHover(i) : undefined}
          onMouseLeave={interactive ? () => setHover(0) : undefined}
          onClick={interactive ? () => onChange?.(i) : undefined}
          aria-label={interactive ? `Noter ${i} étoile${i > 1 ? 's' : ''}` : undefined}
          aria-pressed={interactive ? i <= rating : undefined}
          tabIndex={interactive ? undefined : -1}
          aria-hidden={interactive ? undefined : true}
          className={interactive ? 'cursor-pointer' : 'cursor-default'}>
          <Star size={size} className={(hover || rating) >= i ? 'fill-safran text-safran' : 'text-charcoal/20'} />
        </button>
      ))}
    </div>
  )
}

export default function ProductPage() {
  const { slug } = useParams()
  const { addItem, replaceCart } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [reviews, setReviews] = useState([])
  const [reviewAvg, setReviewAvg] = useState(0)
  const [loading, setLoading] = useState(true)

  usePageTitle(product?.name)

  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty] = useState(1)
  // LOT VARIANTS (retour utilisateur) : null = taille de base du produit,
  // sinon la ProductVariant choisie — détermine unit/price/stock affichés
  // et ajoutés au panier.
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [added,    setAdded]    = useState(false)
  const [wished,   setWished]   = useState(false)
  const [conflict, setConflict] = useState(null) // { shopName }

  const activeOffer = product ? (selectedVariant
    ? { unit: selectedVariant.unit, price: selectedVariant.price, wholesalePrice: selectedVariant.wholesalePrice, minWholesaleQty: selectedVariant.minWholesaleQty, stock: selectedVariant.stock, saleType: product.saleType }
    : { unit: product.unit, price: product.price, wholesalePrice: product.wholesalePrice, minWholesaleQty: product.minWholesaleQty, stock: product.stock, saleType: product.saleType }
  ) : null

  // Review form
  const [myRating, setMyRating] = useState(5)
  const [myComment, setMyComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.get(`/products/${slug}`)
      .then(p => {
        setProduct(p)
        return Promise.all([
          api.get(`/reviews/product/${p.id}`),
          api.get(`/products?category=${encodeURIComponent(p.category)}&limit=4`),
        ])
      })
      .then(([revData, relData]) => {
        setReviews(revData.reviews || [])
        setReviewAvg(revData.avg || 0)
        setRelated((relData.products || []).filter(p2 => p2.slug !== slug).slice(0, 3))
      })
      .catch(() => navigate('/shop'))
      .finally(() => setLoading(false))
  }, [slug])

  const handleAdd = () => {
    if (!product || !activeOffer) return
    const result = addItem({
      ...product, images: product.images,
      unit: activeOffer.unit, price: activeOffer.price, wholesalePrice: activeOffer.wholesalePrice,
      minWholesaleQty: activeOffer.minWholesaleQty, variantId: selectedVariant?.id || null,
    }, qty)
    if (result.conflict) {
      setConflict({ shopName: result.shopName })
      return
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const handleConfirmReplace = () => {
    if (!product || !activeOffer) return
    replaceCart({
      ...product, images: product.images,
      unit: activeOffer.unit, price: activeOffer.price, wholesalePrice: activeOffer.wholesalePrice,
      minWholesaleQty: activeOffer.minWholesaleQty, variantId: selectedVariant?.id || null,
    }, qty)
    setConflict(null)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const handleWish = async () => {
    if (!user || user.role !== 'BUYER') return navigate('/auth')
    setWished(v => !v)
    try {
      if (wished) await api.delete(`/wishlist/${product.id}`)
      else await api.post(`/wishlist/${product.id}`, {})
    } catch { setWished(v => !v) }
  }

  const handleReview = async (e) => {
    e.preventDefault()
    if (!user) return navigate('/auth')
    setSubmittingReview(true)
    setReviewError(null)
    try {
      const rev = await api.post('/reviews', { productId: product.id, rating: myRating, comment: myComment })
      setReviews(r => [rev, ...r.filter(x => x.userId !== user.id)])
      setMyComment('')
    } catch (err) { setReviewError(err.message || 'Erreur lors de la soumission') }
    finally { setSubmittingReview(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
    </div>
  )
  if (!product) return null

  const images = parseImages(product.images)
  if (!images.length && product.image) images.push(product.image)

  return (
    <div className="min-h-screen bg-cream">
      <SEOHead
        title={`${product.name} — RizIvoirien`}
        description={product.description ? product.description.slice(0, 160) : `Achetez ${product.name} sur RizIvoirien, la marketplace de riz ivoirien.`}
        ogImage={parseImages(product.images)[0] || ''}
        ogType="product"
      />
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 font-dm text-sm text-charcoal/50">
          <Link to="/" className="hover:text-forest transition-colors">Accueil</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-forest transition-colors">Produits</Link>
          <span>/</span>
          <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-forest transition-colors">{product.category}</Link>
          <span>/</span>
          <span className="text-charcoal">{product.name}</span>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
          {/* Images */}
          <div className="space-y-4">
            <motion.div key={activeImg} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }} className="relative aspect-square rounded-3xl overflow-hidden bg-white shadow-card">
              {images[activeImg] ? (
                <img src={images[activeImg]} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-forest/5 flex items-center justify-center">
                  <span className="text-6xl">🌾</span>
                </div>
              )}
              {product.badge && (
                <span className="absolute top-6 left-6 font-syne text-xs font-bold bg-safran text-charcoal px-4 py-2 rounded-full">{product.badge}</span>
              )}
              {product.shop?.certified && (
                <span className="absolute top-6 right-6 font-syne text-xs font-bold bg-gold text-charcoal px-4 py-2 rounded-full">✓ Certifié</span>
              )}
            </motion.div>
            {images.length > 1 && (
              <div className="flex gap-3">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all ${activeImg === i ? 'border-forest shadow-card' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <Link to={`/shop/${product.shop?.id}`} className="inline-flex items-center gap-2 mb-6 group">
              <span className="font-syne text-xs font-bold tracking-wider uppercase text-forest group-hover:text-forest-light transition-colors">
                {product.shop?.name}
              </span>
              {product.shop?.certified && <span className="font-syne text-[10px] font-bold bg-gold text-charcoal px-2 py-0.5 rounded-full">✓</span>}
            </Link>

            <h1 className="font-playfair text-4xl md:text-5xl font-bold text-charcoal leading-tight mb-4">{product.name}</h1>

            <div className="flex items-center gap-3 mb-6">
              <ReviewStars rating={Math.round(reviewAvg)} />
              <span className="font-syne font-bold text-charcoal">{reviewAvg || product.rating || '5.0'}</span>
              <span className="font-dm text-sm text-charcoal/50">({reviews.length} avis)</span>
            </div>

            <div className="mb-8 pb-8 border-b border-charcoal/8">
              <p className="font-playfair text-5xl font-bold text-charcoal">
                {fmt(activeOffer.price)}<span className="text-2xl text-charcoal/50 font-dm font-normal"> FCFA</span>
              </p>
              <p className="font-dm text-sm text-charcoal/50 mt-1">
                soit {fmt(selectedVariant ? selectedVariant.pricePerKg : product.pricePerKg)} FCFA/kg · sac de {activeOffer.unit}
              </p>
            </div>

            {product.description && (
              <p className="font-dm text-base text-charcoal/70 leading-relaxed mb-8">{product.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { icon: <MapPin size={14} />, label: 'Origine', value: product.origin },
                { icon: <Leaf size={14} />, label: 'Récolte', value: product.harvest },
                { icon: '📦', label: 'Conditionnement', value: activeOffer.unit },
                { icon: '📊', label: 'Stock', value: activeOffer.stock > 0 ? `${activeOffer.stock} sacs` : 'Rupture' },
                {
                  icon: product.saleType === 'WHOLESALE' ? '📦' : product.saleType === 'RETAIL' ? '🛒' : '✅',
                  label: 'Type de vente',
                  value: product.saleType === 'WHOLESALE' ? 'Vente en gros' : product.saleType === 'RETAIL' ? 'Vente au détail' : 'Gros & Détail',
                },
                {
                  icon: '📦',
                  label: 'Prix en gros',
                  value: (activeOffer.saleType === 'WHOLESALE' || activeOffer.saleType === 'BOTH') && activeOffer.wholesalePrice
                    ? `${fmt(activeOffer.wholesalePrice)} FCFA / sac${activeOffer.minWholesaleQty ? ` · min. ${activeOffer.minWholesaleQty} sac${activeOffer.minWholesaleQty > 1 ? 's' : ''}` : ''}`
                    : null,
                },
              ].filter(x => x.value).map(({ icon, label, value }) => (
                <div key={label} className="bg-white rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 text-forest mb-1">
                    {typeof icon === 'string' ? <span className="text-sm">{icon}</span> : icon}
                    <span className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40">{label}</span>
                  </div>
                  <p className="font-syne text-sm font-bold text-charcoal">{value}</p>
                </div>
              ))}
            </div>

            {/* Choix de taille de sac (LOT VARIANTS, retour utilisateur) */}
            {product.variants?.length > 0 && (
              <div>
                <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-2">Choisir la taille</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedVariant(null); setQty(1) }}
                    className={`px-4 py-2.5 rounded-2xl font-syne text-sm font-bold border-2 transition-colors ${
                      !selectedVariant ? 'border-forest bg-forest/10 text-forest' : 'border-charcoal/10 text-charcoal/60 hover:border-charcoal/30'
                    }`}>
                    {product.unit} · {fmt(product.price)} FCFA
                  </button>
                  {product.variants.map(v => (
                    <button key={v.id}
                      onClick={() => { setSelectedVariant(v); setQty(1) }}
                      disabled={v.stock === 0}
                      className={`px-4 py-2.5 rounded-2xl font-syne text-sm font-bold border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        selectedVariant?.id === v.id ? 'border-forest bg-forest/10 text-forest' : 'border-charcoal/10 text-charcoal/60 hover:border-charcoal/30'
                      }`}>
                      {v.unit} · {fmt(v.price)} FCFA {v.stock === 0 && '(rupture)'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bannière conflit multi-boutique */}
            <AnimatePresence>
              {conflict && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3"
                >
                  <span className="text-xl shrink-0">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-syne text-sm font-bold text-amber-800">
                      Votre panier contient des produits de <span className="text-amber-600">{conflict.shopName}</span>
                    </p>
                    <p className="font-dm text-xs text-amber-600 mt-0.5">
                      Vous ne pouvez commander que chez une boutique à la fois.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setConflict(null)}
                        className="font-syne text-xs font-bold border-2 border-amber-300 text-amber-700 px-4 py-1.5 rounded-xl hover:bg-amber-100 transition-colors">
                        Annuler
                      </button>
                      <button onClick={handleConfirmReplace}
                        className="font-syne text-xs font-bold bg-amber-500 text-white px-4 py-1.5 rounded-xl hover:bg-amber-600 transition-colors">
                        Vider le panier et ajouter
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-white rounded-full px-4 py-3 shadow-card">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  aria-label="Diminuer la quantité"
                  className="w-7 h-7 rounded-full bg-charcoal/5 hover:bg-charcoal/10 flex items-center justify-center transition-colors">
                  <Minus size={14} />
                </button>
                <span className="font-syne font-bold text-charcoal w-6 text-center">{qty}</span>
                <button onClick={() => setQty(q => Math.min(activeOffer.stock, q + 1))}
                  aria-label="Augmenter la quantité"
                  className="w-7 h-7 rounded-full bg-charcoal/5 hover:bg-charcoal/10 flex items-center justify-center transition-colors">
                  <Plus size={14} />
                </button>
              </div>

              <motion.button onClick={handleAdd} whileTap={{ scale: 0.97 }} disabled={activeOffer.stock === 0}
                className={`flex-1 flex items-center justify-center gap-3 font-syne font-bold text-base py-4 rounded-full transition-all duration-300 disabled:opacity-50 ${added ? 'bg-green-500 text-cream' : 'bg-forest text-cream hover:bg-forest-light'}`}>
                <AnimatePresence mode="wait">
                  {added ? (
                    <motion.span key="ok" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                      <Check size={18} /> Ajouté au panier !
                    </motion.span>
                  ) : (
                    <motion.span key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                      <ShoppingBag size={18} />
                      {activeOffer.stock === 0 ? 'Rupture de stock' : `Ajouter · ${fmt(effectiveUnitPrice(activeOffer, qty) * qty)} FCFA`}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <button onClick={handleWish}
                aria-label={wished ? 'Retirer de la wishlist' : 'Ajouter à la wishlist'}
                aria-pressed={wished}
                className={`p-4 rounded-full border-2 transition-all ${wished ? 'bg-terra border-terra text-cream' : 'border-charcoal/15 text-charcoal/50 hover:border-terra hover:text-terra'}`}>
                <Heart size={20} fill={wished ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="flex items-center gap-6 mt-8 pt-8 border-t border-charcoal/8">
              {[{ icon: '🛡️', text: 'Qualité garantie' }, { icon: '🚚', text: 'Livraison 24h' }, { icon: '💵', text: 'Paiement à la livraison' }].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <span className="text-base">{icon}</span>
                  <span className="font-syne text-xs font-semibold text-charcoal/60">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="mb-24">
          <div className="mb-10">
            <p className="section-label mb-2">Témoignages</p>
            <h2 className="font-playfair text-4xl font-bold text-charcoal">Avis clients <span className="italic text-forest">({reviews.length})</span></h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
            {/* Liste avis */}
            <div className="space-y-4">
              {reviews.length === 0 && <p className="font-dm text-charcoal/40">Soyez le premier à laisser un avis.</p>}
              {reviews.map(r => (
                <div key={r.id} className="bg-white rounded-3xl p-6 shadow-card">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-syne text-sm font-bold text-charcoal">{r.user?.name}</p>
                      <p className="font-dm text-xs text-charcoal/40 mt-0.5">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <ReviewStars rating={r.rating} size={14} />
                  </div>
                  {r.comment && <p className="font-dm text-sm text-charcoal/70">{r.comment}</p>}
                  {r.sellerReply && (
                    <div className="mt-3 ml-4 pl-4 border-l-2 border-forest/20">
                      <p className="font-syne text-xs font-bold text-forest">Réponse de {product.shop?.name}</p>
                      <p className="font-dm text-sm text-charcoal/60 mt-1">{r.sellerReply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Formulaire avis */}
            {user?.role === 'BUYER' && (
              <div className="bg-white rounded-3xl p-6 shadow-card h-fit">
                <h3 className="font-playfair text-xl font-bold text-charcoal mb-4">Laisser un avis</h3>
                <form onSubmit={handleReview} className="space-y-4">
                  <div>
                    <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-2">Votre note</label>
                    <ReviewStars rating={myRating} size={28} interactive onChange={setMyRating} />
                  </div>
                  <div>
                    <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-2">Commentaire</label>
                    <textarea value={myComment} onChange={e => setMyComment(e.target.value)} rows={4} placeholder="Partagez votre expérience..."
                      className="w-full border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-forest transition-colors resize-none" />
                  </div>
                  {reviewError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 font-dm text-sm">
                      <AlertCircle size={15} className="shrink-0" />
                      <span className="flex-1">{reviewError}</span>
                      <button type="button" onClick={() => setReviewError(null)} aria-label="Fermer"><X size={13} /></button>
                    </div>
                  )}
                  <button type="submit" disabled={submittingReview}
                    className="w-full bg-forest text-cream font-syne font-bold py-3 rounded-2xl hover:bg-forest-light transition-colors disabled:opacity-60">
                    {submittingReview ? '...' : 'Publier mon avis'}
                  </button>
                  <p className="font-dm text-xs text-charcoal/40 text-center">Vous devez avoir reçu ce produit pour laisser un avis.</p>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div>
            <div className="mb-10">
              <p className="section-label mb-2">Vous aimerez aussi</p>
              <h2 className="font-playfair text-4xl font-bold text-charcoal">Produits <span className="italic text-forest">similaires</span></h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-[320px]">
              {related.map(p => <div key={p.id} className="h-full"><ProductCard product={p} /></div>)}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
