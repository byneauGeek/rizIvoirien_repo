import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Link } from 'react-router-dom'

const STEPS = [
  {
    number: '01',
    icon: '🔍',
    title: 'Choisissez votre riz',
    description: 'Parcourez nos boutiques certifiées, filtrez par région, variété et budget. Chaque produit est tracé de la rizière à votre panier.',
    color: 'bg-forest text-cream',
  },
  {
    number: '02',
    icon: '📦',
    title: 'Le vendeur prépare',
    description: 'Votre commande est transmise directement au producteur. Il prépare votre commande avec soin et la remet à notre livreur.',
    color: 'bg-safran text-charcoal',
  },
  {
    number: '03',
    icon: '🚚',
    title: 'Livraison en temps réel',
    description: 'Suivez votre commande étape par étape. Notre livreur vous contacte à l\'arrivée. Livraison en 24h à Abidjan.',
    color: 'bg-terra text-cream',
  },
]

export default function HowItWorks() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-forest relative overflow-hidden" ref={ref}>
      {/* Decorative */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-terra via-safran to-gold" />
      <div className="absolute inset-0 bg-kente opacity-50" />

      {/* Big watermark */}
      <div
        className="absolute -right-20 top-1/2 -translate-y-1/2 font-playfair text-[200px] font-bold text-cream/5 leading-none select-none pointer-events-none"
        style={{ writingMode: 'vertical-rl' }}
      >
        RIZ
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="mb-16">
          <p className="section-label text-cream/40 mb-3">Comment ça marche</p>
          <h2 className="font-playfair text-5xl font-bold text-cream leading-tight">
            Simple comme<br />
            <span className="italic text-safran">bonjour.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-10 left-full w-10 h-px bg-cream/20 -translate-y-1/2 z-10" />
              )}

              <div className="bg-cream/5 border border-cream/10 rounded-3xl p-8 hover:bg-cream/8 transition-colors duration-300">
                <div className="flex items-start justify-between mb-6">
                  <span className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${step.color}`}>
                    {step.icon}
                  </span>
                  <span className="font-playfair text-5xl font-bold text-cream/10 leading-none">
                    {step.number}
                  </span>
                </div>

                <h3 className="font-playfair text-2xl font-bold text-cream mb-3">
                  {step.title}
                </h3>
                <p className="font-dm text-sm text-cream/60 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-16 text-center"
        >
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-safran text-charcoal font-syne font-bold px-10 py-5 rounded-full hover:bg-safran-light transition-all duration-200 hover:shadow-glow text-base"
          >
            Commencer mes achats
          </Link>
          <p className="font-dm text-sm text-cream/40 mt-4">
            Livraison offerte dès 10 000 FCFA d'achat
          </p>
        </motion.div>
      </div>
    </section>
  )
}
