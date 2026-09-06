// invoiceGenerator.js — LOT AUDIT-ACC-01 (audit XXX RIZ)
// Même pattern que contractGenerator.js : HTML stocké en base, rendu +
// export PDF côté client (html2pdf.js) — pas de moteur de facturation
// parallèle, pas de PDF généré/stocké côté serveur.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

function nextInvoiceNumber(cooperativeId, transactionId) {
  const y = new Date().getFullYear()
  return `FACT-COOP${cooperativeId}-${y}-${transactionId}`
}

function generateTransactionInvoice({ tx, cooperative, seller, buyer, invoiceNumber }) {
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  return `
<div style="font-family: 'Georgia', serif; max-width: 700px; margin: 0 auto; color: #1a1a1a; line-height: 1.7;">
  <div style="text-align:center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #1B4332;">
    <div style="font-size: 28px; font-weight: bold; color: #1B4332;">🌾 RizIvoirien — Filière B2B</div>
    <h1 style="font-size: 20px; font-weight: bold; margin-top: 20px; color: #1a1a1a; letter-spacing: 1px; text-transform: uppercase;">Facture</h1>
    <div style="font-size: 13px; color: #888;">N° ${esc(invoiceNumber)}</div>
    <div style="font-size: 13px; color: #888;">Établie le ${date}</div>
  </div>

  <table style="width:100%; font-size:14px; margin-bottom:24px;">
    <tr>
      <td style="vertical-align:top; width:50%;">
        <strong>Vendeur</strong><br/>
        ${esc(cooperative.name)}${cooperative.responsable ? `<br/>Responsable : ${esc(cooperative.responsable)}` : ''}<br/>
        ${esc(seller.email)}
      </td>
      <td style="vertical-align:top; width:50%;">
        <strong>Acheteur</strong><br/>
        ${esc(buyer.name)}<br/>
        ${esc(buyer.email)}
      </td>
    </tr>
  </table>

  <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:24px;">
    <thead>
      <tr style="background:#f4f4f4;">
        <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Produit</th>
        <th style="text-align:right; padding:8px; border-bottom:1px solid #ddd;">Quantité</th>
        <th style="text-align:right; padding:8px; border-bottom:1px solid #ddd;">Montant</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:8px; border-bottom:1px solid #eee;">${esc(tx.product)}</td>
        <td style="text-align:right; padding:8px; border-bottom:1px solid #eee;">${fmt(tx.quantity)} ${esc(tx.unit)}</td>
        <td style="text-align:right; padding:8px; border-bottom:1px solid #eee;">${tx.amount != null ? `${fmt(tx.amount)} FCFA` : '—'}</td>
      </tr>
    </tbody>
  </table>

  <p style="font-size: 12px; color: #888; margin-top: 32px; border-top: 1px solid #eee; padding-top: 12px;">
    Ce document atteste d'une transaction déclarée sur la filière B2B RizIvoirien (référence commande #${tx.id}).
    Il ne constitue pas une preuve de paiement — le règlement s'effectue directement entre les parties, hors plateforme.
  </p>
</div>`
}

module.exports = { generateTransactionInvoice, nextInvoiceNumber }
