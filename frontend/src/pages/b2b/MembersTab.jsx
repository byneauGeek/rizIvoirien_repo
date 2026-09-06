import { useEffect, useState } from 'react'
import { UserPlus, AlertCircle, Users, Search, ChevronDown, ChevronUp, Ban, RotateCcw, Trash2 } from 'lucide-react'
import { api } from '../../api/client'

// LOT AUDIT-ORG-02 (audit XXX RIZ) : gap confirmé — seuls list/add/suppression
// définitive existaient (aucune recherche, aucun filtre, aucune désactivation
// réversible, aucune fiche détail). Désactiver (PUT active:false) est
// désormais l'action principale — réversible, préserve joinedAt/historique —
// la suppression définitive (DELETE) reste disponible mais secondaire.
export default function MembersTab() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('') // '' = tous, 'true', 'false'
  const [expanded, setExpanded] = useState(null) // producerId
  const [detail, setDetail] = useState({}) // producerId -> fiche détail
  const [noteDraft, setNoteDraft] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (activeFilter) params.set('active', activeFilter)
      const data = await api.get(`/b2b/cooperative/members?${params}`)
      setMembers(data.members || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(load, 300) // debounce recherche
    return () => clearTimeout(t)
  }, [search, activeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const toggleActive = async (m) => {
    setBusyId(m.producer.id)
    try {
      await api.put(`/b2b/cooperative/members/${m.producer.id}`, { active: !m.active })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (producerId) => {
    if (!window.confirm('Suppression définitive de ce membre (pas juste une désactivation) — continuer ?')) return
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

  const toggleExpand = async (producerId) => {
    if (expanded === producerId) { setExpanded(null); return }
    setExpanded(producerId)
    if (!detail[producerId]) {
      try {
        const d = await api.get(`/b2b/cooperative/members/${producerId}`)
        setDetail(prev => ({ ...prev, [producerId]: d }))
        setNoteDraft(d.note || '')
      } catch { /* affichage silencieux — la ligne reste utilisable sans la fiche */ }
    } else {
      setNoteDraft(detail[producerId].note || '')
    }
  }

  const saveNote = async (producerId) => {
    try {
      const updated = await api.put(`/b2b/cooperative/members/${producerId}`, { note: noteDraft })
      setDetail(prev => ({ ...prev, [producerId]: { ...prev[producerId], note: updated.note } }))
      load()
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
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

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher (nom, région)…"
            className="w-full bg-white border-2 border-charcoal/10 rounded-xl pl-9 pr-3 py-2 font-dm text-sm" />
        </div>
        <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)}
          className="bg-white border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm">
          <option value="">Tous</option>
          <option value="true">Actifs</option>
          <option value="false">Désactivés</option>
        </select>
      </div>

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
          {members.map(m => {
            const isExpanded = expanded === m.producer.id
            const d = detail[m.producer.id]
            return (
              <div key={m.id} className={`bg-white border rounded-2xl overflow-hidden ${m.active ? 'border-charcoal/10' : 'border-charcoal/10 opacity-60'}`}>
                <button onClick={() => toggleExpand(m.producer.id)} className="w-full p-4 flex items-center justify-between text-left">
                  <div>
                    <p className="font-syne font-bold text-charcoal text-sm flex items-center gap-2">
                      {m.producer.user?.name}
                      {!m.active && <span className="font-syne text-[10px] font-bold text-charcoal/40 bg-charcoal/5 px-2 py-0.5 rounded-full">Désactivé</span>}
                    </p>
                    <p className="font-dm text-xs text-charcoal/40">{m.producer.region}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isExpanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-charcoal/6 pt-3 space-y-3">
                    {!d ? (
                      <p className="font-dm text-xs text-charcoal/40">Chargement de la fiche…</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm font-dm">
                        <p><span className="text-charcoal/40">Email :</span> {d.producer.user.email}</p>
                        <p><span className="text-charcoal/40">Téléphone :</span> {d.producer.user.phone || '—'}</p>
                        <p><span className="text-charcoal/40">Adhésion :</span> {new Date(d.joinedAt).toLocaleDateString('fr-FR')}</p>
                        <p><span className="text-charcoal/40">Vérification :</span> {d.producer.verification}</p>
                        {d.producer.farmType && <p><span className="text-charcoal/40">Type de production :</span> {d.producer.farmType}</p>}
                        {d.producer.surfaceHa && <p><span className="text-charcoal/40">Superficie :</span> {d.producer.surfaceHa} ha</p>}
                        {d.producer.capacityKg && <p><span className="text-charcoal/40">Capacité :</span> {d.producer.capacityKg} kg</p>}
                      </div>
                    )}
                    <div>
                      <label className="font-syne text-xs font-bold uppercase text-charcoal/40 block mb-1">Note interne (visible coopérative uniquement)</label>
                      <div className="flex gap-2">
                        <input value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                          className="flex-1 bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-xs" />
                        <button onClick={() => saveNote(m.producer.id)} className="font-syne text-xs font-bold text-forest px-3">Enregistrer</button>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => toggleActive(m)} disabled={busyId === m.producer.id}
                        className={`flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50 ${
                          m.active ? 'bg-charcoal/5 text-charcoal/60' : 'bg-green-50 text-green-700'
                        }`}>
                        {m.active ? <><Ban size={12} /> Désactiver</> : <><RotateCcw size={12} /> Réactiver</>}
                      </button>
                      <button onClick={() => remove(m.producer.id)} disabled={busyId === m.producer.id}
                        className="flex items-center gap-1.5 font-syne text-xs font-bold text-red-500 px-3 py-1.5 rounded-xl disabled:opacity-50">
                        <Trash2 size={12} /> Supprimer définitivement
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
