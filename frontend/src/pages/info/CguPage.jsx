import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    title: '1. Objet',
    content: `Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme RizIvoirien, marketplace en ligne dédiée à la vente et à la livraison de riz et produits dérivés en Côte d'Ivoire.`,
  },
  {
    title: '2. Accès à la plateforme',
    content: `L'accès à RizIvoirien est ouvert à toute personne physique ou morale disposant d'une connexion Internet. L'utilisation des fonctionnalités de commande est réservée aux utilisateurs disposant d'un compte validé. La création d'un compte requiert des informations exactes et à jour.`,
  },
  {
    title: '3. Comptes vendeurs',
    content: `Les vendeurs (boutiques) doivent soumettre une demande d'ouverture de boutique. Toute boutique est soumise à une validation par l'équipe RizIvoirien avant d'être visible sur la marketplace. RizIvoirien se réserve le droit de refuser, suspendre ou désactiver toute boutique ne respectant pas les présentes CGU.`,
  },
  {
    title: '4. Comptes livreurs',
    content: `Les livreurs doivent fournir des documents valides (CNI, permis de conduire, photo du véhicule). Leur dossier est vérifié par l'administration. Un code d'invitation valide est requis pour s'inscrire. RizIvoirien se réserve le droit de suspendre tout compte livreur en cas de manquement.`,
  },
  {
    title: '5. Commandes et paiements',
    content: `Les prix affichés sont en Francs CFA (FCFA). Les frais de livraison sont calculés dynamiquement selon le poids des articles et la distance entre la boutique et le point de livraison. RizIvoirien agit en tant qu'intermédiaire et n'est pas responsable des stocks ou de la qualité des produits vendus par les boutiques.`,
  },
  {
    title: '6. Données personnelles',
    content: `RizIvoirien collecte et traite les données personnelles de ses utilisateurs conformément à la législation ivoirienne en vigueur. Les données collectées sont utilisées exclusivement dans le cadre de la fourniture des services de la plateforme. Elles ne sont pas cédées à des tiers sans consentement.`,
  },
  {
    title: '7. Responsabilité',
    content: `RizIvoirien s'efforce d'assurer la disponibilité de la plateforme 24h/24 et 7j/7 mais ne saurait être tenu responsable des interruptions de service dues à des maintenance, pannes ou cas de force majeure. La plateforme ne peut être tenue responsable des litiges entre acheteurs et vendeurs.`,
  },
  {
    title: '8. Modifications des CGU',
    content: `RizIvoirien se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle. La poursuite de l'utilisation de la plateforme après notification vaut acceptation des nouvelles CGU.`,
  },
  {
    title: '9. Droit applicable',
    content: `Les présentes CGU sont soumises au droit ivoirien. Tout litige relatif à leur interprétation ou à leur exécution relève de la compétence exclusive des tribunaux d'Abidjan, Côte d'Ivoire.`,
  },
]

export default function CguPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <div className="bg-[#0F1923] text-white py-20 px-6 text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-8 opacity-60 hover:opacity-100 transition-opacity">
          <span className="text-xl">🌾</span>
          <span className="font-playfair text-lg font-bold">Riz<span className="text-[#E8A217]">Ivoirien</span></span>
        </Link>
        <h1 className="font-playfair text-4xl md:text-5xl font-bold mb-4">Conditions Générales d'Utilisation</h1>
        <p className="font-dm text-white/50">Dernière mise à jour : janvier 2025</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        {SECTIONS.map(s => (
          <section key={s.title}>
            <h2 className="font-playfair text-xl font-bold text-[#0F1923] mb-3">{s.title}</h2>
            <p className="font-dm text-[#0F1923]/65 leading-relaxed">{s.content}</p>
          </section>
        ))}

        <div className="border-t border-gray-200 pt-8 text-center">
          <p className="font-dm text-sm text-[#0F1923]/40 mb-4">Des questions sur nos CGU ?</p>
          <Link to="/contact" className="inline-flex items-center gap-2 bg-[#1B4332] text-white font-syne font-bold px-6 py-3 rounded-xl hover:bg-[#246043] transition-colors text-sm">
            Nous contacter
          </Link>
        </div>
      </div>
    </div>
  )
}
