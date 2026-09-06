import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { fmtOrderId } from '../../utils/status'
import { Star, MessageSquare, RefreshCw, TrendingUp, Package } from 'lucide-react'
import { motion } from 'framer-motion'

const fmtDate = d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

function Stars({ rating, size = 13 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size}
          className={i <= Math.round(rating) ? 'fill-[#E8A217] text-[#E8A217]' : 'text-charcoal/15'} />
      ))}
    </div>
  )
}

// LOT REVIEW-2 (audit XXX RIZ) : jusqu'ici ce tab n'affichait QUE les avis
// boutique (ShopReview) — un avis laissé sur un PRODUIT (Review, le cas le
// plus fréquent : ProductPage.jsx → POST /reviews) n'apparaissait JAMAIS,
// bien qu'enregistré et correctement calculé côté Product.rating. Ce ne sont
// pas deux vues du même chiffre : la note boutique (expérience globale) et la
// note produit (un article précis) restent deux métriques distinctes,
// affichées séparément plutôt que fusionnées en un score inventé — cf. audit
// partie 11 ("une seule source de vérité PAR métrique, jamais un double calcul").
function ReviewSummary({ title, avg, total, reviews, emptyLabel }) {
  const distribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(r.rating) === star).length,
    pct: total > 0 ? Math.round((reviews.filter(r => Math.round(r.rating) === star).length / total) * 100) : 0,
  }))

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
      <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-4">{title}</p>
      {total === 0 ? (
        <p className="font-dm text-sm text-charcoal/30 italic">{emptyLabel}</p>
      ) : (
        <div className="flex gap-8 items-center flex-wrap">
          <div className="text-center">
            <p className="font-playfair text-5xl font-bold text-charcoal leading-none">{Number(avg).toFixed(1)}</p>
            <Stars rating={avg} size={15} />
            <p className="font-dm text-xs text-charcoal/40 mt-1">{total} avis</p>
          </div>
          <div className="flex-1 min-w-48 space-y-1.5">
            {distribution.map(({ star, count, pct }) => (
              <div key={star} className="flex items-center gap-2">
                <span className="font-dm text-xs text-charcoal/50 w-3 text-right">{star}</span>
                <Star size={10} className="fill-[#E8A217] text-[#E8A217] shrink-0" />
                <div className="flex-1 h-1.5 bg-charcoal/8 rounded-full overflow-hidden">
                  <div className="h-full bg-[#E8A217] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="font-dm text-xs text-charcoal/40 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
          {total >= 3 && (
            <div className="flex flex-col items-center gap-1 bg-green-50 rounded-2xl px-5 py-4">
              <TrendingUp size={20} className="text-green-600" />
              <p className="font-syne text-xs font-bold text-green-700">
                {avg >= 4.5 ? 'Excellent' : avg >= 4 ? 'Très bien' : avg >= 3 ? 'Bien' : 'À améliorer'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReviewCard({ review, productLabel }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#E8A217]/10 flex items-center justify-center shrink-0">
            <span className="font-playfair font-bold text-[#E8A217] text-sm">{review.user?.name?.[0] || '?'}</span>
          </div>
          <div>
            <p className="font-syne text-sm font-bold text-charcoal">{review.user?.name || 'Client'}</p>
            <Stars rating={review.rating} size={12} />
          </div>
        </div>
        <p className="font-dm text-xs text-charcoal/30 shrink-0">{fmtDate(review.createdAt)}</p>
      </div>

      {productLabel && (
        <div className="mt-2 pl-12">
          <span className="inline-flex items-center gap-1 font-syne text-[10px] font-bold text-forest bg-forest/8 px-2 py-0.5 rounded-full">
            <Package size={10} /> {productLabel}
          </span>
        </div>
      )}

      {review.comment && (
        <p className="font-dm text-sm text-charcoal/70 mt-3 leading-relaxed pl-12">"{review.comment}"</p>
      )}

      {review.orderId && (
        <div className="mt-2 pl-12">
          <span className="font-syne text-[10px] font-bold text-charcoal/30 bg-charcoal/5 px-2 py-0.5 rounded-full">
            Commande {fmtOrderId(review.orderId)}
          </span>
        </div>
      )}
    </motion.div>
  )
}

export default function VendorReviewsTab() {
  const [shop, setShop] = useState(null)
  const [shopReviews, setShopReviews] = useState([])
  const [productReviews, setProductReviews] = useState({ reviews: [], avg: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const dash = await api.get('/shops/my/dashboard')
      setShop(dash.shop)
      const [shopRev, prodRev] = await Promise.all([
        api.get(`/shop-reviews/${dash.shop.id}`),
        api.get(`/reviews/shop/${dash.shop.id}`),
      ])
      setShopReviews(Array.isArray(shopRev) ? shopRev : [])
      setProductReviews(prodRev)
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const shopAvg = shop?.rating || 0
  const shopTotal = shop?.reviewCount || 0

  // Fusionne les deux flux en une seule liste chronologique, chacun gardant
  // son étiquette d'origine (produit concerné, ou générique "boutique").
  const merged = [
    ...shopReviews.map(r => ({ ...r, _kind: 'shop' })),
    ...productReviews.reviews.map(r => ({ ...r, _kind: 'product' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Boutique</p>
          <h1 className="font-playfair text-3xl font-bold text-charcoal">Avis clients</h1>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-charcoal/10 rounded-2xl font-syne text-sm font-bold text-charcoal/60 hover:text-charcoal transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-[#E8A217]/20 border-t-[#E8A217] rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-red-100">
          <p className="font-syne font-bold text-red-500 mb-2">Impossible de charger les avis</p>
          <p className="font-dm text-sm text-charcoal/40 mb-4">{error}</p>
          <button onClick={load} className="font-syne text-sm font-bold text-forest underline">Réessayer</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReviewSummary title="Avis boutique (expérience globale)" avg={shopAvg} total={shopTotal}
              reviews={shopReviews} emptyLabel="Aucun avis boutique pour l'instant." />
            <ReviewSummary title="Avis produits" avg={productReviews.avg} total={productReviews.total}
              reviews={productReviews.reviews} emptyLabel="Aucun avis produit pour l'instant." />
          </div>

          {merged.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-50">
              <MessageSquare size={36} className="mx-auto text-charcoal/20 mb-3" />
              <p className="font-syne font-bold text-charcoal/40">Aucun avis pour l'instant</p>
              <p className="font-dm text-sm text-charcoal/30 mt-1">Les avis s'affichent après chaque livraison confirmée.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {merged.map(review => (
                <ReviewCard key={`${review._kind}-${review.id}`} review={review}
                  productLabel={review._kind === 'product' ? review.product?.name : null} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
