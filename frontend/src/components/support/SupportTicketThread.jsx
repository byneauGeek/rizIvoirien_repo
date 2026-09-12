import { useState, useEffect, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

const fmtTime = (d) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// Fil de discussion d'un ticket de support — même conventions que
// ConversationThread (polling léger plutôt que temps réel), mais posté sur
// /support/tickets/:id/messages plutôt que /conversations/:id/messages, et
// sans marquage lu/non-lu (pas de notion d'unread côté ticket, contrairement
// à la messagerie order/livreur).
export default function SupportTicketThread({ ticketId, closed }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  const load = useCallback(async () => {
    if (!ticketId) return
    try {
      const data = await api.get(`/support/tickets/${ticketId}/messages`)
      setMessages(data.messages)
    } catch (e) {
      setError(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    setLoading(true)
    load()
    const iv = setInterval(load, 8000)
    return () => clearInterval(iv)
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = async (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setError('')
    try {
      const msg = await api.post(`/support/tickets/${ticketId}/messages`, { content })
      setMessages((prev) => [...prev, msg])
      setText('')
    } catch (e2) {
      setError(e2.message || "Erreur d'envoi")
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center font-dm text-sm text-charcoal/40">Chargement…</div>

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center font-dm text-sm text-charcoal/40 mt-8">Aucun message.</p>
        ) : messages.map((m) => {
          const mine = m.senderId === user.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-forest text-cream' : 'bg-charcoal/6 text-charcoal'}`}>
                <p className="font-dm text-sm whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`font-dm text-[10px] mt-1 ${mine ? 'text-cream/60' : 'text-charcoal/40'}`}>{fmtTime(m.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 font-dm text-xs text-red-500">{error}</p>}

      {closed ? (
        <p className="px-4 py-3 border-t border-charcoal/8 font-dm text-xs text-charcoal/40 text-center">Ce ticket est clôturé.</p>
      ) : (
        <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-charcoal/8">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écrire un message…"
            maxLength={4000}
            className="flex-1 bg-charcoal/5 rounded-full px-4 py-2.5 font-dm text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:ring-2 focus:ring-forest/30"
          />
          <button type="submit" disabled={sending || !text.trim()}
            className="p-2.5 rounded-full bg-forest text-cream disabled:opacity-40 hover:bg-forest-light transition-colors shrink-0">
            <Send size={16} />
          </button>
        </form>
      )}
    </div>
  )
}
