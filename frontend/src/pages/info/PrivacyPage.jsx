import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    title: '1. Responsable du traitement',
    content: `RizIvoirien est responsable du traitement des données personnelles collectées via la plateforme rizivoirien.ci. Pour toute question relative à vos données, vous pouvez nous contacter à l'adresse : contact@rizivoirien.ci`,
  },
  {
    title: '2. Données collectées',
    content: `Lors de votre inscription et utilisation de la plateforme, nous collectons les données suivantes :
• Identité : nom, prénom, adresse e-mail, numéro de téléphone
• Données de localisation : adresse de livraison, coordonnées GPS (uniquement lors d'une livraison active, pour les livreurs)
• Historique d'utilisation : commandes passées, produits consultés, avis déposés
• Données de connexion : adresse IP, navigateur, horodatage des connexions
• Pour les vendeurs : nom de la boutique, localisation, documents d'identité commerciale
• Pour les livreurs : CNI, permis de conduire, photo du véhicule, position GPS en service`,
  },
  {
    title: '3. Finalités du traitement',
    content: `Vos données sont utilisées exclusivement pour :
• Créer et gérer votre compte utilisateur
• Traiter et suivre vos commandes
• Calculer et afficher les frais de livraison en temps réel
• Vous envoyer des notifications relatives à vos commandes (confirmations, mises à jour de statut)
• Améliorer les services de la plateforme (statistiques anonymisées)
• Assurer la sécurité et prévenir la fraude
• Respecter nos obligations légales`,
  },
  {
    title: '4. Base légale du traitement',
    content: `Le traitement de vos données repose sur :
• L'exécution du contrat : données nécessaires à la fourniture du service (commandes, livraisons)
• Votre consentement : pour les communications marketing optionnelles
• L'intérêt légitime : amélioration de la plateforme, prévention de la fraude
• L'obligation légale : conservation des données de transaction conformément à la législation ivoirienne`,
  },
  {
    title: '5. Durée de conservation',
    content: `Nous conservons vos données selon les durées suivantes :
• Données de compte actif : pendant toute la durée de votre inscription
• Historique des commandes : 5 ans après la dernière transaction (obligation légale comptable)
• Données de connexion (logs) : 12 mois glissants
• Données de localisation GPS : supprimées immédiatement après la fin de chaque livraison
• Après suppression du compte : anonymisation dans les 30 jours`,
  },
  {
    title: '6. Partage des données',
    content: `Vos données personnelles ne sont pas vendues à des tiers. Elles peuvent être partagées avec :
• Les boutiques partenaires : uniquement les informations nécessaires à l'exécution de votre commande (prénom, téléphone, adresse)
• Les livreurs : uniquement l'adresse de livraison et votre prénom, pour la durée de la livraison
• Nos prestataires techniques : hébergement, envoi d'emails transactionnels, sous contrat de confidentialité
• Les autorités compétentes : uniquement sur réquisition judiciaire`,
  },
  {
    title: '7. Vos droits',
    content: `Conformément à la législation applicable, vous disposez des droits suivants sur vos données :
• Droit d'accès : obtenir une copie de toutes les données vous concernant
• Droit de rectification : corriger des données inexactes ou incomplètes
• Droit à l'effacement ("droit à l'oubli") : demander la suppression de votre compte et de vos données
• Droit à la portabilité : recevoir vos données dans un format structuré
• Droit d'opposition : vous opposer à certains traitements (marketing)
• Droit à la limitation : restreindre le traitement dans certains cas

Pour exercer ces droits, contactez-nous à : contact@rizivoirien.ci avec l'objet "Demande RGPD".
Nous répondrons dans un délai de 30 jours.`,
  },
  {
    title: '8. Cookies et traceurs',
    content: `RizIvoirien utilise des cookies techniques indispensables au fonctionnement de la plateforme (maintien de session, panier). Aucun cookie publicitaire ou de tracking tiers n'est utilisé sans votre consentement.

Types de cookies :
• Cookies de session : authentification, panier (durée : session navigateur)
• Cookies de préférence : langue, dernière visite (durée : 12 mois)
• Vous pouvez désactiver les cookies dans les paramètres de votre navigateur, au risque de dégrader certaines fonctionnalités.`,
  },
  {
    title: '9. Sécurité des données',
    content: `RizIvoirien met en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données :
• Chiffrement HTTPS (TLS) de toutes les communications
• Mots de passe hachés avec bcrypt (jamais stockés en clair)
• Accès aux données restreint au personnel habilité
• Journalisation des accès aux données sensibles
En cas de violation de données susceptible d'affecter vos droits, vous en serez informé dans les 72 heures.`,
  },
  {
    title: '10. Transferts internationaux',
    content: `Vos données sont hébergées et traitées principalement en Afrique de l'Ouest. Certains prestataires techniques (hébergement, emails) peuvent opérer depuis l'Europe. Dans ce cas, des garanties contractuelles appropriées (clauses contractuelles types) sont en place pour assurer un niveau de protection équivalent.`,
  },
  {
    title: '11. Modifications de cette politique',
    content: `Nous pouvons mettre à jour cette politique de confidentialité pour refléter des changements dans nos pratiques ou dans la législation applicable. La date de dernière mise à jour est indiquée en haut de page. En cas de modification substantielle, vous serez notifié par email ou via la plateforme.`,
  },
  {
    title: '12. Contact et réclamations',
    content: `Pour toute question ou réclamation relative à la protection de vos données :
• Email : contact@rizivoirien.ci (objet : "Protection des données")
• Délai de réponse : 30 jours maximum

Si vous estimez que vos droits ne sont pas respectés, vous avez le droit de saisir l'autorité de contrôle compétente en Côte d'Ivoire (ARTCI — Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire).`,
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <div className="bg-[#0F1923] text-white py-20 px-6 text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-8 opacity-60 hover:opacity-100 transition-opacity">
          <span className="text-xl">🌾</span>
          <span className="font-playfair text-lg font-bold">Riz<span className="text-[#E8A217]">Ivoirien</span></span>
        </Link>
        <h1 className="font-playfair text-4xl md:text-5xl font-bold mb-4">Politique de Confidentialité</h1>
        <p className="font-dm text-white/50">Dernière mise à jour : mai 2025</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <p className="font-dm text-sm text-amber-800 leading-relaxed">
            <strong className="font-syne">Résumé :</strong> Nous collectons uniquement les données nécessaires à la fourniture de nos services.
            Vos données ne sont jamais vendues. Vous pouvez demander leur suppression à tout moment en nous écrivant à <strong>contact@rizivoirien.ci</strong>.
          </p>
        </div>

        {SECTIONS.map(s => (
          <section key={s.title}>
            <h2 className="font-playfair text-xl font-bold text-[#0F1923] mb-3">{s.title}</h2>
            <p className="font-dm text-[#0F1923]/65 leading-relaxed whitespace-pre-line">{s.content}</p>
          </section>
        ))}

        <div className="border-t border-[#0F1923]/10 pt-8">
          <p className="font-dm text-sm text-[#0F1923]/40 text-center">
            RizIvoirien — Marketplace de riz en Côte d'Ivoire · contact@rizivoirien.ci
          </p>
        </div>
      </div>
    </div>
  )
}
