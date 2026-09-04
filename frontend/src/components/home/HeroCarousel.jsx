import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { api } from '../../api/client'

const FALLBACK = [{
  id: 1, title: 'Le riz ivoirien, direct du producteur', subtitle: 'Qualité garantie, livraison rapide',
  badge: 'Nouveauté', cta: 'Découvrir', ctaLink: '/shop',
  bg: '#1B4332', accent: '#E8A217',
  image: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=1200&q=80',
}]

export default function HeroCarousel() {
  const [slides, setSlides] = useState(FALLBACK)
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    api.get('/carousel').then(data => { if (data?.length) setSlides(data) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (slides.length < 2) return
    const timer = setInterval(() => { setDirection(1); setCurrent(i => (i + 1) % slides.length) }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  const go = (idx) => { setDirection(idx > current ? 1 : -1); setCurrent(idx) }
  const slide = slides[current]

  const variants = {
    enter: d => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: d => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  return (
    <section className="relative overflow-hidden h-[500px] md:h-[600px]">
      <AnimatePresence custom={direction} mode="popLayout">
        <motion.div key={slide.id} custom={direction} variants={variants}
          initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0" style={{ backgroundColor: slide.bg }}>
          <div className="absolute inset-0">
            {slide.image && <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />}
            <div className="absolute inset-0" style={{ background: `linear-gradient(105deg, ${slide.bg}F0 35%, ${slide.bg}80 60%, ${slide.bg}20 100%)` }} />
          </div>
          <div className="relative z-10 max-w-7xl mx-auto px-6 h-full flex flex-col justify-center max-w-2xl">
            <motion.span initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="inline-flex w-fit items-center font-syne text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-6 border"
              style={{ color: slide.accent, borderColor: `${slide.accent}40` }}>
              {slide.badge}
            </motion.span>
            <motion.h2 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="font-playfair text-5xl md:text-6xl font-bold text-cream leading-tight mb-4">
              {slide.title}
            </motion.h2>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="font-dm text-lg text-cream/70 mb-8 max-w-md">
              {slide.subtitle}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
              <Link to={slide.ctaLink || '/shop'}
                className="inline-flex items-center gap-2 font-syne font-bold px-8 py-4 rounded-full transition-all duration-200 hover:scale-105 text-sm"
                style={{ backgroundColor: slide.accent, color: slide.bg }}>
                {slide.cta || 'Découvrir'} <ArrowRight size={16} />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, i) => (
            <button key={i} onClick={() => go(i)}
              className={`transition-all duration-300 rounded-full ${i === current ? 'w-8 h-2 bg-safran' : 'w-2 h-2 bg-cream/40 hover:bg-cream/70'}`} />
          ))}
        </div>
      )}
      <div className="absolute top-8 right-8 z-20 font-syne text-xs text-cream/40 font-semibold">
        {String(current + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
      </div>
    </section>
  )
}
