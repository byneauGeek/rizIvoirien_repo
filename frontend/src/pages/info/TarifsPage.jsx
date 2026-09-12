import { Link } from 'react-router-dom'
import { Check, Star, Zap, Shield } from 'lucide-react'

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 'Gratuit',
    sub: 'Pour démarrer',
    icon: Zap,
    color: 'border-gray-200',
    headerBg: 'bg-gray-50',
    cta: { label: 'Ouvrir ma boutique', to: '/register/seller', style: 'border-2 border-[#1B4332] text-[#1B4332] hover:bg-[#1B4332] hover:text-white' },
    features: [
      'Boutique en ligne personnalisée',
      'Jusqu\'à 50 produits actifs',
      'Gestion des commandes',
      'Tableau de bord basique',
      'Support par email',
    ],
    missing: ['Badge certifié', 'Mise en avant marketplace', 'Statistiques avancées'],
  },
  {
    id: 'certified',
    name: 'Certifié',
    price: '150 000 FCFA',
    sub: 'par an',
    icon: Star,
    color: 'border-[#E8A217] ring-2 ring-[#E8A217]/30',
    headerBg: 'bg-[#E8A217]/10',
    badge: 'Recommandé',
    cta: { label: 'Passer au plan Certifié', to: '/vendor', style: 'bg-[#E8A217] text-white hover:bg-[#d4920f]' },
    features: [
      'Tout le plan Basic',
      'Badge ✓ Certifié visible',
      'Priorité dans les résultats',
      'Statistiques complètes',
      'Produits illimités',
      'Zones de livraison configurables',
    ],
    missing: [],
  },
]

const COMMISSIONS = [
  { label: 'Commission sur vente', value: '5%', note: 'Prélevée sur chaque commande livrée' },
  { label: 'Frais de livraison livreur', value: '15%', note: 'Part du livreur sur les frais de livraison' },
  { label: 'Part plateforme livraison', value: '85%', note: 'Reste des frais de livraison pour la plateforme' },
]

export default function TarifsPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <div className="bg-[#1B4332] text-white py-20 px-6 text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-8 opacity-60 hover:opacity-100 transition-opacity">
          <span className="text-xl">🌾</span>
          <span className="font-playfair text-lg font-bold">Riz<span className="text-[#E8A217]">Ivoirien</span></span>
        </Link>
        <h1 className="font-playfair text-4xl md:text-5xl font-bold mb-4">Plans & Tarifs</h1>
        <p className="font-dm text-lg text-white/60 max-w-xl mx-auto">
          Simple, transparent, sans surprise.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16 space-y-16">
        {/* Plans */}
        <div>
          <h2 className="font-playfair text-3xl font-bold text-[#0F1923] text-center mb-10">Choisissez votre plan boutique</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PLANS.map(plan => {
              const Icon = plan.icon
              return (
                <div key={plan.id} className={`bg-white rounded-3xl border-2 ${plan.color} shadow-sm overflow-hidden`}>
                  <div className={`${plan.headerBg} px-6 py-6 relative`}>
                    {plan.badge && (
                      <span className="absolute top-4 right-4 font-syne text-[10px] font-bold text-[#E8A217] bg-[#E8A217]/15 px-2.5 py-1 rounded-full">
                        {plan.badge}
                      </span>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1B4332]/10 flex items-center justify-center">
                        <Icon size={18} className="text-[#1B4332]" />
                      </div>
                      <div>
                        <p className="font-playfair text-xl font-bold text-[#0F1923]">{plan.name}</p>
                        <p className="font-dm text-xs text-[#0F1923]/45">{plan.sub}</p>
                      </div>
                    </div>
                    <p className="font-playfair text-3xl font-bold text-[#0F1923]">{plan.price}</p>
                  </div>
                  <div className="px-6 py-6 space-y-4">
                    <ul className="space-y-2.5">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5">
                          <Check size={15} className="text-[#52B788] mt-0.5 shrink-0" />
                          <span className="font-dm text-sm text-[#0F1923]">{f}</span>
                        </li>
                      ))}
                      {plan.missing.map(f => (
                        <li key={f} className="flex items-start gap-2.5 opacity-35">
                          <div className="w-3.5 h-3.5 mt-0.5 shrink-0 border border-gray-300 rounded-full" />
                          <span className="font-dm text-sm text-[#0F1923] line-through">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to={plan.cta.to}
                      className={`mt-4 block text-center font-syne font-bold text-sm py-3 rounded-xl transition-colors ${plan.cta.style}`}>
                      {plan.cta.label}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Commissions */}
        <div>
          <h2 className="font-playfair text-3xl font-bold text-[#0F1923] text-center mb-8">Commissions</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {COMMISSIONS.map(c => (
              <div key={c.label} className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
                <p className="font-playfair text-4xl font-bold text-[#1B4332] mb-1">{c.value}</p>
                <p className="font-syne text-sm font-bold text-[#0F1923] mb-2">{c.label}</p>
                <p className="font-dm text-xs text-[#0F1923]/45 leading-relaxed">{c.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link to="/contact" className="inline-flex items-center gap-2 font-syne text-sm font-bold text-[#52B788] hover:underline">
            Des questions sur nos tarifs ? Contactez-nous →
          </Link>
        </div>
      </div>
    </div>
  )
}
