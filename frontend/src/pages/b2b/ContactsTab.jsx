import { useEffect, useState } from 'react'
import { AlertCircle, Check, X, Phone, Mail, MessageSquare, DollarSign } from 'lucide-react'
import { api } from '../../api/client'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

const STATUS_UI = {
  PENDING:  { label: 'En attente', color: 'text-amber-600 bg-amber-50' },
  ACCEPTED: { label: 'Accepté',    color: 'text-green-600 bg-green-50' },
  REJECTED: { label: 'Refusé',     color: 'text-red-500 bg-red-50' },
}

function DeclareTransactionForm({ contact, onDeclared }) {
  const listing = contact.offer || contact.request
  const [form, setForm] = useState({ quantity: listing?.quantity || '', amount: '', notes: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.quantity || Number(form.quantity) <= 0) return setError('Quantité invalide.')
    setSubmitting(true)
    try {
      await api.post('/b2b/transactions', {
        contactId: contact.id,
        quantity: Number(form.quantity),
        amount: form.amount ? Number(form.amount) : undefined,
        notes: form.notes || undefined,
      })
      onDeclared()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 bg-cream rounded-2xl p-4 space-y-3">
      {error && <p className="font-dm text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-syne text-[10px] font-bold uppercase text-charcoal/50 block mb-1">Quantité ({listing?.unit || 'tonne'})</label>
          <input type="number" min="0" step="0.1" value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            className="w-full bg-white border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm" />
        </div>
        <div>
          <label className="font-syne text-[10px] font-bold uppercase text-charcoal/50 block mb-1">Montant (FCFA, optionnel)</label>
          <input type="number" min="0" value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            className="w-full bg-white border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm" />
        </div>
      </div>
      <textarea rows={2} placeholder="Notes (optionnel)" value={form.notes}
        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        className="w-full bg-white border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm resize-none" />
      <button type="submit" disabled={submitting}
        className="bg-forest text-cream font-syne text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50">
        {submitting ? 'Déclaration…' : 'Déclarer la transaction'}
      </button>
    </form>
  )
}

export default function ContactsTab() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [declaringId, setDeclaringId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/b2b/contacts')
      setContacts(data.contacts || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const respond = async (id, action) => {
    setBusyId(id)
    try {
      await api.post(`/b2b/contacts/${id}/${action}`)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-playfair text-2xl font-bold text-charcoal">Mes contacts</h1>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <MessageSquare className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucun contact pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map(c => {
            const listing = c.offer || c.request
            const status = STATUS_UI[c.status] || STATUS_UI.PENDING
            return (
              <div key={c.id} className="bg-white border border-charcoal/10 rounded-2xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-syne font-bold text-charcoal text-sm">
                      {c.direction === 'SENT' ? 'Vous avez contacté' : 'Vous a contacté'} : {c.counterpart.name}
                    </p>
                    {listing && (
                      <p className="font-dm text-xs text-charcoal/40">
                        {listing.product} — {fmt(listing.quantity)} {listing.unit} · {listing.region}
                      </p>
                    )}
                  </div>
                  <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${status.color}`}>{status.label}</span>
                </div>

                {c.message && <p className="font-dm text-sm text-charcoal/60 mt-2 italic">"{c.message}"</p>}

                {c.status === 'ACCEPTED' && (
                  <div className="mt-3 flex flex-wrap gap-4">
                    {c.counterpart.phone && (
                      <a href={`tel:${c.counterpart.phone}`} className="flex items-center gap-1.5 font-dm text-sm text-forest">
                        <Phone size={13} /> {c.counterpart.phone}
                      </a>
                    )}
                    {c.counterpart.email && (
                      <a href={`mailto:${c.counterpart.email}`} className="flex items-center gap-1.5 font-dm text-sm text-forest">
                        <Mail size={13} /> {c.counterpart.email}
                      </a>
                    )}
                  </div>
                )}

                {c.direction === 'RECEIVED' && c.status === 'PENDING' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => respond(c.id, 'accept')} disabled={busyId === c.id}
                      className="flex items-center gap-1.5 bg-forest text-cream font-syne text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50">
                      <Check size={12} /> Accepter
                    </button>
                    <button onClick={() => respond(c.id, 'reject')} disabled={busyId === c.id}
                      className="flex items-center gap-1.5 bg-charcoal/5 text-charcoal/60 font-syne text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50">
                      <X size={12} /> Refuser
                    </button>
                  </div>
                )}

                {c.status === 'ACCEPTED' && !c.transaction && (
                  declaringId === c.id ? (
                    <DeclareTransactionForm contact={c} onDeclared={() => { setDeclaringId(null); load() }} />
                  ) : (
                    <button onClick={() => setDeclaringId(c.id)}
                      className="mt-3 flex items-center gap-1.5 font-syne text-xs font-bold text-forest hover:text-forest-dark">
                      <DollarSign size={13} /> Déclarer une transaction
                    </button>
                  )
                )}
                {c.transaction && (
                  <p className="mt-3 font-syne text-xs font-bold text-green-600">✓ Transaction déclarée</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
