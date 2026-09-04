import { useEffect, useState } from 'react'
import { api } from '../api/client'

// Régions/produits/unités affichés comme suggestions dans les formulaires B2B —
// gérés par l'admin (cahier de cadrage §16), plus codés en dur côté frontend.
// Repli minimal si l'API est indisponible, pour ne jamais bloquer un formulaire.
const FALLBACK = {
  regions: ['Abidjan', 'Bouaké', 'Yamoussoukro', 'Korhogo', 'San-Pédro', 'Daloa'],
  products: ['Riz paddy', 'Riz blanchi'],
  units: ['kg', 'tonne', 'sac'],
}

let cache = null
let inflight = null

export function useB2BReferenceData() {
  const [data, setData] = useState(cache || FALLBACK)

  useEffect(() => {
    if (cache) { setData(cache); return }
    if (!inflight) {
      inflight = api.get('/b2b/reference-data')
        .then((d) => { cache = d; return d })
        .catch(() => FALLBACK)
    }
    let active = true
    inflight.then((d) => { if (active) setData(d) })
    return () => { active = false }
  }, [])

  return data
}
