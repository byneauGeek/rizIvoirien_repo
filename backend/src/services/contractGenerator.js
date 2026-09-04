// contractGenerator.js
// Ce HTML est stocké en base et réaffiché tel quel (frontend + éventuel export
// PDF) — les champs saisis par l'utilisateur (nom, boutique, immatriculation...)
// doivent être échappés avant interpolation pour éviter toute injection HTML.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))

function generateShopContract(shop, settings, owner) {
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const commissionPct = Math.round(settings.commissionRate * 100)
  const plan = shop.plan || 'BASIC'
  const planPrice = plan === 'CERTIFIED' ? settings.certifiedPlanPrice : settings.basicPlanPrice

  return `
<div style="font-family: 'Georgia', serif; max-width: 700px; margin: 0 auto; color: #1a1a1a; line-height: 1.7;">
  <div style="text-align:center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #1B4332;">
    <div style="font-size: 28px; font-weight: bold; color: #1B4332;">🌾 RizIvoirien</div>
    <div style="font-size: 13px; color: #666; margin-top: 4px;">Marketplace alimentaire — Côte d'Ivoire</div>
    <h1 style="font-size: 20px; font-weight: bold; margin-top: 20px; color: #1a1a1a; letter-spacing: 1px; text-transform: uppercase;">
      Contrat de partenariat vendeur
    </h1>
    <div style="font-size: 13px; color: #888;">Référence : SHOP-${shop.id}-${Date.now().toString().slice(-6)}</div>
    <div style="font-size: 13px; color: #888;">Établi le ${date} à Abidjan, Côte d'Ivoire</div>
  </div>

  <h2 style="font-size: 15px; font-weight: bold; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 1 — Parties</h2>
  <p style="font-size: 14px;"><strong>D'une part :</strong> La plateforme <strong>RizIvoirien</strong>, marketplace de vente de riz et produits alimentaires en Côte d'Ivoire, ci-après dénommée « la Plateforme ».</p>
  <p style="font-size: 14px;"><strong>D'autre part :</strong> <strong>${esc(owner?.name)}</strong> (${esc(owner?.email)}), propriétaire de la boutique <strong>${esc(shop.name)}</strong>${shop.businessName ? ` — ${esc(shop.businessName)}` : ''}${shop.rccm ? ` (RCCM : ${esc(shop.rccm)})` : ''}, ci-après dénommé(e) « le Vendeur ».</p>

  <h2 style="font-size: 15px; font-weight: bold; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 2 — Objet du contrat</h2>
  <p style="font-size: 14px;">Le présent contrat définit les conditions dans lesquelles le Vendeur est autorisé à vendre ses produits via la marketplace RizIvoirien, et les obligations réciproques des deux parties.</p>

  <h2 style="font-size: 15px; font-weight: bold; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 3 — Plan d'abonnement</h2>
  <p style="font-size: 14px;">Le Vendeur souscrit au plan <strong>${plan}</strong>${planPrice > 0 ? ` au tarif de <strong>${planPrice.toLocaleString('fr-FR')} FCFA / an</strong>` : ' (gratuit)'}.</p>
  ${plan === 'CERTIFIED' ? `<p style="font-size: 14px;">Le Vendeur bénéficie du badge <strong>Boutique Certifiée</strong> et d'une mise en avant prioritaire sur la marketplace.</p>` : ''}

  <h2 style="font-size: 15px; font-weight: bold; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 4 — Commission et paiements</h2>
  <p style="font-size: 14px;">Pour chaque vente réalisée via la plateforme, RizIvoirien prélève une commission de <strong>${commissionPct}%</strong> du montant hors frais de livraison. Ce taux est fixé à la date de signature et peut évoluer avec un préavis de 30 jours.</p>
  <p style="font-size: 14px;">Le solde net dû au Vendeur est reversé selon la politique de paiement en vigueur sur la plateforme.</p>

  <h2 style="font-size: 15px; font-weight: bold; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 5 — Obligations du Vendeur</h2>
  <ul style="font-size: 14px; padding-left: 20px;">
    <li>Fournir des informations exactes sur ses produits (description, prix, disponibilité).</li>
    <li>Maintenir un stock à jour et traiter les commandes dans les délais définis.</li>
    <li>Respecter la législation ivoirienne en matière de commerce alimentaire.</li>
    <li>Ne pas vendre de produits prohibés, contrefaits ou de qualité insuffisante.</li>
    <li>Informer la plateforme de tout changement d'activité ou de situation juridique.</li>
  </ul>

  <h2 style="font-size: 15px; font-weight: bold; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 6 — Obligations de la Plateforme</h2>
  <ul style="font-size: 14px; padding-left: 20px;">
    <li>Mettre à disposition les outils de gestion de boutique et de traitement des commandes.</li>
    <li>Assurer la visibilité des produits du Vendeur sur la marketplace.</li>
    <li>Coordonner la livraison via le réseau de livreurs partenaires.</li>
    <li>Reverser les montants dus dans les délais convenus.</li>
    <li>Informer le Vendeur de toute modification tarifaire avec un préavis de 30 jours.</li>
  </ul>

  <h2 style="font-size: 15px; font-weight: bold; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 7 — Durée et résiliation</h2>
  <p style="font-size: 14px;">Le présent contrat est conclu pour une durée indéterminée à compter de sa signature. Chacune des parties peut y mettre fin avec un préavis de <strong>15 jours</strong>. RizIvoirien se réserve le droit de suspendre immédiatement l'accès en cas de manquement grave aux présentes conditions.</p>

  <h2 style="font-size: 15px; font-weight: bold; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 8 — Responsabilité</h2>
  <p style="font-size: 14px;">RizIvoirien ne saurait être tenu responsable de la qualité intrinsèque des produits vendus par le Vendeur. Le Vendeur est seul responsable de la conformité de ses produits aux normes en vigueur.</p>

  <h2 style="font-size: 15px; font-weight: bold; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 9 — Juridiction</h2>
  <p style="font-size: 14px;">Tout litige relatif au présent contrat sera soumis aux tribunaux compétents d'Abidjan, Côte d'Ivoire.</p>

  <div style="margin-top: 48px; padding-top: 20px; border-top: 2px solid #e0e0e0;">
    <p style="font-size: 13px; color: #666; margin-bottom: 24px;">En signant ce contrat, le Vendeur atteste avoir lu, compris et accepté l'intégralité des conditions ci-dessus.</p>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
      <div>
        <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 40px;">Pour RizIvoirien</div>
        <div style="border-bottom: 1px solid #333; width: 180px; margin-bottom: 6px;"></div>
        <div style="font-size: 12px; color: #888;">Direction des opérations</div>
      </div>
      <div>
        <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 40px;">Le Vendeur</div>
        <div style="border-bottom: 1px solid #333; width: 180px; margin-bottom: 6px;"></div>
        <div style="font-size: 12px; color: #888;">${esc(owner?.name)} — ${date}</div>
      </div>
    </div>
  </div>
</div>
`
}

function generateDriverContract(driver, settings, user) {
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const driverPct = Math.round(settings.driverCommission * 100)
  const subPrice = settings.driverSubPrice

  return `
<div style="font-family: 'Georgia', serif; max-width: 700px; margin: 0 auto; color: #1a1a1a; line-height: 1.7;">
  <div style="text-align:center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #0F1923;">
    <div style="font-size: 28px; font-weight: bold; color: #0F1923;">🌾 RizIvoirien</div>
    <div style="font-size: 13px; color: #666; margin-top: 4px;">Marketplace alimentaire — Côte d'Ivoire</div>
    <h1 style="font-size: 20px; font-weight: bold; margin-top: 20px; color: #1a1a1a; letter-spacing: 1px; text-transform: uppercase;">
      Contrat de partenariat livreur
    </h1>
    <div style="font-size: 13px; color: #888;">Référence : DRV-${driver.id}-${Date.now().toString().slice(-6)}</div>
    <div style="font-size: 13px; color: #888;">Établi le ${date} à Abidjan, Côte d'Ivoire</div>
  </div>

  <h2 style="font-size: 15px; font-weight: bold; color: #0F1923; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 1 — Parties</h2>
  <p style="font-size: 14px;"><strong>D'une part :</strong> La plateforme <strong>RizIvoirien</strong>, ci-après dénommée « la Plateforme ».</p>
  <p style="font-size: 14px;"><strong>D'autre part :</strong> <strong>${esc(user?.name)}</strong> (${esc(user?.email) || '—'} — Tél : ${esc(user?.phone) || '—'}), titulaire du permis n° ${esc(driver.licenseNumber) || '—'}, propriétaire du véhicule ${esc(driver.vehicleType) || '—'} immatriculé ${esc(driver.vehiclePlate) || '—'}, ci-après dénommé(e) « le Livreur ».</p>

  <h2 style="font-size: 15px; font-weight: bold; color: #0F1923; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 2 — Objet</h2>
  <p style="font-size: 14px;">Le présent contrat définit les conditions de collaboration entre le Livreur et RizIvoirien pour la réalisation de livraisons de commandes passées sur la marketplace.</p>

  <h2 style="font-size: 15px; font-weight: bold; color: #0F1923; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 3 — Rémunération</h2>
  <p style="font-size: 14px;">Le Livreur perçoit <strong>${driverPct}%</strong> des frais de livraison collectés sur chaque commande livrée. Le solde de <strong>${100 - driverPct}%</strong> est retenu par la Plateforme.</p>
  ${subPrice > 0 ? `<p style="font-size: 14px;">Un abonnement mensuel de <strong>${subPrice.toLocaleString('fr-FR')} FCFA</strong> peut être prélevé pour l'accès à la plateforme.</p>` : ''}
  <p style="font-size: 14px;">Les paiements sont effectués selon la politique de reversement définie par RizIvoirien, sur présentation de la fiche de paie mensuelle.</p>

  <h2 style="font-size: 15px; font-weight: bold; color: #0F1923; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 4 — Obligations du Livreur</h2>
  <ul style="font-size: 14px; padding-left: 20px;">
    <li>Être disponible selon les plages horaires déclarées sur la plateforme.</li>
    <li>Assurer la livraison dans les délais impartis et en bon état.</li>
    <li>Maintenir son véhicule en bon état de marche et aux normes légales.</li>
    <li>Se comporter avec professionnalisme vis-à-vis des clients et vendeurs.</li>
    <li>Informer immédiatement la plateforme de tout incident lors de la livraison.</li>
    <li>Ne pas sous-traiter les livraisons sans accord préalable de RizIvoirien.</li>
  </ul>

  <h2 style="font-size: 15px; font-weight: bold; color: #0F1923; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 5 — Obligations de la Plateforme</h2>
  <ul style="font-size: 14px; padding-left: 20px;">
    <li>Attribuer les missions de livraison de manière transparente et équitable.</li>
    <li>Fournir au Livreur les outils numériques nécessaires à l'exercice de sa mission.</li>
    <li>Reverser les gains dans les délais convenus.</li>
    <li>Informer le Livreur de tout changement tarifaire avec un préavis de 15 jours.</li>
  </ul>

  <h2 style="font-size: 15px; font-weight: bold; color: #0F1923; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 6 — Statut</h2>
  <p style="font-size: 14px;">Le Livreur intervient en qualité de <strong>prestataire indépendant</strong>. Le présent contrat ne crée aucun lien de subordination ni de contrat de travail entre les parties. Le Livreur demeure libre d'organiser son activité comme il l'entend dans le respect des présentes conditions.</p>

  <h2 style="font-size: 15px; font-weight: bold; color: #0F1923; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 7 — Responsabilité</h2>
  <p style="font-size: 14px;">Le Livreur est responsable des dommages causés aux marchandises ou aux tiers lors de l'exercice de sa mission, dans les limites prévues par la législation applicable.</p>

  <h2 style="font-size: 15px; font-weight: bold; color: #0F1923; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 8 — Durée et résiliation</h2>
  <p style="font-size: 14px;">Contrat à durée indéterminée, résiliable par l'une ou l'autre partie avec un préavis de <strong>7 jours</strong>. Résiliation immédiate possible en cas de faute grave.</p>

  <h2 style="font-size: 15px; font-weight: bold; color: #0F1923; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px;">Article 9 — Juridiction</h2>
  <p style="font-size: 14px;">Tout litige sera soumis aux tribunaux compétents d'Abidjan, Côte d'Ivoire.</p>

  <div style="margin-top: 48px; padding-top: 20px; border-top: 2px solid #e0e0e0;">
    <p style="font-size: 13px; color: #666; margin-bottom: 24px;">En signant ce contrat, le Livreur atteste avoir lu, compris et accepté l'intégralité des conditions ci-dessus.</p>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
      <div>
        <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 40px;">Pour RizIvoirien</div>
        <div style="border-bottom: 1px solid #333; width: 180px; margin-bottom: 6px;"></div>
        <div style="font-size: 12px; color: #888;">Direction des opérations</div>
      </div>
      <div>
        <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 40px;">Le Livreur</div>
        <div style="border-bottom: 1px solid #333; width: 180px; margin-bottom: 6px;"></div>
        <div style="font-size: 12px; color: #888;">${esc(user?.name)} — ${date}</div>
      </div>
    </div>
  </div>
</div>
`
}

module.exports = { generateShopContract, generateDriverContract }
