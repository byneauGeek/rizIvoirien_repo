import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES } from '../../data/mockData'

export default function CategorySection() {
  const [active, setActive] = useState(null)

  return (
    <section className="py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <p className="section-label mb-3">Explorer</p>
            <h2 className="font-playfair text-5xl font-bold text-charcoal leading-tight">
              Toutes les <span className="italic text-forest">variétés</span>
            </h2>
          </div>
          <p className="font-dm text-base text-charcoal/60 max-w-sm leading-relaxed">
            De Man à Korhogo, chaque région ivoirienne offre un riz unique. Découvrez nos six grandes familles.
          </p>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {CATEGORIES.map((cat, i) => (
            <Link
              to={`/shop?category=${cat.id}`}
              key={cat.id}
              className={`group relative flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border-2 transition-all duration-300 cursor-pointer ${
                active === cat.id
                  ? 'border-forest bg-forest text-cream shadow-card-hover'
                  : 'border-forest/10 bg-white hover:border-forest/30 hover:shadow-card'
              }`}
              onMouseEnter={() => setActive(cat.id)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="text-3xl group-hover:scale-110 transition-transform duration-300">
                {cat.icon}
              </span>
              <span
                className={`font-syne text-sm font-bold text-center transition-colors ${
                  active === cat.id ? 'text-cream' : 'text-charcoal'
                }`}
              >
                {cat.label}
              </span>
              <span
                className={`font-dm text-xs transition-colors ${
                  active === cat.id ? 'text-cream/70' : 'text-charcoal/40'
                }`}
              >
                {cat.count} produits
              </span>

              {/* Active indicator */}
              {active === cat.id && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-safran rounded-full" />
              )}
            </Link>
          ))}
        </div>

        {/* CTA strip */}
        <div className="mt-12 bg-forest rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-playfair text-2xl font-bold text-cream mb-1">
              Vous ne savez pas lequel choisir ?
            </p>
            <p className="font-dm text-sm text-cream/60">
              Notre guide du riz ivoirien vous aide à trouver la variété parfaite pour chaque plat.
            </p>
          </div>
          <Link
            to="/guide"
            className="shrink-0 bg-safran text-charcoal font-syne font-bold px-8 py-4 rounded-full hover:bg-safran-light transition-colors text-sm whitespace-nowrap"
          >
            Consulter le guide
          </Link>
        </div>
      </div>
    </section>
  )
}
