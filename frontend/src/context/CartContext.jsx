import { createContext, useContext, useReducer, useEffect } from 'react'
import { effectiveUnitPrice } from '../utils/pricing'

const CartContext = createContext(null)

const STORAGE_KEY = 'riz_cart_v1'

// ─── Chargement initial depuis localStorage ───────────────────────────────────
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { items: [] }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.items)) return { items: [] }
    // Sanity-check chaque item : doit avoir id, price, qty
    const valid = parsed.items.filter(
      i => i?.id && typeof i.price === 'number' && typeof i.qty === 'number'
    )
    // LOT VARIANTS : items chargés d'un panier sauvegardé avant cette
    // fonctionnalité n'ont pas encore ce champ — normalisé à null (taille de
    // base), jamais undefined (undefined ne survit pas la sérialisation
    // localStorage et casserait les comparaisons ===).
    return { items: valid.map(i => ({ ...i, variantId: i.variantId ?? null })) }
  } catch {
    return { items: [] }
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function cartReducer(state, action) {
  switch (action.type) {

    // LOT VARIANTS : deux lignes partageant le même productId mais une
    // variantId différente (ex. 25kg et 50kg du même riz) sont des lignes de
    // panier DISTINCTES — l'identité d'une ligne est désormais la paire
    // (id, variantId), jamais id seul.
    case 'ADD': {
      const variantId = action.product.variantId ?? null
      const addQty = action.qty && action.qty > 0 ? action.qty : 1
      const existing = state.items.find(i => i.id === action.product.id && i.variantId === variantId)
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            (i.id === action.product.id && i.variantId === variantId) ? { ...i, qty: i.qty + addQty } : i
          ),
        }
      }
      return { ...state, items: [...state.items, { ...action.product, variantId, qty: addQty }] }
    }

    case 'REMOVE':
      return { ...state, items: state.items.filter(i => !(i.id === action.id && i.variantId === (action.variantId ?? null))) }

    case 'UPDATE_QTY':
      return {
        ...state,
        items: state.items.map(i =>
          (i.id === action.id && i.variantId === (action.variantId ?? null)) ? { ...i, qty: Math.max(1, action.qty) } : i
        ),
      }

    case 'CLEAR':
      return { items: [] }

    // Vide le panier puis ajoute le produit (changement de boutique confirmé)
    case 'REPLACE':
      return { items: [{ ...action.product, variantId: action.product.variantId ?? null, qty: action.qty && action.qty > 0 ? action.qty : 1 }] }

    default:
      return state
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, null, loadFromStorage)

  // Synchronisation dans localStorage à chaque changement d'état
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Quota dépassé ou navigation privée — on ignore silencieusement
    }
  }, [state])

  const total = state.items.reduce((sum, i) => sum + effectiveUnitPrice(i, i.qty) * i.qty, 0)
  const count = state.items.reduce((sum, i) => sum + i.qty, 0)

  // Ajout multi-boutiques : toujours autorisé
  const addItem = (product, qty = 1) => {
    dispatch({ type: 'ADD', product, qty })
    return { ok: true }
  }

  const replaceCart = (product, qty = 1) => {
    dispatch({ type: 'REPLACE', product, qty })
  }

  return (
    <CartContext.Provider value={{ ...state, total, count, dispatch, addItem, replaceCart }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
