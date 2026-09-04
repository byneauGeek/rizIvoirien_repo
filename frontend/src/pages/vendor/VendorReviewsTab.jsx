import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { fmtOrderId } from '../../utils/status'
import { Star, MessageSquare, RefreshCw, TrendingUp } from 'lucide-react'
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

export default function VendorReviewsTab() {
  const [reviews, setReviews]   = useState([])
  const [shopId, setShopId]     = useState(null)
  const [shop, setShop]         = useState(null)
  const [loading, setLoading]   = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const dash = await api.get('/shops/my/dashboard')
      setShop(dash.shop)
      setShopId(dash.shop.id)
      const data = await api.get(`/shop-reviews/${dash.shop.id}`)
      setReviews(Array.isArray(data) ? data : [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  /* ── Statistiques ── */
  const avg   = shop?.rating || 0
  const total = shop?.reviewCount || 0

  const distribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(r.rating) === star).length,
    pct: total > 0 ? Math.round((reviews.filter(r => Math.round(r.rating) === star).length / total) * 100) : 0,
  }))

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
      ) : (
        <>
          {/* Résumé */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
            <div className="flex gap-8 items-center flex-wrap">
              {/* Note globale */}
              <div className="text-center">
                <p className="font-playfair text-6xl font-bold text-charcoal leading-none">
                  {total > 0 ? Number(avg).toFixed(1) : '—'}
                </p>
                <Stars rating={avg} size={16} />
                <p className="font-dm text-xs text-charcoal/40 mt-1">{total} avis</p>
              </div>

              {/* Distribution par étoile */}
              <div className="flex-1 min-w-48 space-y-1.5">
                {distribution.map(({ star, count, pct }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="font-dm text-xs text-charcoal/50 w-3 text-right">{star}</span>
                    <Star size={10} className="fill-[#E8A217] text-[#E8A217] shrink-0" />
                    <div className="flex-1 h-1.5 bg-charcoal/8 rounded-full overflow-hidden">
                      <div className="h-full bg-[#E8A217] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-dm text-xs text-charcoal/40 w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>

              {/* Tendance */}
              {total >= 3 && (
                <div className="flex flex-col items-center gap-1 bg-green-50 rounded-2xl px-5 py-4">
                  <TrendingUp size={20} className="text-green-600" />
                  <p className="font-syne text-xs font-bold text-green-700">
                    {avg >= 4.5 ? 'Excellent' : avg >= 4 ? 'Très bien' : avg >= 3 ? 'Bien' : 'À améliorer'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Liste des avis */}
          {reviews.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-50">
              <MessageSquare size={36} className="mx-auto text-charcoal/20 mb-3" />
              <p className="font-syne font-bold text-charcoal/40">Aucun avis pour l'instant</p>
              <p className="font-dm text-sm text-charcoal/30 mt-1">Les avis s'affichent après chaque livraison confirmée.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review, i) => (
                <motion.div key={review.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar initiale */}
                      <div className="w-9 h-9 rounded-xl bg-[#E8A217]/10 flex items-center justify-center shrink-0">
                        <span className="font-playfair font-bold text-[#E8A217] text-sm">
                          {review.user?.name?.[0] || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-syne text-sm font-bold text-charcoal">{review.user?.name || 'Client'}</p>
                        <Stars rating={review.rating} size={12} />
                      </div>
                    </div>
                    <p className="font-dm text-xs text-charcoal/30 shrink-0">{fmtDate(review.createdAt)}</p>
                  </div>

                  {review.comment && (
                    <p className="font-dm text-sm text-charcoal/70 mt-3 leading-relaxed pl-12">
                      "{review.comment}"
                    </p>
                  )}

                  {/* Badge commande liée */}
                  {review.orderId && (
                    <div className="mt-2 pl-12">
                      <span className="font-syne text-[10px] font-bold text-charcoal/30 bg-charcoal/5 px-2 py-0.5 rounded-full">
                        Commande {fmtOrderId(review.orderId)}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
