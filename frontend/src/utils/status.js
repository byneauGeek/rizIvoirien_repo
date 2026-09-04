export const STATUS_LABELS = {
  PENDING_VALIDATION: 'En attente de validation',
  PENDING:        'En attente',
  CONFIRMED:      'Confirmée',
  EN_PREPARATION: 'En préparation',
  PRET:           'Prête à récupérer',
  IN_TRANSIT:     'Récupéré · En route',
  DELIVERED:      'Livrée',
  CANCELLED:      'Annulée',
  ESCALATED:      'Escaladée admin',
}

export const STATUS_COLORS = {
  PENDING_VALIDATION: 'bg-sky-100 text-sky-800 border-sky-200',
  PENDING:        'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED:      'bg-blue-100 text-blue-800 border-blue-200',
  EN_PREPARATION: 'bg-orange-100 text-orange-800 border-orange-200',
  PRET:           'bg-purple-100 text-purple-800 border-purple-200',
  IN_TRANSIT:     'bg-indigo-100 text-indigo-800 border-indigo-200',
  DELIVERED:      'bg-green-100 text-green-800 border-green-200',
  CANCELLED:      'bg-red-100 text-red-800 border-red-200',
  ESCALATED:      'bg-gray-100 text-gray-800 border-gray-200',
}

export const STATUS_DOT = {
  PENDING_VALIDATION: 'bg-sky-400',
  PENDING:        'bg-amber-400',
  CONFIRMED:      'bg-blue-400',
  EN_PREPARATION: 'bg-orange-400',
  PRET:           'bg-purple-400',
  IN_TRANSIT:     'bg-indigo-400',
  DELIVERED:      'bg-green-500',
  CANCELLED:      'bg-red-400',
  ESCALATED:      'bg-gray-400',
}

export const fmt = (n) => n?.toLocaleString('fr-FR') ?? '0'
export const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const fmtOrderId  = (id, createdAt) => `CMD-${createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear()}-${String(id ?? 0).padStart(5, '0')}`
export const fmtShopId   = (id) => `BT-${String(id ?? 0).padStart(4, '0')}`
export const fmtDriverId = (id) => `LV-${String(id ?? 0).padStart(4, '0')}`
