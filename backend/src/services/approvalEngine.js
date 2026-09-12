const prisma = require('../lib/prisma')

// Moteur de règles d'approbation (LOT APPROVAL, audit XXX RIZ) — évalue un
// produit/offre candidat contre les ApprovalRule actives et renvoie la
// décision (APPROVED | PENDING_REVIEW | REJECTED). "Entièrement paramétrable"
// veut dire : l'admin ajoute/retire/désactive des lignes ApprovalRule (seuils,
// mots-clés, sévérité) — ce module se contente d'exécuter chaque ruleType
// connu contre les champs normalisés du candidat, jamais de logique figée.

// Normalise Product ou RiceOffer vers un shape commun, pour que les mêmes
// règles (ex. MIN_PRICE, BANNED_KEYWORDS) s'appliquent aux deux sans dupliquer
// le moteur par type de cible.
function normalize(targetType, data) {
  if (targetType === 'PRODUCT') {
    let images = []
    try { images = JSON.parse(data.images || '[]') } catch { /* images mal formées → traité comme vide */ }
    return {
      name: data.name || '',
      description: data.description || '',
      price: data.price ?? null,
      category: data.category || null,
      imagesCount: images.length,
      quantity: data.stock ?? null,
    }
  }
  // OFFER (RiceOffer)
  let photos = []
  try { photos = JSON.parse(data.photos || '[]') } catch { /* photos mal formées → traité comme vide */ }
  return {
    name: data.product || '',
    description: data.variety || '',
    price: data.price ?? null,
    category: data.product || null,
    imagesCount: photos.length,
    quantity: data.quantity ?? null,
  }
}

// Renvoie true si le candidat ÉCHOUE la règle (viole la condition).
function ruleFails(rule, candidate) {
  let params = {}
  try { params = JSON.parse(rule.params || '{}') } catch { return false } // params invalides : ne bloque jamais silencieusement

  switch (rule.ruleType) {
    case 'MIN_PRICE':
      return candidate.price != null && params.min != null && candidate.price < params.min
    case 'MAX_PRICE':
      return candidate.price != null && params.max != null && candidate.price > params.max
    case 'MIN_IMAGES':
      return candidate.imagesCount < (params.min ?? 1)
    case 'MIN_DESCRIPTION_LENGTH':
      return candidate.description.trim().length < (params.min ?? 0)
    case 'BANNED_KEYWORDS': {
      const haystack = `${candidate.name} ${candidate.description}`.toLowerCase()
      return (params.keywords || []).some((k) => haystack.includes(String(k).toLowerCase()))
    }
    case 'CATEGORY_WHITELIST': {
      const allowed = (params.allowed || []).map((s) => String(s).toLowerCase())
      return allowed.length > 0 && candidate.category != null && !allowed.includes(String(candidate.category).toLowerCase())
    }
    case 'MIN_QUANTITY':
      return candidate.quantity != null && params.min != null && candidate.quantity < params.min
    default:
      return false // ruleType inconnu (ex. ajouté puis retiré du code) : jamais bloquant
  }
}

// targetType: 'PRODUCT' | 'OFFER'. data: le produit/l'offre tel qu'il va être
// créé/mis à jour (champs bruts du modèle, pas encore persistés).
async function evaluateApproval(targetType, data) {
  const rules = await prisma.approvalRule.findMany({
    where: { active: true, OR: [{ targetType }, { targetType: 'BOTH' }] },
  })
  const candidate = normalize(targetType, data)

  let flaggedLabel = null
  for (const rule of rules) {
    if (!ruleFails(rule, candidate)) continue
    if (rule.severity === 'AUTO_REJECT') {
      return { moderationStatus: 'REJECTED', rejectionReason: rule.label }
    }
    if (!flaggedLabel) flaggedLabel = rule.label
  }
  if (flaggedLabel) return { moderationStatus: 'PENDING_REVIEW', rejectionReason: flaggedLabel }
  return { moderationStatus: 'APPROVED', rejectionReason: null }
}

module.exports = { evaluateApproval }
