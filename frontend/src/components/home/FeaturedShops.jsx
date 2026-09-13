import { Link } from 'react-router-dom'
import { Star, MapPin, ArrowRight } from 'lucide-react'
import { motion, useInView } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'
import { api } from '../../api/client'

export default function FeaturedShops() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [shops, setShops] = useState([])

  useEffect(() => {
    api.get('/shops?certified=true&limit=3').then(d => setShops(d.shops || [])).catch(() => {})
  }, [])

  return (
    <section className="py-24 bg-cream/50" ref={ref}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-16">
          <div>
            <p className="section-label mb-3">Producteurs</p>
            <h2 className="font-playfair text-5xl font-bold text-charcoal">
              Nos boutiques <span className="italic text-forest">certifiées</span>
            </h2>
          </div>
          <Link to="/shop" className="hidden md:flex items-center gap-2 font-syne text-sm font-bold text-forest hover:text-forest-light transition-colors group">
            Toutes les boutiques <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {shops.map((shop, i) => (
            <motion.div key={shop.id} initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}>
              <Link to={`/shop/${shop.id}`} className="block group">
                <div className="bg-white rounded-3xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1">
                  <div className="relative h-48 overflow-hidden">
                    {shop.coverImage
                      ? <img src={shop.coverImage} alt={shop.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                      : <div className="w-full h-full bg-forest/10" />
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
                    {shop.certified && (
                      <span className="absolute top-4 right-4 font-syne text-[10px] font-bold bg-gold text-charcoal px-3 py-1 rounded-full">✓ Certifiée</span>
                    )}
                    {shop.avatar && (
                      <div className="absolute -bottom-8 left-6">
                        <img src={shop.avatar} alt={shop.name} className="w-16 h-16 rounded-2xl object-cover shadow-card" style={{ border: '3px solid white' }} loading="lazy" />
                      </div>
                    )}
                  </div>
                  <div className="pt-12 px-6 pb-6">
                    <h3 className="font-playfair text-xl font-bold text-charcoal leading-tight">{shop.name}</h3>
                    <div className="flex items-center gap-3 mt-2 mb-3">
                      <div className="flex items-center gap-1">
                        <Star size={12} className="fill-safran text-safran" />
                        <span className="font-syne text-sm font-bold text-charcoal">{shop.rating?.toFixed(1)}</span>
                        <span className="font-dm text-xs text-charcoal/40">({shop.reviewCount})</span>
                      </div>
                      {shop.location && (
                        <>
                          <span className="text-charcoal/20">·</span>
                          <div className="flex items-center gap-1">
                            <MapPin size={11} className="text-charcoal/40" />
                            <span className="font-dm text-xs text-charcoal/50">{shop.location}</span>
                          </div>
                        </>
                      )}
                    </div>
                    {shop.description && (
                      <p className="font-dm text-sm text-charcoal/60 leading-relaxed mb-4 line-clamp-2">{shop.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-charcoal/6">
                      {shop.speciality && (
                        <div>
                          <p className="font-syne text-xs text-charcoal/40 uppercase tracking-wider">Spécialité</p>
                          <p className="font-syne text-xs font-bold text-forest mt-0.5">{shop.speciality}</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="font-syne text-xs text-charcoal/40 uppercase tracking-wider">Produits</p>
                        <p className="font-playfair text-2xl font-bold text-charcoal">{shop._count?.products || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
          {shops.length === 0 && [1,2,3].map(i => (
            <div key={i} className="bg-white rounded-3xl h-72 animate-pulse shadow-card" />
          ))}
        </div>
      </div>
    </section>
  )
}
