import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    const base = 'RizIvoirien — Marketplace du riz ivoirien'
    document.title = title ? `${title} · ${base}` : base
    return () => { document.title = base }
  }, [title])
}
