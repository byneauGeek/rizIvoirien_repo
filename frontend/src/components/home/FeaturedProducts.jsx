import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { motion, useInView } from 'framer-motion'
import { api } from '../../api/client'
import ProductCard from '../shop/ProductCard'

export default function FeaturedProducts() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [products, setProducts] = useState([])

  useEffect(() => {
    api.get('/products?limit=5&sort=createdAt').then(d => setProducts(d.products || [])).catch(() => {})
  }, [])

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }
  const item = { hidden: { opacity: 0, y: 32 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }

  return (
    <section className="py-24 bg-white" ref={ref}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-16">
          <div>
            <p className="section-label mb-3">Sélection</p>
            <h2 className="font-playfair text-5xl font-bold text-charcoal leading-tight">
              Les <span className="italic text-terra">incontournables</span>
            </h2>
          </div>
          <Link to="/shop" className="hidden md:flex items-center gap-2 font-syne text-sm font-bold text-forest hover:text-forest-light transition-colors group">
            Tout voir <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {products.length > 0 && (
          <motion.div variants={container} initial="hidden" animate={inView ? 'show' : 'hidden'}
            className={`grid gap-4 auto-rows-[280px] ${products.length >= 5 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
            <motion.div variants={item} className="row-span-2 col-span-1">
              <div className="h-full"><ProductCard product={products[0]} large /></div>
            </motion.div>
            {products.slice(1, products.length >= 5 ? 5 : 3).map((product) => (
              <motion.div key={product.id} variants={item}>
                <div className="h-full"><ProductCard product={product} /></div>
              </motion.div>
            ))}
          </motion.div>
        )}

        <div className="mt-10 text-center md:hidden">
          <Link to="/shop" className="btn-primary inline-flex items-center gap-2">Voir tous les produits <ArrowRight size={16} /></Link>
        </div>

        <div className="mt-20 relative overflow-hidden rounded-3xl bg-cream border border-forest/10 p-10 md:p-16 flex flex-col md:flex-row gap-8 items-center">
          <div className="absolute inset-0 bg-kente" />
          <div className="relative flex-1">
            <p className="font-syne text-xs font-bold tracking-widest uppercase text-terra mb-4">Notre promesse</p>
            <h3 className="font-playfair text-4xl font-bold text-charcoal leading-tight mb-4">
              Du producteur<br />à votre table,<br /><span className="italic text-forest">sans intermédiaire.</span>
            </h3>
            <p className="font-dm text-base text-charcoal/60 max-w-sm leading-relaxed">
              Chaque commande va directement de l'agriculteur ivoirien à votre porte. Prix justes, qualité garantie, traçabilité complète.
            </p>
          </div>
          <div className="relative shrink-0">
            <div className="w-64 h-64 blob overflow-hidden">
              <img src="https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=500&q=80" alt="Producteur" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-4 -right-4 bg-safran rounded-2xl px-5 py-3 shadow-glow">
              <p className="font-playfair text-2xl font-bold text-charcoal">0</p>
              <p className="font-syne text-xs font-bold text-charcoal/70">intermédiaire</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
