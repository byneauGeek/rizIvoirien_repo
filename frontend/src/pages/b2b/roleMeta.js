import { Sprout, Users, Building2, Factory, Ship } from 'lucide-react'

// Métadonnées partagées par le dashboard B2B, indexées par rôle utilisateur.
// `kind` détermine si le rôle publie des OFFERS (vendeur) ou des REQUESTS (acheteur).
export const B2B_ROLE_META = {
  PRODUCER:    { label: 'Producteur',            icon: Sprout,    kind: 'offer',   listingLabel: 'offre' },
  COOPERATIVE: { label: 'Coopérative',           icon: Users,     kind: 'offer',   listingLabel: 'offre' },
  TRADER:      { label: 'Acheteur / Commerçant', icon: Building2, kind: 'request', listingLabel: 'demande' },
  PROCESSOR:   { label: 'Transformateur',        icon: Factory,   kind: 'request', listingLabel: 'demande' },
  EXPORTER:    { label: 'Exportateur',           icon: Ship,      kind: 'request', listingLabel: 'demande' },
}

export const VERIFICATION_LABEL = {
  UNVERIFIED: { label: 'Non vérifié',  color: 'text-charcoal/40 bg-charcoal/5' },
  PENDING:    { label: 'En cours de vérification', color: 'text-amber-600 bg-amber-50' },
  VERIFIED:   { label: 'Vérifié',      color: 'text-green-600 bg-green-50' },
  SUSPENDED:  { label: 'Suspendu',     color: 'text-red-600 bg-red-50' },
}

export const OFFER_STATUS_LABEL = {
  DRAFT: 'Brouillon', AVAILABLE: 'Disponible', RESERVED: 'Réservée',
  SOLD: 'Vendue', EXPIRED: 'Expirée', DISABLED: 'Désactivée',
}

export const REQUEST_STATUS_LABEL = {
  DRAFT: 'Brouillon', ACTIVE: 'Active', FULFILLED: 'Satisfaite',
  EXPIRED: 'Expirée', CANCELLED: 'Annulée',
}
