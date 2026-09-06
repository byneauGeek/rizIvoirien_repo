import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { fmtDate } from '../../utils/status'

export default function CommercialNotes({ entityType, entityId }) {
  const [notes, setNotes]     = useState([])
  const [fetching, setFetching] = useState(true)
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const endpoint = entityType === 'shop'
    ? `/commercial/shops/${entityId}/notes`
    : `/commercial/drivers/${entityId}/notes`

  useEffect(() => {
    setFetching(true)
    api.get(endpoint)
      .then(d => setNotes(d.notes || []))
      .catch(e => setError(e.message))
      .finally(() => setFetching(false))
  }, [endpoint])

  const submit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true); setError(null)
    try {
      const note = await api.post(endpoint, { content: input.trim() })
      setNotes(prev => [note, ...prev])
      setInput('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="font-syne text-sm font-bold text-charcoal/70 uppercase tracking-wider">Notes CRM</h4>

      {error && <p className="font-dm text-xs text-red-500 mb-2">{error}</p>}

      <form onSubmit={submit} className="flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ajouter une note…"
          rows={2}
          className="flex-1 font-dm text-sm bg-charcoal/5 border border-charcoal/15 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 resize-none placeholder:text-charcoal/30"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="self-end bg-indigo-600 text-white font-syne text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading ? '…' : 'Ajouter'}
        </button>
      </form>

      {fetching ? (
        <p className="font-dm text-sm text-charcoal/40 italic">Chargement…</p>
      ) : notes.length === 0 ? (
        <p className="font-dm text-sm text-charcoal/40 italic">Aucune note pour l'instant.</p>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {notes.map(n => (
            <div key={n.id} className="bg-charcoal/5 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-syne text-xs font-bold text-indigo-600">{n.author?.name ?? 'Inconnu'}</span>
                <span className="font-dm text-[11px] text-charcoal/40">{fmtDate(n.createdAt)}</span>
              </div>
              <p className="font-dm text-sm text-charcoal/80 whitespace-pre-wrap">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
