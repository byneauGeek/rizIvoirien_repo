import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Zap, X } from 'lucide-react'

function useCountdown(target) {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.floor((target - Date.now()) / 1000)))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [target])
  return remaining
}

export default function FlashSaleBanner({ discount = 15, code = 'FLASH15', hours = 4 }) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('flash_dismissed') === 'true')
  const target = useState(() => Date.now() + hours * 3600 * 1000)[0]
  const remaining = useCountdown(target)

  if (dismissed || remaining === 0) return null

  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60
  const pad = n => String(n).padStart(2, '0')

  const dismiss = () => { sessionStorage.setItem('flash_dismissed', 'true'); setDismissed(true) }

  return (
    <div className="bg-gradient-to-r from-terra via-safran to-gold text-charcoal">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Zap size={16} className="shrink-0" />
          <p className="font-syne text-sm font-bold whitespace-nowrap">
            ⚡ Vente flash — {discount}% de réduction avec le code{' '}
            <span className="bg-charcoal/15 px-2 py-0.5 rounded-lg tracking-wider">{code}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 font-playfair font-bold text-lg">
            <span className="bg-charcoal/15 px-2 py-0.5 rounded-lg">{pad(h)}</span>
            <span>:</span>
            <span className="bg-charcoal/15 px-2 py-0.5 rounded-lg">{pad(m)}</span>
            <span>:</span>
            <span className="bg-charcoal/15 px-2 py-0.5 rounded-lg">{pad(s)}</span>
          </div>
          <Link to="/shop" className="hidden sm:block bg-charcoal text-cream font-syne text-xs font-bold px-4 py-2 rounded-full hover:bg-charcoal/80 transition-colors whitespace-nowrap">
            En profiter →
          </Link>
          <button onClick={dismiss} className="p-1 rounded-full hover:bg-charcoal/10 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
