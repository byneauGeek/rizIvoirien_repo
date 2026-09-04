import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'

function useCountUp(target, duration = 1800, active = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active || !target) return
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration, active])
  return count
}

function StatItem({ value, suffix, label, icon, active }) {
  const count = useCountUp(value, 1600, active)
  return (
    <div className="flex flex-col items-center text-center px-6 py-4 group">
      <span className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">{icon}</span>
      <p className="font-playfair text-5xl md:text-6xl font-bold text-cream">
        {count.toLocaleString('fr-FR')}{suffix}
      </p>
      <p className="font-syne text-xs font-semibold tracking-wider uppercase text-cream/50 mt-2">{label}</p>
    </div>
  )
}

export default function StatsSection() {
  const ref = useRef(null)
  const [active, setActive] = useState(false)
  const [stats, setStats] = useState({ products: 0, shops: 0, sellers: 0, deliveries: 0 })

  useEffect(() => {
    api.get('/stats').then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setActive(true) },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const items = [
    { value: stats.products, suffix: '+', label: 'Produits disponibles', icon: '🌾' },
    { value: stats.shops, suffix: '+', label: 'Boutiques actives', icon: '🏪' },
    { value: stats.sellers, suffix: '', label: 'Producteurs partenaires', icon: '👨‍🌾' },
    { value: stats.deliveries, suffix: '+', label: 'Livraisons effectuées', icon: '🚚' },
  ]

  return (
    <section ref={ref} className="bg-forest relative overflow-hidden py-16">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-terra via-safran to-gold" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-gold via-safran to-terra" />
      <div className="absolute inset-0 bg-kente opacity-60" />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-cream/10">
          {items.map((stat, i) => <StatItem key={i} {...stat} active={active} />)}
        </div>
      </div>
    </section>
  )
}
