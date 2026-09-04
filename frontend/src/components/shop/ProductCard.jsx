import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Star, MapPin, Heart } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { motion } from 'framer-motion'
import { firstImage } from '../../utils/images'
import { api } from '../../api/client'

const BADGE_COLORS = {
  'Best-seller': 'bg-safran text-charcoal',
  'Nouveau': 'bg-forest text-cream',
  'Bio': 'bg-green-600 text-cream',
  'Édition Limitée': 'bg-terra text-cream',
  'Économique': 'bg-charcoal text-cream',
}

export default function ProductCard({ product, large = false }) {
  const { addItem, replaceCart } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [added,    setAdded]    = useState(false)
  const [wished,   setWished]   = useState(false)
  const [conflict, setConflict] = useState(null) // { shopName }

  const img      = firstImage(product.images, product.image || '')
  const shopName = product.shop?.name || product.shopName || ''
  const rating   = product.rating ?? product.shop?.rating ?? 5
  const reviews  = product.reviewCount ?? product.reviews ?? 0
  const certified = product.shop?.certified ?? product.certified ?? false

  const handleAdd = (e) => {
    e.preventDefault()
    const result = addItem({ ...product, images: product.images, shopName })
    if (result.conflict) {
      setConflict({ shopName: result.shopName })
      return
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  const handleConfirmReplace = (e) => {
    e.preventDefault()
    replaceCart({ ...product, images: product.images, shopName })
    setConflict(null)
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  const handleWish = async (e) => {
    e.preventDefault()
    if (!user || user.role !== 'BUYER') return
    setWished(v => !v)
    try {
      if (wished) await api.delete(`/wishlist/${product.id}`)
      else await api.post(`/wishlist/${product.id}`, {})
    } catch { setWished(v => !v) }
  }

  return (
    <Link to={`/product/${product.slug}`} className="block group h-full">
      <motion.div
        className={`relative overflow-hidden rounded-3xl bg-white shadow-card tilt-card h-full ${large ? 'aspect-[4/5]' : ''}`}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Image */}
        <img
          src={img}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/20 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            {product.badge && (
              <span className={`font-syne text-[11px] font-bold px-3 py-1 rounded-full ${BADGE_COLORS[product.badge] || 'bg-charcoal text-cream'}`}>
                {product.badge}
              </span>
            )}
            {(product.saleType === 'WHOLESALE' || product.saleType === 'BOTH') && (
              <span className="font-syne text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white">
                📦 En gros
              </span>
            )}
            {product.saleType === 'RETAIL' && (
              <span className="font-syne text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500 text-white">
                🛒 Détail
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {certified && (
              <span className="font-syne text-[10px] font-bold bg-gold text-charcoal px-2.5 py-1 rounded-full">
                ✓ Certifié
              </span>
            )}
            {user?.role === 'BUYER' && (
              <button onClick={handleWish}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${wished ? 'bg-terra text-cream' : 'bg-white/20 text-cream hover:bg-white/40'}`}>
                <Heart size={14} fill={wished ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
        </div>

        {/* Overlay conflit multi-boutique */}
        {conflict && (
          <div className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-5 z-10">
            <p className="font-syne text-xs font-bold text-cream text-center">
              Votre panier contient des produits de<br />
              <span className="text-safran">{conflict.shopName}</span>
            </p>
            <p className="font-dm text-[11px] text-cream/60 text-center">Vider le panier et ajouter ce produit ?</p>
            <div className="flex gap-2 w-full">
              <button onClick={e => { e.preventDefault(); setConflict(null) }}
                className="flex-1 font-syne text-xs font-bold border border-cream/30 text-cream py-2 rounded-xl hover:bg-cream/10 transition-colors">
                Annuler
              </button>
              <button onClick={handleConfirmReplace}
                className="flex-1 font-syne text-xs font-bold bg-safran text-charcoal py-2 rounded-xl hover:bg-safran/90 transition-colors">
                Vider et ajouter
              </button>
            </div>
          </div>
        )}

        {/* Stock warning */}
        {product.stock < 30 && product.stock > 0 && (
          <div className="absolute top-12 left-4">
            <span className="font-syne text-[10px] font-bold bg-terra/90 text-cream px-2.5 py-1 rounded-full">
              ⚡ {product.stock} restants
            </span>
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-charcoal/60 flex items-center justify-center">
            <span className="font-syne font-bold text-cream text-sm bg-charcoal/80 px-4 py-2 rounded-full">Rupture de stock</span>
          </div>
        )}

        {/* Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div
            className="flex items-center gap-1.5 mb-2 cursor-pointer group/shop"
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              const sid = product.shop?.id ?? product.shopId
              if (sid) navigate(`/shop/${sid}`)
            }}
          >
            <MapPin size={10} className="text-cream/50 group-hover/shop:text-cream/80 transition-colors" />
            <span className="font-syne text-[10px] text-cream/50 uppercase tracking-wider truncate group-hover/shop:text-cream/80 transition-colors">
              {shopName}
            </span>
          </div>
          <h3 className="font-playfair text-lg font-bold text-cream leading-tight mb-3 line-clamp-2">{product.name}</h3>
          <div className="flex items-end justify-between">
            <div>
              <p className="font-playfair text-2xl font-bold text-safran">
                {product.price.toLocaleString('fr-FR')}
                <span className="font-dm text-sm font-normal text-safran/80"> FCFA</span>
              </p>
              {(product.saleType === 'WHOLESALE' || product.saleType === 'BOTH') && product.wholesalePrice && (
                <p className="font-dm text-xs text-cream/70 mt-0.5">
                  Gros : {product.wholesalePrice.toLocaleString('fr-FR')} FCFA
                  {product.minWholesaleQty ? ` · min. ${product.minWholesaleQty} sac${product.minWholesaleQty > 1 ? 's' : ''}` : ''}
                </p>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                <Star size={11} className="fill-safran text-safran" />
                <span className="font-syne text-xs text-cream/70 font-semibold">{Number(rating).toFixed(1)}</span>
                <span className="font-dm text-xs text-cream/40">({reviews})</span>
              </div>
            </div>
            {product.stock > 0 && (
              <motion.button onClick={handleAdd} whileTap={{ scale: 0.9 }}
                className={`flex items-center gap-2 font-syne text-xs font-bold px-4 py-2.5 rounded-full transition-all duration-200 ${added ? 'bg-green-500 text-cream' : 'bg-safran text-charcoal hover:bg-safran/90'}`}>
                <ShoppingBag size={14} />
                {added ? 'Ajouté !' : 'Ajouter'}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  )
}
