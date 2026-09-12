import { useState, useEffect, useCallback } from 'react'
import { LifeBuoy, ArrowLeft, Plus, Crown } from 'lucide-react'
import { api } from '../../api/client'
import SupportTicketThread from './SupportTicketThread'

const STATUS_META = {
  OPEN:        { label: 'Ouvert',    cls: 'bg-terra/10 text-terra' },
  IN_PROGRESS: { label: 'En cours',  cls: 'bg-amber-50 text-amber-700' },
  RESOLVED:    { label: 'Résolu',    cls: 'bg-forest/10 text-forest' },
  CLOSED:      { label: 'Clôturé',   cls: 'bg-charcoal/8 text-charcoal/40' },
}

function TicketRow({ ticket, active, onClick }) {
  const status = STATUS_META[ticket.status] || STATUS_META.OPEN
  const last = ticket.messages?.[0]
  return (
    <button onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-charcoal/6 transition-colors ${active ? 'bg-forest/8' : 'hover:bg-charcoal/3'}`}>
      <div className="w-10 h-10 rounded-full bg-forest/10 flex items-center justify-center shrink-0">
        <LifeBuoy size={16} className="text-forest" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-syne text-sm font-bold text-charcoal truncate">{ticket.subject}</p>
          {ticket.priority === 'PRIORITY' && <Crown size={13} className="text-amber-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={`font-dm text-[10px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
        </div>
        {last && <p className="font-dm text-xs text-charcoal/50 truncate mt-1">{last.content}</p>}
      </div>
    </button>
  )
}

function NewTicketForm({ onCreated, onCancel }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const ticket = await api.post('/support/tickets', { subject: subject.trim(), message: message.trim() })
      onCreated(ticket)
    } catch (e2) {
      setError(e2.message || "Erreur lors de l'ouverture du ticket")
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="p-4 space-y-3">
      <div>
        <label className="font-dm text-xs font-bold text-charcoal/60 block mb-1">Sujet</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200}
          placeholder="Résumez votre problème en quelques mots"
          className="w-full bg-charcoal/5 rounded-xl px-3 py-2.5 font-dm text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:ring-2 focus:ring-forest/30" />
      </div>
      <div>
        <label className="font-dm text-xs font-bold text-charcoal/60 block mb-1">Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} rows={5}
          placeholder="Décrivez votre problème en détail…"
          className="w-full bg-charcoal/5 rounded-xl px-3 py-2.5 font-dm text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:ring-2 focus:ring-forest/30 resize-none" />
      </div>
      {error && <p className="font-dm text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={sending || !subject.trim() || !message.trim()}
          className="flex-1 bg-forest text-cream rounded-xl py-2.5 font-syne text-sm font-bold disabled:opacity-40 hover:bg-forest-light transition-colors">
          {sending ? 'Envoi…' : 'Ouvrir le ticket'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 font-dm text-sm text-charcoal/50 hover:text-charcoal transition-colors">
          Annuler
        </button>
      </div>
    </form>
  )
}

// Panneau support prioritaire — même structure que MessagesPanel (liste +
// fil), réutilisable dans n'importe quel dashboard. Les boutiques CERTIFIÉES
// et livreurs PREMIUM voient leurs tickets marqués "PRIORITY" (figé à
// l'ouverture côté serveur, cf. supportPriority.js) et remontés en tête de
// file côté file d'attente admin — c'est ce badge qui rend réel l'avantage
// "support prioritaire" jusqu'ici purement marketing.
export default function SupportPanel({ className = '' }) {
  const [tickets, setTickets] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)

  const loadList = useCallback(async () => {
    try {
      const data = await api.get('/support/tickets')
      setTickets(data)
    } catch {
      // silencieux — réessai au prochain poll
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList()
    const iv = setInterval(loadList, 15000)
    return () => clearInterval(iv)
  }, [loadList])

  const selected = tickets.find((t) => t.id === selectedId)

  const handleCreated = (ticket) => {
    setShowNewForm(false)
    setSelectedId(ticket.id)
    loadList()
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex-1 bg-white rounded-3xl shadow-card overflow-hidden flex min-h-0">
        <div className={`w-full sm:w-80 border-r border-charcoal/8 overflow-y-auto shrink-0 flex flex-col ${(selectedId || showNewForm) ? 'hidden sm:flex' : ''}`}>
          <div className="p-3 border-b border-charcoal/8">
            <button onClick={() => setShowNewForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-forest/10 text-forest rounded-xl py-2.5 font-syne text-sm font-bold hover:bg-forest/15 transition-colors">
              <Plus size={16} /> Nouveau ticket
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-charcoal/5 rounded-2xl animate-pulse" />)}
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center">
                <LifeBuoy size={32} className="mx-auto text-charcoal/15 mb-3" />
                <p className="font-dm text-sm text-charcoal/40">Aucun ticket pour l'instant.</p>
              </div>
            ) : tickets.map((t) => (
              <TicketRow key={t.id} ticket={t} active={t.id === selectedId} onClick={() => { setSelectedId(t.id); setShowNewForm(false) }} />
            ))}
          </div>
        </div>

        <div className={`flex-1 min-w-0 flex-col ${(selectedId || showNewForm) ? 'flex' : 'hidden sm:flex'}`}>
          {showNewForm ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-charcoal/8">
                <button onClick={() => setShowNewForm(false)} className="sm:hidden p-1 -ml-1 text-charcoal/50">
                  <ArrowLeft size={18} />
                </button>
                <p className="font-syne text-sm font-bold text-charcoal">Nouveau ticket</p>
              </div>
              <NewTicketForm onCreated={handleCreated} onCancel={() => setShowNewForm(false)} />
            </>
          ) : selected ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-charcoal/8">
                <button onClick={() => setSelectedId(null)} className="sm:hidden p-1 -ml-1 text-charcoal/50">
                  <ArrowLeft size={18} />
                </button>
                <div className="w-8 h-8 rounded-full bg-forest/10 flex items-center justify-center shrink-0">
                  <LifeBuoy size={14} className="text-forest" />
                </div>
                <p className="font-syne text-sm font-bold text-charcoal truncate">{selected.subject}</p>
                {selected.priority === 'PRIORITY' && <Crown size={14} className="text-amber-500 shrink-0" />}
              </div>
              <SupportTicketThread ticketId={selectedId} closed={selected.status === 'CLOSED'} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="font-dm text-sm text-charcoal/30">Sélectionnez un ticket ou ouvrez-en un nouveau</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
