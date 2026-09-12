import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, MapPin } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
})

export default function Hero() {
  return (
    <section className="relative min-h-screen bg-forest-dark overflow-hidden flex items-center">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=1800&q=80"
          alt="Rizières de Côte d'Ivoire"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-forest-dark via-forest-dark/80 to-forest-dark/40" />
      </div>

      {/* Kente pattern overlay */}
      <div className="absolute inset-0 bg-kente opacity-100 pointer-events-none" />

      {/* Decorative circle */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-safran/10 translate-x-1/3" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-cream/5 translate-x-1/2" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-screen">
        {/* Left — text */}
        <div className="flex flex-col justify-center">
          <motion.div {...fadeUp(0.1)} className="flex items-center gap-3 mb-8">
            <span className="inline-flex items-center gap-2 font-syne text-xs font-bold tracking-widest uppercase text-safran border border-safran/30 px-4 py-2 rounded-full">
              <MapPin size={12} />
              Marketplace Officielle · Côte d'Ivoire
            </span>
          </motion.div>

          <div className="overflow-hidden">
            <motion.h1
              {...fadeUp(0.2)}
              className="font-playfair text-6xl md:text-7xl lg:text-8xl font-bold text-cream leading-[0.95] tracking-tight"
            >
              Le riz
            </motion.h1>
          </div>
          <div className="overflow-hidden">
            <motion.h1
              {...fadeUp(0.35)}
              className="font-playfair text-6xl md:text-7xl lg:text-8xl font-bold italic text-safran leading-[0.95] tracking-tight"
            >
              ivoirien,
            </motion.h1>
          </div>
          <div className="overflow-hidden">
            <motion.h1
              {...fadeUp(0.5)}
              className="font-playfair text-6xl md:text-7xl lg:text-8xl font-bold text-cream leading-[0.95] tracking-tight"
            >
              livré.
            </motion.h1>
          </div>

          <motion.p
            {...fadeUp(0.65)}
            className="mt-8 font-dm text-lg text-cream/70 max-w-md leading-relaxed"
          >
            Connectez-vous directement aux producteurs locaux. Riz parfumé de Man, étuvé de Bouaké,
            bio de Korhogo — des saveurs authentiques à votre porte en 24h.
          </motion.p>

          <motion.div {...fadeUp(0.8)} className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 bg-safran text-charcoal font-syne font-bold px-8 py-4 rounded-full hover:bg-safran-light transition-all duration-200 hover:shadow-glow active:scale-95 text-sm"
            >
              Explorer les boutiques
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/register/seller"
              className="inline-flex items-center gap-2 border-2 border-cream/30 text-cream font-syne font-semibold px-8 py-4 rounded-full hover:border-cream/60 hover:bg-cream/5 transition-all duration-200 text-sm"
            >
              Vendre mon riz
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div {...fadeUp(0.95)} className="mt-12 flex items-center gap-6">
            <div className="flex -space-x-2">
              {[
                'https://images.unsplash.com/photo-1531123414780-f74242c2b052?auto=format&fit=crop&w=60&q=80',
                'https://images.unsplash.com/photo-1566843972142-a7fcb70de55a?auto=format&fit=crop&w=60&q=80',
                'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=60&q=80',
              ].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt="client"
                  className="w-9 h-9 rounded-full border-2 border-forest-dark object-cover"
                />
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-safran text-xs">★</span>
                ))}
              </div>
              <p className="font-dm text-xs text-cream/60">
                <span className="text-cream font-medium">12 000+</span> familles satisfaites
              </p>
            </div>
          </motion.div>
        </div>

        {/* Right — image composition */}
        <div className="hidden lg:flex relative justify-center items-center">
          {/* Main blob image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: 40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-[420px] h-[520px]"
          >
            <div className="blob w-full h-full overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80"
                alt="Producteur ivoirien"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Gold ring */}
            <div className="absolute -inset-4 blob-2 border-2 border-safran/20 -z-10" />

            {/* Floating card — livraison */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="absolute -left-16 top-24 bg-cream rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.25)] flex items-center gap-3 min-w-max"
            >
              <span className="w-8 h-8 bg-forest/10 rounded-full flex items-center justify-center text-base">🚚</span>
              <div>
                <p className="font-syne text-xs font-bold text-charcoal">Livraison aujourd'hui</p>
                <p className="font-dm text-[11px] text-forest-muted">Abidjan & environs</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1" />
            </motion.div>

            {/* Floating card — prix */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 1 }}
              className="absolute -right-14 bottom-32 bg-safran rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(232,162,23,0.4)] min-w-max"
            >
              <p className="font-syne text-[11px] font-bold text-charcoal/70 uppercase tracking-wider mb-0.5">Riz Parfumé Man</p>
              <p className="font-playfair text-2xl font-bold text-charcoal">2 500 <span className="text-sm font-dm font-normal">FCFA</span></p>
              <p className="font-dm text-[10px] text-charcoal/60">le sac de 5kg</p>
            </motion.div>

            {/* Floating badge — certifié */}
            <motion.div
              animate={{ rotate: [-2, 2, -2] }}
              transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
              className="absolute -top-6 right-8 bg-forest rounded-2xl px-4 py-2 shadow-card"
            >
              <p className="font-syne text-xs font-bold text-cream">✓ Certifié Local</p>
            </motion.div>
          </motion.div>

          {/* Background decorative image */}
          <div className="absolute -bottom-10 -right-10 w-48 h-48 blob overflow-hidden opacity-60">
            <img
              src="https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80"
              alt="riz"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Bottom scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          className="w-px h-12 bg-gradient-to-b from-cream to-transparent"
        />
        <p className="font-syne text-[10px] text-cream tracking-widest uppercase">Défiler</p>
      </div>
    </section>
  )
}
