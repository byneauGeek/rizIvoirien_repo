/**
 * ProductPreviewCard — Aperçu live du produit tel qu'il apparaît sur la marketplace.
 * Miroir fidèle de ProductCard.jsx, en lecture seule.
 */
import { ShoppingBag, Star, MapPin, Package } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const BADGE_COLORS = {
  'Best-seller':    'bg-[#E8A217] text-charcoal',
  'Nouveau':        'bg-forest text-cream',
  'Bio':            'bg-green-600 text-cream',
  'Édition Limitée':'bg-terra text-cream',
  'Économique':     'bg-charcoal text-cream',
}

const fmt = n => Number(n || 0).toLocaleString('fr-FR')

export default function ProductPreviewCard({ form, shopName, shopRating = 0 }) {
  const { user } = useAuth()

  const coverImage = form.images?.[0] || ''
  const hasImage   = !!coverImage
  const price      = Number(form.price) || 0
  const stock      = Number(form.stock) ?? 0
  const name       = form.name || 'Nom du produit'
  const badge      = form.badge || ''
  const saleType   = form.saleType || 'BOTH'

  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-charcoal/8" />
        <span className="font-syne text-[10px] font-bold uppercase tracking-widest text-charcoal/30">Aperçu marketplace</span>
        <div className="h-px flex-1 bg-charcoal/8" />
      </div>

      {/* Card */}
      <div className="relative overflow-hidden rounded-3xl bg-white shadow-lg" style={{ aspectRatio: '4/5', maxWidth: 280, margin: '0 auto' }}>

        {/* Image ou placeholder */}
        {hasImage ? (
          <img src={coverImage} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-charcoal/8 to-charcoal/20 flex flex-col items-center justify-center gap-2">
            <Package size={36} className="text-charcoal/20" />
            <p className="font-dm text-xs text-charcoal/25">Ajoutez une photo</p>
          </div>
        )}

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/92 via-charcoal/20 to-transparent pointer-events-none" />

        {/* Badges top */}
        <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            {badge && (
              <span className={`font-syne text-[11px] font-bold px-3 py-1 rounded-full ${BADGE_COLORS[badge] || 'bg-charcoal text-cream'}`}>
                {badge}
              </span>
            )}
            {saleType === 'WHOLESALE' && (
              <span className="font-syne text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white">
                📦 Gros
              </span>
            )}
            {saleType === 'RETAIL' && (
              <span className="font-syne text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500 text-white">
                🛒 Détail
              </span>
            )}
          </div>
        </div>

        {/* Stock faible */}
        {stock > 0 && stock < 30 && (
          <div className="absolute top-12 left-4">
            <span className="font-syne text-[10px] font-bold bg-terra/90 text-cream px-2.5 py-1 rounded-full">
              ⚡ {stock} restants
            </span>
          </div>
        )}

        {/* Rupture */}
        {stock === 0 && price > 0 && (
          <div className="absolute inset-0 bg-charcoal/60 flex items-center justify-center">
            <span className="font-syne font-bold text-cream text-sm bg-charcoal/80 px-4 py-2 rounded-full">
              Rupture de stock
            </span>
          </div>
        )}

        {/* Infos bas */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MapPin size={10} className="text-cream/50" />
            <span className="font-syne text-[10px] text-cream/50 uppercase tracking-wider truncate">
              {shopName || 'Votre boutique'}
            </span>
          </div>
          <h3 className="font-playfair text-lg font-bold text-cream leading-tight mb-3 line-clamp-2">
            {name}
          </h3>
          <div className="flex items-end justify-between gap-2">
            <div>
              {price > 0 ? (
                <p className="font-playfair text-2xl font-bold text-[#E8A217]">
                  {fmt(price)}
                  <span className="font-dm text-sm font-normal text-[#E8A217]/80"> FCFA</span>
                </p>
              ) : (
                <p className="font-playfair text-xl font-bold text-cream/40 italic">Prix non défini</p>
              )}
              {shopRating > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star size={11} className="fill-[#E8A217] text-[#E8A217]" />
                  <span className="font-syne text-xs text-cream/70 font-semibold">{Number(shopRating).toFixed(1)}</span>
                </div>
              )}
            </div>
            {stock > 0 && (
              <div className="flex items-center gap-1.5 bg-[#E8A217] text-charcoal font-syne text-xs font-bold px-3.5 py-2 rounded-full shrink-0">
                <ShoppingBag size={13} />
                Ajouter
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fiche détail sous la carte */}
      {(form.description || form.category || form.unit || form.origin) && (
        <div className="bg-white rounded-2xl p-4 space-y-2.5 shadow-sm border border-gray-50" style={{ maxWidth: 280, margin: '0 auto' }}>
          {form.category && (
            <Row label="Catégorie" value={form.category} />
          )}
          {form.unit && (
            <Row label="Unité" value={form.unit} />
          )}
          {form.origin && (
            <Row label="Origine" value={form.origin} />
          )}
          {form.harvest && (
            <Row label="Récolte" value={form.harvest} />
          )}
          {form.description && (
            <div className="pt-1 border-t border-charcoal/6">
              <p className="font-dm text-xs text-charcoal/50 leading-relaxed line-clamp-4">
                {form.description}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Notice live */}
      <p className="font-dm text-[10px] text-charcoal/25 text-center" style={{ maxWidth: 280, margin: '0 auto' }}>
        Mise à jour en temps réel
      </p>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/30">{label}</span>
      <span className="font-dm text-xs text-charcoal/70">{value}</span>
    </div>
  )
}
