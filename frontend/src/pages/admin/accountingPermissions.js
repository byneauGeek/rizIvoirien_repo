// Libellés FR des permissions comptables — la liste elle-même (les clés) vit
// côté backend (middleware/accounting.js) qui reste la seule source de vérité
// pour l'application des droits ; ceci n'est que l'habillage de l'UI admin.
export const PERMISSION_GROUPS = [
  {
    label: 'Général',
    permissions: [
      { key: 'accounting.view', label: 'Accéder à l\'espace comptable' },
      { key: 'accounting.audit.view', label: 'Consulter le journal d\'audit' },
      { key: 'accounting.settings.manage', label: 'Gérer les paramètres comptables' },
    ],
  },
  {
    label: 'Transactions',
    permissions: [
      { key: 'accounting.transactions.view', label: 'Consulter les transactions' },
      { key: 'accounting.transactions.create', label: 'Créer une transaction' },
      { key: 'accounting.transactions.edit', label: 'Modifier une transaction' },
      { key: 'accounting.transactions.validate', label: 'Valider une transaction' },
    ],
  },
  {
    label: 'Paiements',
    permissions: [
      { key: 'accounting.payments.view', label: 'Consulter les paiements' },
      { key: 'accounting.payments.create', label: 'Créer un ordre de paiement' },
      { key: 'accounting.payments.execute', label: 'Exécuter un paiement' },
      { key: 'accounting.payments.cancel', label: 'Annuler un paiement' },
    ],
  },
  {
    label: 'Rémunérations & paie',
    permissions: [
      { key: 'accounting.payroll.view', label: 'Consulter les rémunérations' },
      { key: 'accounting.payroll.create', label: 'Calculer une rémunération' },
      { key: 'accounting.payroll.validate', label: 'Valider une rémunération' },
    ],
  },
  {
    label: 'Trésorerie',
    permissions: [
      { key: 'accounting.treasury.view', label: 'Consulter la trésorerie' },
      { key: 'accounting.treasury.manage', label: 'Gérer les comptes de trésorerie' },
    ],
  },
  {
    label: 'Rapprochement',
    permissions: [
      { key: 'accounting.reconciliation.view', label: 'Consulter le rapprochement' },
      { key: 'accounting.reconciliation.manage', label: 'Effectuer un rapprochement' },
    ],
  },
  {
    label: 'Rapports & documents',
    permissions: [
      { key: 'accounting.reports.view', label: 'Consulter les rapports' },
      { key: 'accounting.documents.view', label: 'Consulter les documents' },
      { key: 'accounting.documents.export', label: 'Exporter des documents' },
    ],
  },
]
