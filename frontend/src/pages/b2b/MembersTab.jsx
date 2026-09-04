import { useEffect, useState } from 'react'
import { UserPlus, X, AlertCircle, Users } from 'lucide-react'
import { api } from '../../api/client'

export default function MembersTab() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/b2b/cooperative/members')
      setMembers(data.members || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setAddError('')
    setAdding(true)
    try {
      await api.post('/b2b/cooperative/members', { producerEmail: email })
      setEmail('')
      load()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const remove = async (producerId) => {
    setBusyId(producerId)
    try {
      await api.delete(`/b2b/cooperative/members/${producerId}`)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="font-playfair text-2xl font-bold text-charcoal">Membres de la coopérative</h1>

      <form onSubmit={handleAdd} className="bg-white border-2 border-charcoal/10 rounded-2xl p-4 space-y-3">
        <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block">
          Associer un producteur (par email)
        </label>
        {addError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle size={13} className="text-red-500 shrink-0" />
            <p className="font-dm text-xs text-red-600">{addError}</p>
          </div>
        )}
        <div className="flex gap-2">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="producteur@exemple.ci"
            className="flex-1 bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-2.5 font-dm text-sm" />
          <button type="submit" disabled={adding}
            className="flex items-center gap-1.5 bg-forest text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-50">
            <UserPlus size={14} /> {adding ? '…' : 'Ajouter'}
          </button>
        </div>
        <p className="font-dm text-xs text-charcoal/40">Le producteur doit déjà avoir un compte producteur sur la plateforme.</p>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <Users className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucun membre pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="bg-white border border-charcoal/10 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-syne font-bold text-charcoal text-sm">{m.producer.user?.name}</p>
                <p className="font-dm text-xs text-charcoal/40">{m.producer.region}</p>
              </div>
              <button onClick={() => remove(m.producer.id)} disabled={busyId === m.producer.id}
                className="text-charcoal/30 hover:text-red-500 disabled:opacity-50">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
