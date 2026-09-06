// LOT AUDIT-G1 (audit XXX RIZ) : miroir frontend de unitPriceFor (backend
// src/routes/orders.js) — le panier/checkout doit afficher le MÊME prix que
// celui réellement facturé par le serveur, sinon le total vu par l'acheteur
// diverge silencieusement du total de la commande créée.
export function effectiveUnitPrice(product, quantity) {
  if (!product) return 0
  return product.saleType !== 'RETAIL' && product.wholesalePrice && quantity >= (product.minWholesaleQty || 1)
    ? product.wholesalePrice
    : product.price
}
