import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { LifeBuoy, Crown, Send, CheckCircle, XCircle, UserCheck } from 'lucide-react'

const STATUS_META = {
  OPEN:        { label: 'Ouvert',    cls: 'bg-amber-100 text-amber-700' },
  IN_PROGRESS: { label: 'En cours',  cls: 'bg-blue-100 text-blue-700' },
  RESOLVED:    { label: 'Résolu',    cls: 'bg-green-100 text-green-700' },
  CLOSED:      { label: 'Clôturé',   cls: 'bg-gray-100 text-gray-500' },
}
const fmtTime = (d) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// ─── File d'attente ────────────────────────────────────────────────────────
function TicketRow({ ticket, active, onClick }) {
  const status = STATUS_META[ticket.status] || STATUS_META.OPEN
  const last = ticket.messages?.[0]
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-gray-50 transition-colors ${active ? 'bg-[#1B4332]/6' : 'hover:bg-[#F0F2F5]/60'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-syne text-sm font-bold text-[#0F1923] truncate">{ticket.subject}</p>
        {ticket.priority === 'PRIORITY' && <Crown size={13} className="text-amber-500 shrink-0" />}
      </div>
      <p className="font-dm text-xs text-[#0F1923]/50 mt-0.5 truncate">
        {ticket.user?.name} · {ticket.user?.role}
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
        {ticket.assignedTo && <span className="font-dm text-[10px] text-[#0F1923]/40">→ {ticket.assignedTo.name}</span>}
      </div>
      {last && <p className="font-dm text-xs text-[#0F1923]/40 truncate mt-1">{last.content}</p>}
    </button>
  )
}

// ─── Détail + fil de discussion ────────────────────────────────────────────
function TicketDetail({ ticket, onUpdated }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/support/tickets/${ticket.id}/messages`)
      setMessages(data.messages)
    } catch (e) {
      setError(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [ticket.id])

  useEffect(() => {
    setLoading(true)
    load()
    const iv = setInterval(load, 8000)
    return () => clearInterval(iv)
  }, [load])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const send = async (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setError('')
    try {
      const msg = await api.post(`/admin/support/tickets/${ticket.id}/messages`, { content })
      setMessages((prev) => [...prev, msg])
      setText('')
      onUpdated()
    } catch (e2) {
      setError(e2.message || "Erreur d'envoi")
    } finally {
      setSending(false)
    }
  }

  const updateStatus = async (status) => {
    try {
      await api.put(`/admin/support/tickets/${ticket.id}`, { status })
      onUpdated()
    } catch {}
  }
  const assignToMe = async () => {
    try {
      await api.put(`/admin/support/tickets/${ticket.id}`, { assignedToId: user.id })
      onUpdated()
    } catch {}
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-syne font-bold text-[#0F1923] truncate flex items-center gap-2">
              {ticket.subject}
              {ticket.priority === 'PRIORITY' && <Crown size={14} className="text-amber-500 shrink-0" />}
            </p>
            <p className="font-dm text-xs text-[#0F1923]/50 mt-0.5">
              {ticket.user?.name} ({ticket.user?.email}) · {ticket.user?.role}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {!ticket.assignedTo && (
            <button onClick={assignToMe} className="flex items-center gap-1.5 font-syne text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-[#F0F2F5] text-[#0F1923]/60 hover:bg-[#1B4332]/8 transition-colors">
              <UserCheck size={12} /> M'assigner
            </button>
          )}
          {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
            <button onClick={() => updateStatus('RESOLVED')} className="flex items-center gap-1.5 font-syne text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
              <CheckCircle size={12} /> Marquer résolu
            </button>
          )}
          {ticket.status !== 'CLOSED' && (
            <button onClick={() => updateStatus('CLOSED')} className="flex items-center gap-1.5 font-syne text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              <XCircle size={12} /> Clôturer
            </button>
          )}
          {ticket.status === 'CLOSED' && (
            <button onClick={() => updateStatus('OPEN')} className="flex items-center gap-1.5 font-syne text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-[#F0F2F5] text-[#0F1923]/60 hover:bg-[#1B4332]/8 transition-colors">
              Rouvrir
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <p className="text-center font-dm text-sm text-[#0F1923]/40 mt-8">Chargement…</p>
        ) : messages.length === 0 ? (
          <p className="text-center font-dm text-sm text-[#0F1923]/40 mt-8">Aucun message.</p>
        ) : messages.map((m) => {
          const mine = m.senderId !== ticket.userId
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-[#1B4332] text-white' : 'bg-[#F0F2F5] text-[#0F1923]'}`}>
                <p className="font-dm text-sm whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`font-dm text-[10px] mt-1 ${mine ? 'text-white/60' : 'text-[#0F1923]/40'}`}>{fmtTime(m.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-5 pb-1 font-dm text-xs text-red-500">{error}</p>}

      {ticket.status === 'CLOSED' ? (
        <p className="px-5 py-3 border-t border-gray-100 font-dm text-xs text-[#0F1923]/40 text-center">Ce ticket est clôturé.</p>
      ) : (
        <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-gray-100">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={4000}
            placeholder="Répondre…"
            className="flex-1 bg-[#F0F2F5] rounded-full px-4 py-2.5 font-dm text-sm text-[#0F1923] placeholder-[#0F1923]/30 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20" />
          <button type="submit" disabled={sending || !text.trim()}
            className="p-2.5 rounded-full bg-[#1B4332] text-white disabled:opacity-40 hover:bg-[#153a29] transition-colors shrink-0">
            <Send size={16} />
          </button>
        </form>
      )}
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────
// Le badge "support prioritaire" CERTIFIÉ/PREMIUM était jusqu'ici une simple
// mention marketing sans file d'attente réelle côté équipe — cette file
// d'attente ADMIN/COMMERCIAL rend l'avantage concret : tri PRIORITY-first
// déjà appliqué côté serveur (cf. GET /admin/support/tickets), badge Crown
// pour repérer un ticket boutique CERTIFIÉE / livreur PREMIUM au premier
// coup d'œil.
export default function SupportAdminTab({ onBadgeUpdate }) {
  const [tickets, setTickets] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/admin/support/tickets${statusFilter ? `?status=${statusFilter}` : ''}`)
      setTickets(data)
      if (onBadgeUpdate) onBadgeUpdate(data.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length)
    } catch {} finally { setLoading(false) }
  }, [statusFilter, onBadgeUpdate])

  useEffect(() => {
    load()
    const iv = setInterval(load, 20000)
    return () => clearInterval(iv)
  }, [load])

  const selected = tickets.find(t => t.id === selectedId)

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-[#0F1923]/40">Administration</p>
        <h1 className="font-playfair text-3xl font-bold text-[#0F1923] flex items-center gap-2"><LifeBuoy size={26} /> Support</h1>
        <p className="font-dm text-sm text-[#0F1923]/50 mt-1">
          Tickets triés priorité d'abord — les boutiques CERTIFIÉES et livreurs PREMIUM remontent toujours en tête.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(s => (
          <button key={s || 'ALL'} onClick={() => setStatusFilter(s)}
            className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${statusFilter === s ? 'bg-[#1B4332] text-white' : 'bg-white border border-gray-200 text-[#0F1923]/50 hover:bg-gray-50'}`}>
            {s ? STATUS_META[s].label : 'Tous'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#52B788]/30 border-t-[#52B788] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex" style={{ minHeight: '32rem' }}>
          <div className="w-full sm:w-96 border-r border-gray-100 overflow-y-auto shrink-0">
            {tickets.length === 0 ? (
              <div className="p-8 text-center">
                <LifeBuoy size={32} className="mx-auto text-gray-200 mb-3" />
                <p className="font-dm text-sm text-gray-400">Aucun ticket.</p>
              </div>
            ) : tickets.map(t => (
              <TicketRow key={t.id} ticket={t} active={t.id === selectedId} onClick={() => setSelectedId(t.id)} />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            {selected ? (
              <TicketDetail ticket={selected} onUpdated={load} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="font-dm text-sm text-[#0F1923]/30">Sélectionnez un ticket</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
