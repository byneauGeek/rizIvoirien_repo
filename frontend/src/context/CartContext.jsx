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
    return { items: valid }
  } catch {
    return { items: [] }
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function cartReducer(state, action) {
  switch (action.type) {

    case 'ADD': {
      const existing = state.items.find(i => i.id === action.product.id)
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.id === action.product.id ? { ...i, qty: i.qty + 1 } : i
          ),
        }
      }
      return { ...state, items: [...state.items, { ...action.product, qty: 1 }] }
    }

    case 'REMOVE':
      return { ...state, items: state.items.filter(i => i.id !== action.id) }

    case 'UPDATE_QTY':
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.id ? { ...i, qty: Math.max(1, action.qty) } : i
        ),
      }

    case 'CLEAR':
      return { items: [] }

    // Vide le panier puis ajoute le produit (changement de boutique confirmé)
    case 'REPLACE':
      return { items: [{ ...action.product, qty: 1 }] }

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
  const addItem = (product) => {
    dispatch({ type: 'ADD', product })
    return { ok: true }
  }

  const replaceCart = (product) => {
    dispatch({ type: 'REPLACE', product })
  }

  return (
    <CartContext.Provider value={{ ...state, total, count, dispatch, addItem, replaceCart }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
