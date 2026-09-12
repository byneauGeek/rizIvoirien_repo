import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MessageCircle, ArrowLeft, Package, Truck, Building2 } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import ConversationThread from '../components/messaging/ConversationThread'

const CONTEXT_META = {
  ORDER:           { icon: Package,   label: 'Commande' },
  ORDER_DRIVER:    { icon: Truck,     label: 'Livraison' },
  SHIPMENT:        { icon: Truck,     label: 'Livraison' },
  B2B_TRANSACTION: { icon: Building2, label: 'Transaction B2B' },
}

function ConversationRow({ conv, active, onClick }) {
  const meta = CONTEXT_META[conv.contextType] || { icon: MessageCircle, label: conv.contextType }
  const Icon = meta.icon
  return (
    <button onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-charcoal/6 transition-colors ${active ? 'bg-forest/8' : 'hover:bg-charcoal/3'}`}>
      <div className="w-10 h-10 rounded-full bg-forest/10 flex items-center justify-center shrink-0">
        <span className="font-bold text-forest text-sm">{conv.otherParty?.name?.[0] || '?'}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-syne text-sm font-bold text-charcoal truncate">{conv.otherParty?.name}</p>
          {conv.unreadCount > 0 && (
            <span className="w-5 h-5 shrink-0 bg-terra text-cream rounded-full text-[10px] font-bold flex items-center justify-center">
              {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
            </span>
          )}
        </div>
        <p className="flex items-center gap-1 font-dm text-[11px] text-charcoal/40 mt-0.5">
          <Icon size={11} /> {meta.label} #{conv.contextId}
        </p>
        {conv.lastMessage && (
          <p className="font-dm text-xs text-charcoal/50 truncate mt-1">{conv.lastMessage.content}</p>
        )}
      </div>
    </button>
  )
}

export default function MessagesPage() {
  usePageTitle('Messages')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resolveError, setResolveError] = useState('')

  const loadList = useCallback(async () => {
    try {
      const data = await api.get('/conversations')
      setConversations(data)
    } catch {
      // silencieux — la liste réessaiera au prochain poll
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) { navigate('/auth'); return }
    loadList()
    const iv = setInterval(loadList, 15000)
    return () => clearInterval(iv)
  }, [user, loadList, navigate])

  // Ouverture directe d'une conversation via ?contextType=ORDER&contextId=42
  // (ex. bouton "Contacter le vendeur" depuis Mes commandes) — résout
  // (ou crée) la conversation puis rafraîchit la liste.
  useEffect(() => {
    const contextType = params.get('contextType')
    const contextId = params.get('contextId')
    if (!contextType || !contextId || !user) return
    api.post('/conversations/resolve', { contextType, contextId: Number(contextId) })
      .then((conv) => { setSelectedId(conv.id); loadList() })
      .catch((e) => setResolveError(e.message || 'Impossible d\'ouvrir cette conversation'))
  }, [params, user, loadList])

  const selected = conversations.find((c) => c.id === selectedId)

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-8 h-screen flex flex-col">
        <div className="mb-4">
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Mon espace</p>
          <h1 className="font-playfair text-3xl font-bold text-charcoal flex items-center gap-2">
            <MessageCircle size={26} /> Messages
          </h1>
        </div>

        {resolveError && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 font-dm text-sm">{resolveError}</div>
        )}

        <div className="flex-1 bg-white rounded-3xl shadow-card overflow-hidden flex min-h-0">
          {/* Liste — cachée sur mobile quand une conversation est ouverte */}
          <div className={`w-full sm:w-80 border-r border-charcoal/8 overflow-y-auto shrink-0 ${selectedId ? 'hidden sm:block' : ''}`}>
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-charcoal/5 rounded-2xl animate-pulse" />)}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle size={32} className="mx-auto text-charcoal/15 mb-3" />
                <p className="font-dm text-sm text-charcoal/40">Aucune conversation pour l'instant.</p>
              </div>
            ) : conversations.map((c) => (
              <ConversationRow key={c.id} conv={c} active={c.id === selectedId} onClick={() => setSelectedId(c.id)} />
            ))}
          </div>

          {/* Fil de discussion */}
          <div className={`flex-1 min-w-0 flex-col ${selectedId ? 'flex' : 'hidden sm:flex'}`}>
            {selected ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-charcoal/8">
                  <button onClick={() => setSelectedId(null)} className="sm:hidden p-1 -ml-1 text-charcoal/50">
                    <ArrowLeft size={18} />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-forest/10 flex items-center justify-center">
                    <span className="font-bold text-forest text-xs">{selected.otherParty?.name?.[0]}</span>
                  </div>
                  <p className="font-syne text-sm font-bold text-charcoal">{selected.otherParty?.name}</p>
                </div>
                <ConversationThread conversationId={selectedId} />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="font-dm text-sm text-charcoal/30">Sélectionnez une conversation</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
