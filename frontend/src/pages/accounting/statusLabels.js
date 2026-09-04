// Libellés FR + couleurs des statuts des modèles comptables (LOT 2/3).
// Un seul endroit pour ne pas dupliquer ce mapping dans chaque écran.
export const REMUNERATION_STATUS = {
  DRAFT:               { label: 'Brouillon',            color: 'text-charcoal/40 bg-charcoal/5' },
  CALCULATED:          { label: 'Calculée',             color: 'text-blue-600 bg-blue-50' },
  PENDING_VALIDATION:  { label: 'En attente de validation', color: 'text-amber-600 bg-amber-50' },
  VALIDATED:           { label: 'Validée',              color: 'text-green-600 bg-green-50' },
  PAYMENT_PENDING:     { label: 'Ordre de paiement créé', color: 'text-indigo-600 bg-indigo-50' },
  PAYMENT_PROCESSING:  { label: 'Paiement en cours',     color: 'text-indigo-600 bg-indigo-50' },
  PAID:                { label: 'Payée',                color: 'text-green-700 bg-green-100' },
  REJECTED:            { label: 'Rejetée',               color: 'text-red-600 bg-red-50' },
  CANCELLED:           { label: 'Annulée',               color: 'text-charcoal/40 bg-charcoal/5' },
  PAYMENT_FAILED:      { label: 'Paiement échoué',       color: 'text-red-600 bg-red-50' },
}

export const PAYMENT_ORDER_STATUS = {
  PENDING_CONTROL: { label: 'À contrôler',        color: 'text-amber-600 bg-amber-50' },
  ON_HOLD:         { label: 'En attente',         color: 'text-orange-600 bg-orange-50' },
  PENDING_PAYMENT: { label: 'À payer',            color: 'text-blue-600 bg-blue-50' },
  PROCESSING:      { label: 'En cours',           color: 'text-indigo-600 bg-indigo-50' },
  PAID:            { label: 'Payé',               color: 'text-green-700 bg-green-100' },
  REJECTED:        { label: 'Rejeté',             color: 'text-red-600 bg-red-50' },
  FAILED:          { label: 'Échoué',             color: 'text-red-600 bg-red-50' },
  CANCELLED:       { label: 'Annulé',             color: 'text-charcoal/40 bg-charcoal/5' },
}

export const PAYMENT_STATUS = {
  PENDING:    { label: 'En attente',  color: 'text-amber-600 bg-amber-50' },
  PROCESSING: { label: 'En cours',    color: 'text-indigo-600 bg-indigo-50' },
  PAID:       { label: 'Payé',        color: 'text-green-700 bg-green-100' },
  FAILED:     { label: 'Échoué',      color: 'text-red-600 bg-red-50' },
  CANCELLED:  { label: 'Annulé',      color: 'text-charcoal/40 bg-charcoal/5' },
  REFUNDED:   { label: 'Remboursé',   color: 'text-blue-600 bg-blue-50' },
}

export const DEBT_STATUS = {
  OPEN:            { label: 'Ouverte',          color: 'text-amber-600 bg-amber-50' },
  PARTIALLY_PAID:  { label: 'Partiellement réglée', color: 'text-blue-600 bg-blue-50' },
  PAID:            { label: 'Soldée',           color: 'text-green-700 bg-green-100' },
  OVERDUE:         { label: 'Échue',            color: 'text-red-600 bg-red-50' },
  CANCELLED:       { label: 'Annulée',          color: 'text-charcoal/40 bg-charcoal/5' },
}

export const RECEIVABLE_STATUS = DEBT_STATUS

export const TRANSACTION_TYPE_LABEL = {
  DEBT_CREATED: 'Dette créée', RECEIVABLE_CREATED: 'Créance créée',
  PAYMENT_EXECUTED: 'Paiement exécuté', ENCAISSEMENT: 'Encaissement', DECAISSEMENT: 'Décaissement',
  COMMISSION_APPLIED: 'Commission appliquée', EXPENSE_RECORDED: 'Dépense enregistrée',
  TRANSFER: 'Virement', ADJUSTMENT: 'Ajustement',
}

export const badge = (map, status) => map[status] || { label: status, color: 'text-charcoal/40 bg-charcoal/5' }
