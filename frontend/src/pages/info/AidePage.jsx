import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ChevronDown, ChevronRight, ShoppingBag, Store, Truck, CreditCard, User } from 'lucide-react'

const FAQ = [
  {
    category: 'Achats',
    icon: ShoppingBag,
    items: [
      { q: 'Comment passer une commande ?', a: 'Parcourez les boutiques ou produits, ajoutez au panier, puis procédez au paiement en renseignant votre adresse de livraison.' },
      { q: 'Puis-je annuler une commande ?', a: 'Oui, vous pouvez annuler une commande tant qu\'elle est en statut "En attente" ou "Confirmée". Rendez-vous dans "Mes commandes" et cliquez sur Annuler.' },
      { q: 'Comment suivre ma commande ?', a: 'Suivez l\'avancement en temps réel dans votre espace "Mes commandes". Vous verrez chaque changement de statut (Préparation → Prêt → En route → Livré).' },
      { q: 'Les frais de livraison sont-ils remboursés en cas d\'annulation ?', a: 'Si la commande est annulée avant d\'être prise en charge par un livreur, la totalité des frais est remboursée. Contactez-nous pour tout litige.' },
    ],
  },
  {
    category: 'Vendeurs',
    icon: Store,
    items: [
      { q: 'Comment ouvrir une boutique ?', a: 'Cliquez sur "Ouvrir ma boutique" et remplissez le formulaire d\'inscription. Votre dossier sera examiné par notre équipe sous 48h ouvrées.' },
      { q: 'Qu\'est-ce que la certification boutique ?', a: 'Le plan Certifié donne à votre boutique un badge de confiance visible et une meilleure visibilité dans les résultats de recherche. Il est disponible pour 150 000 FCFA par an.' },
      { q: 'Comment gérer mon stock ?', a: 'Dans votre espace vendeur, onglet "Mes produits", vous pouvez mettre à jour le stock, activer/désactiver des produits et ajouter de nouveaux articles.' },
    ],
  },
  {
    category: 'Livreurs',
    icon: Truck,
    items: [
      { q: 'Comment devenir livreur ?', a: 'Il vous faut un code d\'invitation fourni par l\'équipe RizIvoirien. Ensuite, suivez le formulaire d\'inscription en 4 étapes (code → identité → permis/véhicule → connexion). Votre dossier est validé sous 48h.' },
      { q: 'Comment accepter une course ?', a: 'Dans votre espace livreur, onglet "Offres", vous verrez les commandes disponibles. Acceptez ou refusez chaque offre. Soyez en ligne pour en recevoir.' },
      { q: 'Comment sont calculés mes gains ?', a: 'Vous recevez 15% des frais de livraison de chaque commande livrée. Consultez l\'onglet "Gains" pour le détail.' },
    ],
  },
  {
    category: 'Mon compte',
    icon: User,
    items: [
      { q: 'Comment modifier mon mot de passe ?', a: 'Rendez-vous dans votre profil (espace acheteur → "Mon compte" ou espace livreur → "Mon profil"), section Sécurité.' },
      { q: 'Mon compte est suspendu, que faire ?', a: 'Contactez notre équipe support à l\'adresse support@rizivoirien.ci en précisant votre email d\'inscription.' },
    ],
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 py-4 text-left">
        <span className="font-dm text-sm font-semibold text-[#0F1923]">{q}</span>
        {open ? <ChevronDown size={14} className="text-[#52B788] shrink-0" /> : <ChevronRight size={14} className="text-gray-300 shrink-0" />}
      </button>
      {open && <p className="font-dm text-sm text-[#0F1923]/60 pb-4 leading-relaxed">{a}</p>}
    </div>
  )
}

export default function AidePage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <div className="bg-[#0F1923] text-white py-20 px-6 text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-8 opacity-60 hover:opacity-100 transition-opacity">
          <span className="text-xl">🌾</span>
          <span className="font-playfair text-lg font-bold">Riz<span className="text-[#E8A217]">Ivoirien</span></span>
        </Link>
        <h1 className="font-playfair text-4xl md:text-5xl font-bold mb-4">Centre d'aide</h1>
        <p className="font-dm text-lg text-white/60 max-w-xl mx-auto">Trouvez rapidement les réponses à vos questions.</p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        {FAQ.map(({ category, icon: Icon, items }) => (
          <div key={category} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
              <div className="w-9 h-9 rounded-xl bg-[#1B4332]/10 flex items-center justify-center">
                <Icon size={15} className="text-[#1B4332]" />
              </div>
              <h2 className="font-syne font-bold text-[#0F1923]">{category}</h2>
            </div>
            <div className="px-6">
              {items.map(item => <FaqItem key={item.q} {...item} />)}
            </div>
          </div>
        ))}

        <div className="bg-[#1B4332] rounded-3xl p-8 text-center text-white">
          <p className="font-playfair text-2xl font-bold mb-2">Vous n'avez pas trouvé votre réponse ?</p>
          <p className="font-dm text-white/60 mb-6">Notre équipe est disponible du lundi au vendredi, 8h–18h.</p>
          <Link to="/contact"
            className="inline-flex items-center gap-2 bg-[#E8A217] text-white font-syne font-bold px-6 py-3 rounded-xl hover:bg-[#d4920f] transition-colors">
            Nous contacter directement
          </Link>
        </div>
      </div>
    </div>
  )
}
