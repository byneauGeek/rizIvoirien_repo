import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X, ChevronDown, Search, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import ProductCard from '../components/shop/ProductCard'
import { api } from '../api/client'
import { usePageTitle } from '../hooks/usePageTitle'
import { ProductCardSkeleton } from '../components/ui/Skeleton'
import SEOHead from '../components/SEOHead'
import { categoryIcon } from '../utils/categoryIcons'

const SORTS = [
  { value: 'createdAt', label: 'Plus récents' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'rating', label: 'Mieux notés' },
]

export default function ShopPage() {
  const [params, setParams] = useSearchParams()
  const [filterOpen, setFilterOpen] = useState(false)
  const [sort, setSort] = useState('createdAt')
  const [priceMax, setPriceMax] = useState(10000)
  const [certifiedOnly, setCertifiedOnly] = useState(params.get('certified') === 'true')
  const [activeCategory, setActiveCategory] = useState(params.get('category') || '')
  usePageTitle(activeCategory ? `${activeCategory} — Produits` : 'Tous nos produits')

  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const LIMIT = 20

  // Charger catégories — best-effort : un échec dégrade juste le filtre
  // catégorie (liste vide), sans empêcher la page de fonctionner.
  useEffect(() => {
    api.get('/products/categories').then(setCategories).catch(() => {})
  }, [])

  // Charger produits avec filtres — un échec ici NE doit jamais ressembler à
  // "Aucun produit" (l'état vide légitime, filtres trop restrictifs) : les
  // deux étaient auparavant indiscernables pour le visiteur.
  const load = useCallback(() => {
    setLoading(true); setError(null)
    const search = params.get('search') || ''
    const qs = new URLSearchParams({
      limit: LIMIT,
      offset: page * LIMIT,
      sort,
      ...(activeCategory && { category: activeCategory }),
      ...(certifiedOnly && { certified: 'true' }),
      ...(priceMax < 10000 && { priceMax }),
      ...(search && { search }),
    })
    api.get(`/products?${qs}`)
      .then(d => { setProducts(d.products || []); setTotal(d.total || 0) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [activeCategory, certifiedOnly, priceMax, sort, page, params])

  useEffect(() => { load() }, [load])

  const searchQ = params.get('search') || ''

  return (
    <div className="min-h-screen bg-cream">
      <SEOHead title="Boutiques — RizIvoirien" description="Découvrez toutes les boutiques de riz ivoirien certifiées sur notre marketplace." />
      <Navbar />

      {/* Page header */}
      <div className="bg-forest pt-28 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-kente" />
        <div className="absolute inset-0 bg-gradient-to-b from-forest-dark/50 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6">
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-safran mb-3">Marketplace</p>
          <h1 className="font-playfair text-5xl md:text-6xl font-bold text-cream mb-4">
            {searchQ ? <>Résultats pour <span className="italic text-safran">"{searchQ}"</span></> : <>Tous nos <span className="italic text-safran">produits</span></>}
          </h1>
          <p className="font-dm text-base text-cream/60 max-w-md">{total} référence{total !== 1 ? 's' : ''} directement des producteurs ivoiriens.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Category pills */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 mb-8">
          <button onClick={() => { setActiveCategory(''); setPage(0) }}
            className={`shrink-0 font-syne text-sm font-semibold px-5 py-2.5 rounded-full border-2 transition-all ${activeCategory === '' ? 'bg-forest border-forest text-cream' : 'border-forest/20 text-charcoal hover:border-forest/40'}`}>
            Tout
          </button>
          {categories.map(({ category, count }) => (
            <button key={category} onClick={() => { setActiveCategory(c => c === category ? '' : category); setPage(0) }}
              className={`shrink-0 flex items-center gap-2 font-syne text-sm font-semibold px-5 py-2.5 rounded-full border-2 transition-all ${activeCategory === category ? 'bg-forest border-forest text-cream' : 'border-forest/20 text-charcoal hover:border-forest/40'}`}>
              <span>{categoryIcon(category)}</span>
              {category}
              <span className="font-dm text-xs opacity-60">({count})</span>
            </button>
          ))}
        </div>

        {/* Mobile filter drawer */}
        <AnimatePresence>
          {filterOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50 lg:hidden" onClick={() => setFilterOpen(false)}>
              <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.25 }}
                className="absolute inset-y-0 left-0 w-72 bg-white p-6 overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-syne font-bold text-xs tracking-widest uppercase text-charcoal/40">Filtres</h3>
                  <button onClick={() => setFilterOpen(false)} aria-label="Fermer les filtres" className="w-8 h-8 rounded-full bg-charcoal/8 flex items-center justify-center"><X size={16} /></button>
                </div>
                <div className="mb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={certifiedOnly} onChange={() => setCertifiedOnly(v => !v)} className="sr-only" />
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${certifiedOnly ? 'bg-forest border-forest' : 'border-charcoal/20'}`}>
                      {certifiedOnly && <span className="text-cream text-xs">✓</span>}
                    </div>
                    <span className="font-dm text-sm text-charcoal">Boutiques certifiées</span>
                  </label>
                </div>
                <div className="mb-6">
                  <div className="flex justify-between mb-3">
                    <span className="font-syne text-xs font-bold text-charcoal/50 uppercase tracking-wider">Prix max</span>
                    <span className="font-syne text-sm font-bold text-forest">{priceMax.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <input type="range" min={500} max={10000} step={500} value={priceMax}
                    onChange={e => setPriceMax(Number(e.target.value))} className="w-full accent-forest" />
                </div>
                <button onClick={() => { setCertifiedOnly(false); setPriceMax(10000); setActiveCategory(''); setFilterOpen(false) }}
                  className="w-full font-syne text-xs font-bold text-terra hover:text-terra/70 transition-colors py-2">Réinitialiser</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="bg-white rounded-3xl p-6 shadow-card sticky top-24">
              <h3 className="font-syne font-bold text-xs tracking-widest uppercase text-charcoal/40 mb-6">Filtres</h3>
              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={certifiedOnly} onChange={() => { setCertifiedOnly(v => !v); setPage(0) }} className="sr-only" />
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${certifiedOnly ? 'bg-forest border-forest' : 'border-charcoal/20 group-hover:border-forest/50'}`}>
                    {certifiedOnly && <span className="text-cream text-xs">✓</span>}
                  </div>
                  <span className="font-dm text-sm text-charcoal">Boutiques certifiées</span>
                  <span className="ml-auto font-syne text-xs font-bold bg-gold/20 text-gold px-2 py-0.5 rounded-full">Pro</span>
                </label>
              </div>
              <div className="mb-6">
                <div className="flex justify-between mb-3">
                  <span className="font-syne text-xs font-bold text-charcoal/50 uppercase tracking-wider">Prix max</span>
                  <span className="font-syne text-sm font-bold text-forest">{priceMax.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <input type="range" min={500} max={10000} step={500} value={priceMax}
                  onChange={e => { setPriceMax(Number(e.target.value)); setPage(0) }} className="w-full accent-forest" />
                <div className="flex justify-between mt-1">
                  <span className="font-dm text-xs text-charcoal/40">500 FCFA</span>
                  <span className="font-dm text-xs text-charcoal/40">10 000 FCFA</span>
                </div>
              </div>
              <button onClick={() => { setCertifiedOnly(false); setPriceMax(10000); setActiveCategory(''); setPage(0) }}
                className="w-full font-syne text-xs font-bold text-terra hover:text-terra/70 transition-colors py-2">Réinitialiser les filtres</button>
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-8">
              <p className="font-dm text-sm text-charcoal/60">
                <span className="font-semibold text-charcoal">{total}</span> produit{total !== 1 ? 's' : ''} trouvé{total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select value={sort} onChange={e => { setSort(e.target.value); setPage(0) }}
                    className="appearance-none bg-white border-2 border-forest/15 font-syne text-sm font-semibold text-charcoal px-4 py-2.5 pr-9 rounded-full focus:outline-none focus:border-forest cursor-pointer">
                    {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 pointer-events-none" />
                </div>
                <button onClick={() => setFilterOpen(v => !v)}
                  className="lg:hidden flex items-center gap-2 bg-white border-2 border-forest/15 font-syne text-sm font-semibold px-4 py-2.5 rounded-full">
                  <SlidersHorizontal size={14} /> Filtres
                </button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 auto-rows-[320px]">
                {[...Array(6)].map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : error ? (
              <div className="text-center py-24">
                <AlertCircle size={48} className="mx-auto text-red-300 mb-4" />
                <h3 className="font-playfair text-2xl font-bold text-charcoal mb-2">Impossible de charger les produits</h3>
                <p className="font-dm text-charcoal/50 mb-6">{error}</p>
                <button onClick={load} className="btn-primary">Réessayer</button>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-24">
                <span className="text-6xl block mb-4">🌾</span>
                <h3 className="font-playfair text-2xl font-bold text-charcoal mb-2">Aucun produit</h3>
                <p className="font-dm text-charcoal/50">Essayez d'ajuster vos filtres.</p>
              </div>
            ) : (
              <>
                <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 auto-rows-[320px]">
                  <AnimatePresence mode="popLayout">
                    {products.map((product, i) => (
                      <motion.div key={product.id} layout initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}>
                        <div className="h-full"><ProductCard product={product} /></div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>

                {/* Pagination */}
                {total > LIMIT && (
                  <div className="flex justify-center gap-2 mt-10">
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                      className="font-syne text-sm font-bold px-6 py-2.5 rounded-full border-2 border-charcoal/15 disabled:opacity-40 hover:border-forest transition-colors">
                      ← Précédent
                    </button>
                    <span className="font-dm text-sm text-charcoal/50 flex items-center px-4">
                      Page {page + 1} / {Math.ceil(total / LIMIT)}
                    </span>
                    <button disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(p => p + 1)}
                      className="font-syne text-sm font-bold px-6 py-2.5 rounded-full border-2 border-charcoal/15 disabled:opacity-40 hover:border-forest transition-colors">
                      Suivant →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
