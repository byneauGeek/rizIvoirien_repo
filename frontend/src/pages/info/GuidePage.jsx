import { Link } from 'react-router-dom'
import { Store, Package, ClipboardList, TrendingUp, Shield, Award } from 'lucide-react'

const STEPS = [
  { n: '01', icon: Store, title: 'Créer votre boutique', desc: 'Remplissez le formulaire d\'inscription avec vos informations (RCCM, téléphone, description, spécialité). Votre dossier est validé sous 48h par notre équipe.' },
  { n: '02', icon: Package, title: 'Ajouter vos produits', desc: 'Dans l\'espace vendeur, onglet "Mes produits", ajoutez vos sacs de riz avec photos, poids, prix et stock. Des descriptions détaillées favorisent les ventes.' },
  { n: '03', icon: ClipboardList, title: 'Gérer les commandes', desc: 'Recevez les commandes en temps réel. Préparez-les et marquez-les comme "Prêtes" pour qu\'un livreur soit assigné automatiquement.' },
  { n: '04', icon: TrendingUp, title: 'Suivre vos performances', desc: 'Consultez votre tableau de bord pour suivre votre chiffre d\'affaires, vos produits les plus vendus et la satisfaction de vos clients.' },
  { n: '05', icon: Shield, title: 'Paramétrer votre boutique', desc: 'Définissez vos horaires d\'ouverture, zones de livraison, commande minimum, et mettez votre boutique en pause si besoin — tout se gère depuis l\'espace vendeur.' },
  { n: '06', icon: Award, title: 'Passer au plan Certifié', desc: 'Le badge Certifié ✓ renforce la confiance des acheteurs et améliore votre visibilité dans les résultats. Abonnement annuel à 150 000 FCFA.' },
]

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <div className="bg-[#1B4332] text-white py-20 px-6 text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-8 opacity-60 hover:opacity-100 transition-opacity">
          <span className="text-xl">🌾</span>
          <span className="font-playfair text-lg font-bold">Riz<span className="text-[#E8A217]">Ivoirien</span></span>
        </Link>
        <h1 className="font-playfair text-4xl md:text-5xl font-bold mb-4">Guide Vendeur</h1>
        <p className="font-dm text-lg text-white/60 max-w-xl mx-auto">
          Tout ce qu'il faut savoir pour réussir sur RizIvoirien.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="space-y-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={step.n} className="flex items-start gap-6 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-[#1B4332] flex items-center justify-center">
                    <Icon size={20} className="text-white" />
                  </div>
                  <span className="font-syne text-[10px] font-bold text-[#1B4332]/40">{step.n}</span>
                </div>
                <div>
                  <h2 className="font-syne font-bold text-[#0F1923] text-lg mb-2">{step.title}</h2>
                  <p className="font-dm text-sm text-[#0F1923]/60 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <Link to="/register/seller"
            className="inline-flex items-center gap-2 bg-[#E8A217] text-white font-syne font-bold px-8 py-4 rounded-2xl hover:bg-[#d4920f] transition-colors text-base">
            🌾 Ouvrir ma boutique maintenant
          </Link>
        </div>
      </div>
    </div>
  )
}
