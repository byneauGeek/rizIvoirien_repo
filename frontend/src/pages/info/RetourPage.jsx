import { Link } from 'react-router-dom'
import { RotateCcw, Clock, AlertCircle, CheckCircle } from 'lucide-react'

export default function RetourPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <div className="bg-[#1B4332] text-white py-20 px-6 text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-8 opacity-60 hover:opacity-100 transition-opacity">
          <span className="text-xl">🌾</span>
          <span className="font-playfair text-lg font-bold">Riz<span className="text-[#E8A217]">Ivoirien</span></span>
        </Link>
        <h1 className="font-playfair text-4xl md:text-5xl font-bold mb-4">Retours & Remboursements</h1>
        <p className="font-dm text-lg text-white/60 max-w-xl mx-auto">Votre satisfaction est notre priorité.</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        {[
          {
            icon: Clock,
            title: 'Délai de réclamation',
            content: 'Toute réclamation doit être effectuée dans les 24 heures suivant la réception de votre commande. Passé ce délai, aucun remboursement ne pourra être accordé.',
          },
          {
            icon: AlertCircle,
            title: 'Motifs acceptés',
            content: 'Nous acceptons les réclamations pour : produit non conforme à la description, quantité incorrecte, produit endommagé lors de la livraison, commande non reçue.',
          },
          {
            icon: CheckCircle,
            title: 'Procédure',
            content: 'Contactez notre support via le formulaire de contact en indiquant votre numéro de commande et une description du problème (photos si possible). Notre équipe traitera votre demande sous 48h ouvrées.',
          },
          {
            icon: RotateCcw,
            title: 'Remboursements',
            content: 'En cas de remboursement accordé, le montant sera crédité sur votre moyen de paiement d\'origine dans un délai de 5 à 10 jours ouvrés selon votre opérateur mobile money ou banque.',
          },
        ].map(({ icon: Icon, title, content }) => (
          <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#1B4332]/10 flex items-center justify-center shrink-0">
              <Icon size={16} className="text-[#1B4332]" />
            </div>
            <div>
              <h2 className="font-syne font-bold text-[#0F1923] mb-2">{title}</h2>
              <p className="font-dm text-sm text-[#0F1923]/60 leading-relaxed">{content}</p>
            </div>
          </div>
        ))}

        <div className="text-center pt-4">
          <Link to="/contact" className="inline-flex items-center gap-2 bg-[#1B4332] text-white font-syne font-bold px-6 py-3 rounded-xl hover:bg-[#246043] transition-colors">
            Déposer une réclamation
          </Link>
        </div>
      </div>
    </div>
  )
}
