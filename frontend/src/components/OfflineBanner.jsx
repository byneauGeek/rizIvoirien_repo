import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

// Connectivité mobile parfois instable (marché ivoirien) — sans ce bandeau,
// une page qui poll silencieusement (MyOrdersPage, MessagesPanel, ...) ou un
// clic qui échoue en réseau coupé n'a aucun signal distinct d'une vraie
// erreur serveur pour l'utilisateur.
export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] bg-charcoal text-cream px-4 py-2.5 flex items-center justify-center gap-2">
      <WifiOff size={15} className="shrink-0" />
      <span className="font-dm text-sm">Pas de connexion internet — certaines actions peuvent échouer.</span>
    </div>
  )
}
