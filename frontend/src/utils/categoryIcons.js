// Une seule source pour l'icône associée à chaque catégorie — réutilisée par
// ShopPage.jsx et CategorySection.jsx (accueil). Les clés doivent rester
// synchronisées avec CATEGORIES dans pages/vendor/ProductFormView.jsx (le
// vendeur choisit parmi cette liste fixe à la création d'un produit) ; une
// catégorie absente d'ici retombe simplement sur l'icône générique.
export const CATEGORY_ICONS = {
  'Riz local':    '🌾',
  'Riz importé':  '🚢',
  'Riz étuvé':    '♨️',
  'Riz brisé':    '🍚',
  'Riz parfumé':  '🌸',
  'Riz gluant':   '🍙',
  'Autre':        '📦',
}

export const categoryIcon = (category) => CATEGORY_ICONS[category] || '🌾'
