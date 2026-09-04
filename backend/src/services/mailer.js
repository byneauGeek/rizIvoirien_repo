/**
 * mailer.js — Service d'envoi d'emails transactionnels
 *
 * Configuration via variables d'environnement :
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Si SMTP_HOST n'est pas défini, les envois sont simulés en console (dev).
 */
const nodemailer = require('nodemailer')

const fmt = (n) => Number(n).toLocaleString('fr-FR')

// Les templates interpolent des champs saisis par les utilisateurs (nom, adresse,
// nom de boutique/produit...) directement dans du HTML envoyé à D'AUTRES utilisateurs
// (ex : le vendeur reçoit le nom du client). Sans échappement, un nom contenant du
// HTML/JS pourrait s'exécuter ou injecter un lien dans l'email d'un tiers.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))

// ─── Transporter ──────────────────────────────────────────────────────────────
function createTransporter() {
  if (!process.env.SMTP_HOST) {
    // Mode dev : log dans la console, pas d'envoi réel
    return nodemailer.createTransport({ jsonTransport: true })
  }
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

const FROM = process.env.SMTP_FROM || '"RizIvoirien" <noreply@rizivoirien.ci>'

// ─── Layout HTML partagé ──────────────────────────────────────────────────────
function layout(title, content) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { margin:0; padding:0; background:#F5F0E8; font-family:'Segoe UI',Arial,sans-serif; }
  .wrap { max-width:600px; margin:32px auto; background:#fff; border-radius:24px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .header { background:#1B4332; padding:32px 40px; text-align:center; }
  .header h1 { margin:0; color:#F5F0E8; font-size:24px; font-weight:700; letter-spacing:-0.5px; }
  .header p  { margin:4px 0 0; color:#A7C4B5; font-size:14px; }
  .body   { padding:40px; }
  .body h2 { margin:0 0 8px; color:#0F1923; font-size:20px; font-weight:700; }
  .body p  { margin:0 0 16px; color:#4A5568; font-size:15px; line-height:1.6; }
  .badge  { display:inline-block; padding:6px 16px; border-radius:999px; font-size:13px; font-weight:700; }
  .badge-green  { background:#D1FAE5; color:#065F46; }
  .badge-amber  { background:#FEF3C7; color:#92400E; }
  .badge-red    { background:#FEE2E2; color:#991B1B; }
  .card   { background:#F9FAFB; border-radius:16px; padding:20px 24px; margin:20px 0; }
  .card-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #E5E7EB; font-size:14px; color:#374151; }
  .card-row:last-child { border-bottom:none; }
  .card-total { font-size:18px; font-weight:700; color:#1B4332; }
  .btn    { display:inline-block; background:#1B4332; color:#F5F0E8 !important; text-decoration:none; padding:14px 32px; border-radius:999px; font-weight:700; font-size:15px; margin:8px 0; }
  .footer { background:#F9FAFB; padding:24px 40px; text-align:center; }
  .footer p { margin:0; color:#9CA3AF; font-size:12px; line-height:1.8; }
  .divider { height:1px; background:#F3F4F6; margin:24px 0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🌾 RizIvoirien</h1>
    <p>La marketplace du riz ivoirien de qualité</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    <p>
      RizIvoirien · Abidjan, Côte d'Ivoire<br>
      <a href="mailto:support@rizivoirien.ci" style="color:#6B7280;">support@rizivoirien.ci</a>
      · Vous recevez cet email car vous avez un compte sur notre plateforme.
    </p>
  </div>
</div>
</body>
</html>`
}

// ─── Templates ────────────────────────────────────────────────────────────────

const templates = {

  // Confirmation d'inscription
  welcome({ name, role }) {
    const roleLabel = { BUYER: 'acheteur', SELLER: 'vendeur', DRIVER: 'livreur' }[role] || ''
    return {
      subject: '🎉 Bienvenue sur RizIvoirien !',
      html: layout('Bienvenue', `
        <h2>Bienvenue, ${esc(name)} !</h2>
        <p>Votre compte <strong>${roleLabel}</strong> a été créé avec succès sur RizIvoirien.</p>
        <p>Vous pouvez dès maintenant vous connecter et profiter de notre marketplace de riz ivoirien de qualité.</p>
        <div class="divider"></div>
        <p style="text-align:center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth" class="btn">Accéder à mon compte</a>
        </p>
      `),
    }
  },

  // Confirmation de commande (acheteur)
  orderConfirmed({ name, orderId, items, total, deliveryFee, discount, address, shopName }) {
    const rows = items.map(i =>
      `<div class="card-row"><span>${i.quantity}× ${esc(i.name)}</span><span>${fmt(i.price * i.quantity)} FCFA</span></div>`
    ).join('')
    return {
      subject: `✅ Commande #${orderId} confirmée — RizIvoirien`,
      html: layout(`Commande #${orderId}`, `
        <h2>Commande confirmée !</h2>
        <p>Bonjour <strong>${esc(name)}</strong>, votre commande <strong>#${orderId}</strong> auprès de <strong>${esc(shopName)}</strong> a bien été reçue.</p>
        <div class="card">
          ${rows}
          ${discount > 0 ? `<div class="card-row"><span>Réduction</span><span style="color:#065F46">−${fmt(discount)} FCFA</span></div>` : ''}
          <div class="card-row"><span>Livraison</span><span>${fmt(deliveryFee)} FCFA</span></div>
          <div class="card-row card-total"><span>Total</span><span>${fmt(total + deliveryFee)} FCFA</span></div>
        </div>
        <p>📍 Adresse de livraison : <strong>${esc(address)}</strong></p>
        <p>Vous serez notifié à chaque étape de votre livraison.</p>
        <div style="text-align:center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders" class="btn">Suivre ma commande</a>
        </div>
      `),
    }
  },

  // Nouvelle commande (vendeur)
  newOrder({ shopName, orderId, buyerName, items, total }) {
    const rows = items.map(i =>
      `<div class="card-row"><span>${i.quantity}× ${esc(i.name)}</span><span>${fmt(i.price * i.quantity)} FCFA</span></div>`
    ).join('')
    return {
      subject: `🛍️ Nouvelle commande #${orderId} — ${shopName}`,
      html: layout(`Commande #${orderId}`, `
        <h2>Nouvelle commande reçue !</h2>
        <p>La boutique <strong>${esc(shopName)}</strong> a reçu une nouvelle commande de <strong>${esc(buyerName)}</strong>.</p>
        <div class="card">
          ${rows}
          <div class="card-row card-total"><span>Total produits</span><span>${fmt(total)} FCFA</span></div>
        </div>
        <p>Rendez-vous sur votre tableau de bord pour confirmer et préparer la commande.</p>
        <div style="text-align:center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/vendor" class="btn">Gérer la commande</a>
        </div>
      `),
    }
  },

  // Commande livrée (acheteur)
  orderDelivered({ name, orderId, shopName }) {
    return {
      subject: `🎉 Commande #${orderId} livrée — RizIvoirien`,
      html: layout('Livraison effectuée', `
        <h2>Votre commande est arrivée !</h2>
        <p>Bonjour <strong>${esc(name)}</strong>, votre commande <strong>#${orderId}</strong> de <strong>${esc(shopName)}</strong> a été livrée avec succès.</p>
        <p>Nous espérons que vous êtes satisfait(e) de votre riz. N'hésitez pas à laisser un avis sur les produits reçus.</p>
        <div style="text-align:center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders" class="btn">Laisser un avis</a>
        </div>
      `),
    }
  },

  // Commande annulée (acheteur)
  orderCancelled({ name, orderId }) {
    return {
      subject: `❌ Commande #${orderId} annulée — RizIvoirien`,
      html: layout('Commande annulée', `
        <h2>Commande annulée</h2>
        <p>Bonjour <strong>${esc(name)}</strong>, votre commande <strong>#${orderId}</strong> a été annulée.</p>
        <p>Le stock des articles a été rétabli. Vous pouvez recommander à tout moment.</p>
        <div style="text-align:center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/shop" class="btn">Continuer mes achats</a>
        </div>
      `),
    }
  },

  // Approbation boutique (vendeur)
  shopApproved({ name, shopName }) {
    return {
      subject: `✅ Votre boutique "${shopName}" est approuvée !`,
      html: layout('Boutique approuvée', `
        <h2>Félicitations, ${esc(name)} !</h2>
        <p>Votre boutique <strong>${esc(shopName)}</strong> a été approuvée par notre équipe. Vous pouvez maintenant :</p>
        <ul style="color:#4A5568;font-size:15px;line-height:2">
          <li>Ajouter vos produits</li>
          <li>Signer votre contrat partenaire</li>
          <li>Recevoir vos premières commandes</li>
        </ul>
        <div style="text-align:center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/vendor" class="btn">Accéder à mon espace vendeur</a>
        </div>
      `),
    }
  },

  // Rejet boutique (vendeur)
  shopRejected({ name, shopName, reason }) {
    return {
      subject: `❌ Votre demande pour "${shopName}" n'a pas été acceptée`,
      html: layout('Demande refusée', `
        <h2>Demande non acceptée</h2>
        <p>Bonjour <strong>${esc(name)}</strong>, nous avons examiné votre demande pour la boutique <strong>${esc(shopName)}</strong>.</p>
        ${reason ? `<div class="card"><p style="margin:0;color:#374151"><strong>Motif :</strong> ${esc(reason)}</p></div>` : ''}
        <p>Pour toute question, contactez notre équipe support.</p>
        <div style="text-align:center">
          <a href="mailto:support@rizivoirien.ci" class="btn">Contacter le support</a>
        </div>
      `),
    }
  },

  // Approbation livreur
  driverApproved({ name }) {
    return {
      subject: '✅ Votre profil livreur est approuvé — RizIvoirien',
      html: layout('Profil livreur approuvé', `
        <h2>Bienvenue dans l'équipe, ${esc(name)} !</h2>
        <p>Votre profil de livreur a été validé. Vous pouvez dès maintenant vous connecter, passer en ligne et commencer à recevoir des offres de livraison.</p>
        <div class="card">
          <div class="card-row"><span>📱 Passez en ligne</span><span><span class="badge badge-green">Disponible</span></span></div>
          <div class="card-row"><span>📦 Recevez des offres</span><span>En temps réel</span></div>
          <div class="card-row"><span>💰 Gagnez</span><span>Par livraison</span></div>
        </div>
        <div style="text-align:center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/driver" class="btn">Accéder à mon espace livreur</a>
        </div>
      `),
    }
  },

  // Livreur assigné — confirmation avec détails (acheteur)
  driverAssigned({ name, orderId, driverName, driverPhone, deliveryDate, paymentMethod, totalToPay, shopName }) {
    const isCash = paymentMethod === 'CASH_ON_DELIVERY' || !paymentMethod
    const paymentBlock = isCash
      ? `<div class="card">
           <div class="card-row"><span>💵 Mode de paiement</span><strong>Espèces à la livraison</strong></div>
           <div class="card-row card-total"><span>Montant à préparer</span><span>${fmt(totalToPay)} FCFA</span></div>
         </div>
         <p>⚠️ Veuillez préparer le montant exact en espèces pour remettre à votre livreur.</p>`
      : `<div class="card">
           <div class="card-row"><span>✅ Mode de paiement</span><strong>${paymentMethod === 'MOBILE_MONEY' ? 'Mobile Money' : 'Carte bancaire'}</strong></div>
           <div class="card-row"><span>Statut</span><span class="badge badge-green">Déjà payé</span></div>
         </div>
         <p>Aucun paiement supplémentaire requis — votre commande est déjà réglée.</p>`

    return {
      subject: `🚚 Votre livreur est en route — Commande #${orderId}`,
      html: layout('Livreur assigné', `
        <h2>Votre livreur a été assigné !</h2>
        <p>Bonjour <strong>${esc(name)}</strong>, un livreur a accepté votre commande <strong>#${orderId}</strong> auprès de <strong>${esc(shopName)}</strong>.</p>

        <div class="card">
          <div class="card-row"><span>🧑 Livreur</span><strong>${esc(driverName)}</strong></div>
          <div class="card-row"><span>📞 Contact</span><a href="tel:${driverPhone}" style="color:#1B4332;font-weight:700">${driverPhone || 'Non renseigné'}</a></div>
          <div class="card-row"><span>📅 Livraison prévue</span><strong>${deliveryDate}</strong></div>
        </div>

        <h2 style="margin-top:24px">Modalités de paiement</h2>
        ${paymentBlock}

        <div class="divider"></div>
        <p>Vous recevrez une nouvelle notification lorsque le livreur aura récupéré votre colis.</p>
        <div style="text-align:center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders" class="btn">Suivre ma commande</a>
        </div>
      `),
    }
  },

  // Vérification d'email
  verifyEmail({ name, token }) {
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`
    return {
      subject: '📧 Vérifiez votre adresse email — RizIvoirien',
      html: layout('Vérification email', `
        <h2>Confirmez votre adresse email</h2>
        <p>Bonjour <strong>${esc(name)}</strong>, merci de vous être inscrit(e) sur RizIvoirien !</p>
        <p>Pour activer votre compte et profiter de toutes les fonctionnalités, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${link}" class="btn">✅ Vérifier mon email</a>
        </div>
        <div class="divider"></div>
        <p style="font-size:13px;color:#9CA3AF">Ce lien est valable 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.</p>
      `),
    }
  },

  // Réinitialisation du mot de passe
  resetPassword({ name, token }) {
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`
    return {
      subject: '🔑 Réinitialisation de votre mot de passe — RizIvoirien',
      html: layout('Mot de passe oublié', `
        <h2>Réinitialiser votre mot de passe</h2>
        <p>Bonjour <strong>${esc(name)}</strong>, nous avons reçu une demande de réinitialisation du mot de passe de votre compte.</p>
        <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${link}" class="btn">🔑 Réinitialiser mon mot de passe</a>
        </div>
        <div class="divider"></div>
        <div class="card">
          <div class="card-row"><span>⏱️ Validité du lien</span><strong>1 heure</strong></div>
          <div class="card-row"><span>📧 Compte concerné</span><strong>${esc(name)}</strong></div>
        </div>
        <p style="font-size:13px;color:#9CA3AF">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email — votre mot de passe reste inchangé.</p>
      `),
    }
  },

  // Résolution de litige (acheteur)
  disputeResolved({ name, orderId, status, refundAmount, resolution, shopName }) {
    const isRefund   = status === 'RESOLVED_REFUND'
    const isRejected = status === 'RESOLVED_REJECTED'
    const isClosed   = status === 'CLOSED'

    const statusBlock = isRefund
      ? `<div class="card">
           <div class="card-row"><span>✅ Décision</span><strong class="badge badge-green">Remboursement accordé</strong></div>
           <div class="card-row card-total"><span>Montant</span><span>${Number(refundAmount).toLocaleString('fr-FR')} FCFA</span></div>
         </div>
         <p>Notre équipe va vous contacter pour procéder au remboursement dans les meilleurs délais.</p>`
      : isRejected
      ? `<div class="card">
           <div class="card-row"><span>❌ Décision</span><strong class="badge badge-red">Litige non retenu</strong></div>
           ${resolution ? `<div class="card-row"><span>Motif</span><span>${esc(resolution)}</span></div>` : ''}
         </div>
         <p>Si vous souhaitez contester cette décision, contactez notre support.</p>`
      : `<div class="card">
           <div class="card-row"><span>🔄 Statut</span><strong>En cours de traitement</strong></div>
         </div>`

    return {
      subject: `📋 Mise à jour de votre litige — Commande #${orderId}`,
      html: layout('Litige mis à jour', `
        <h2>Mise à jour de votre litige</h2>
        <p>Bonjour <strong>${esc(name)}</strong>, voici une mise à jour concernant votre litige sur la commande <strong>#${orderId}</strong> de <strong>${esc(shopName)}</strong>.</p>
        ${statusBlock}
        <div class="divider"></div>
        <div style="text-align:center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders" class="btn">Voir mes commandes</a>
        </div>
      `),
    }
  },

  // Stock faible (vendeur)
  lowStock({ shopName, productName, stock }) {
    return {
      subject: `⚠️ Stock faible : ${productName}`,
      html: layout('Alerte stock', `
        <h2>Stock faible détecté</h2>
        <p>La boutique <strong>${esc(shopName)}</strong> a un stock faible sur le produit suivant :</p>
        <div class="card">
          <div class="card-row"><span>Produit</span><strong>${esc(productName)}</strong></div>
          <div class="card-row"><span>Stock restant</span><span class="badge badge-amber">${stock} sac${stock > 1 ? 's' : ''}</span></div>
        </div>
        <p>Pensez à réapprovisionner ce produit pour éviter les ruptures de stock.</p>
        <div style="text-align:center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/vendor" class="btn">Mettre à jour le stock</a>
        </div>
      `),
    }
  },

}

// ─── Fonction d'envoi principale ──────────────────────────────────────────────
async function sendMail(to, templateName, data) {
  if (!to) return

  const tpl = templates[templateName]
  if (!tpl) {
    console.warn(`[mailer] Template inconnu : ${templateName}`)
    return
  }

  const { subject, html } = tpl(data)

  try {
    const transporter = createTransporter()
    const info = await transporter.sendMail({ from: FROM, to, subject, html })

    if (!process.env.SMTP_HOST) {
      // Dev : affiche dans la console avec un résumé lisible
      console.log(`\n📧 [mailer DEV] → ${to}`)
      console.log(`   Sujet : ${subject}`)
      console.log(`   Template : ${templateName}`)
    } else {
      console.log(`[mailer] ✉️  ${subject} → ${to} (${info.messageId})`)
    }
  } catch (err) {
    // Ne jamais faire crasher l'app pour un email raté
    console.error(`[mailer] Échec envoi à ${to} :`, err.message)
  }
}

module.exports = { sendMail }
