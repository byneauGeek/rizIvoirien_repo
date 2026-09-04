import { useEffect, useState } from 'react'
import { AlertCircle, ShieldCheck, Flag, BarChart2, Package, Check, X, Ban, ListTree, Plus, Trash2 } from 'lucide-react'
import { api } from '../../api/client'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

const SUB_TABS = [
  { id: 'verifications', label: 'Vérifications', icon: ShieldCheck },
  { id: 'listings',      label: 'Annonces',       icon: Package },
  { id: 'reports',       label: 'Signalements',   icon: Flag },
  { id: 'stats',         label: 'Statistiques',   icon: BarChart2 },
  { id: 'reference',     label: 'Listes de référence', icon: ListTree },
]

function ErrorBanner({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
      <AlertCircle size={14} className="text-red-500 shrink-0" />
      <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
      {onRetry && <button onClick={onRetry} className="text-red-600 font-bold text-xs underline">Réessayer</button>}
    </div>
  )
}

function VerificationsPanel() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [filter, setFilter] = useState('PENDING')

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get(`/admin/b2b/verifications${filter ? `?status=${filter}` : ''}`)
      setProfiles(data.profiles || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (p, verification) => {
    const key = `${p.profileType}-${p.id}`
    setBusyKey(key)
    try {
      await api.put(`/admin/b2b/verifications/${p.profileType}/${p.id}`, { verification })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['PENDING', 'VERIFIED', 'SUSPENDED', ''].map(s => (
          <button key={s || 'all'} onClick={() => setFilter(s)}
            className={`font-syne text-xs font-bold px-3 py-1.5 rounded-xl ${filter === s ? 'bg-[#1B4332] text-white' : 'bg-white border border-charcoal/10 text-charcoal/50'}`}>
            {s || 'Tous'}
          </button>
        ))}
      </div>
      <ErrorBanner error={error} onRetry={load} />
      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-12 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <p className="font-dm text-charcoal/40">Aucun profil dans cette file.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map(p => {
            const key = `${p.profileType}-${p.id}`
            return (
              <div key={key} className="bg-white border border-charcoal/10 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-syne font-bold text-charcoal text-sm">{p.label} <span className="text-charcoal/30 font-normal">— {p.profileType}</span></p>
                  <p className="font-dm text-xs text-charcoal/40">{p.user.email} · {p.user.phone || 'pas de téléphone'} · statut : {p.verification}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStatus(p, 'VERIFIED')} disabled={busyKey === key}
                    className="flex items-center gap-1 bg-green-50 text-green-700 font-syne text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50">
                    <Check size={12} /> Vérifier
                  </button>
                  <button onClick={() => setStatus(p, 'REJECTED')} disabled={busyKey === key}
                    className="flex items-center gap-1 bg-charcoal/5 text-charcoal/60 font-syne text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50">
                    <X size={12} /> Refuser
                  </button>
                  <button onClick={() => setStatus(p, 'SUSPENDED')} disabled={busyKey === key}
                    className="flex items-center gap-1 bg-red-50 text-red-600 font-syne text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50">
                    <Ban size={12} /> Suspendre
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ListingsPanel() {
  const [data, setData] = useState({ offers: [], requests: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/b2b/listings')
      setData(res)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const moderate = async (item) => {
    setBusyId(item.id + item.listingType)
    try {
      const path = item.listingType === 'OFFER' ? `offers/${item.id}` : `requests/${item.id}`
      const status = item.listingType === 'OFFER' ? 'DISABLED' : 'CANCELLED'
      await api.put(`/admin/b2b/listings/${path}/moderate`, { status })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const all = [...data.offers, ...data.requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onRetry={load} />
      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : all.length === 0 ? (
        <div className="text-center py-12 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <p className="font-dm text-charcoal/40">Aucune annonce.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {all.map(item => (
            <div key={item.listingType + item.id} className="bg-white border border-charcoal/10 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-syne font-bold text-charcoal text-sm">
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded mr-2 ${item.listingType === 'OFFER' ? 'bg-forest/10 text-forest' : 'bg-blue-50 text-blue-600'}`}>
                    {item.listingType === 'OFFER' ? 'Offre' : 'Demande'}
                  </span>
                  {item.product} — {fmt(item.quantity)} {item.unit}
                </p>
                <p className="font-dm text-xs text-charcoal/40">{item.region} · statut : {item.status}</p>
              </div>
              {!['DISABLED', 'CANCELLED', 'SOLD', 'FULFILLED'].includes(item.status) && (
                <button onClick={() => moderate(item)} disabled={busyId === item.id + item.listingType}
                  className="font-syne text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50">
                  Désactiver
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportsPanel() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/b2b/reports')
      setReports(data.reports || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const setStatus = async (id, status) => {
    setBusyId(id)
    try {
      await api.put(`/admin/b2b/reports/${id}`, { status })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onRetry={load} />
      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <p className="font-dm text-charcoal/40">Aucun signalement.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="bg-white border border-charcoal/10 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-syne font-bold text-charcoal text-sm">{r.targetType} #{r.targetId} — {r.status}</p>
                <p className="font-dm text-xs text-charcoal/40">Par {r.reporter.name} : {r.reason}</p>
              </div>
              {r.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button onClick={() => setStatus(r.id, 'RESOLVED')} disabled={busyId === r.id}
                    className="font-syne text-xs font-bold text-green-600 disabled:opacity-50">Résoudre</button>
                  <button onClick={() => setStatus(r.id, 'REJECTED')} disabled={busyId === r.id}
                    className="font-syne text-xs font-bold text-charcoal/50 disabled:opacity-50">Rejeter</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatsPanel() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  const load = async () => {
    try {
      const data = await api.get('/admin/b2b/stats')
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { load() }, [])

  if (error) return <ErrorBanner error={error} onRetry={load} />
  if (!stats) return <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>

  const tiles = [
    { label: 'Producteurs', value: stats.usersByCategory.producers },
    { label: 'Coopératives', value: stats.usersByCategory.cooperatives },
    { label: 'Acheteurs', value: stats.usersByCategory.traders },
    { label: 'Transformateurs', value: stats.usersByCategory.processors },
    { label: 'Exportateurs', value: stats.usersByCategory.exporters },
    { label: 'Offres actives', value: stats.offersActive },
    { label: 'Demandes actives', value: stats.requestsActive },
    { label: 'Volume proposé (offres actives)', value: `${fmt(stats.volumeOfferedTotal)}` },
    { label: 'Mises en relation', value: stats.contactsTotal },
    { label: 'Contacts acceptés', value: stats.contactsAccepted },
    { label: 'Transactions déclarées', value: stats.transactionsDeclared },
    { label: 'Vérifications en attente', value: stats.pendingVerifications },
    { label: 'Signalements en attente', value: stats.reportsPending },
    { label: 'Annonces expirées', value: stats.offersExpired + stats.requestsExpired },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tiles.map(t => (
        <div key={t.label} className="bg-white border border-charcoal/10 rounded-2xl p-4">
          <p className="font-playfair text-2xl font-bold text-charcoal">{t.value}</p>
          <p className="font-dm text-xs text-charcoal/40">{t.label}</p>
        </div>
      ))}
    </div>
  )
}

const REF_TYPE_LABEL = { REGION: 'Régions', PRODUCT: 'Produits', UNIT: 'Unités' }

function ReferenceDataPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [newValue, setNewValue] = useState({ REGION: '', PRODUCT: '', UNIT: '' })
  const [addError, setAddError] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/b2b/reference-data')
      setItems(data.items || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const addItem = async (type) => {
    const value = newValue[type].trim()
    if (!value) return
    setAddError(null)
    try {
      await api.post('/admin/b2b/reference-data', { type, value })
      setNewValue(v => ({ ...v, [type]: '' }))
      load()
    } catch (err) {
      setAddError(err.message)
    }
  }

  const toggleActive = async (item) => {
    setBusyId(item.id)
    try {
      await api.put(`/admin/b2b/reference-data/${item.id}`, { active: !item.active })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (item) => {
    setBusyId(item.id)
    try {
      await api.delete(`/admin/b2b/reference-data/${item.id}`)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <ErrorBanner error={error} onRetry={load} />
      {addError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{addError}</p>
          <button onClick={() => setAddError(null)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}
      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(REF_TYPE_LABEL).map(([type, label]) => (
            <div key={type} className="bg-white border border-charcoal/10 rounded-2xl p-4">
              <h3 className="font-syne font-bold text-charcoal text-sm mb-3">{label}</h3>
              <div className="space-y-1.5 mb-3 max-h-64 overflow-y-auto">
                {items.filter(i => i.type === type).map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 bg-cream rounded-xl px-3 py-1.5">
                    <span className={`font-dm text-sm ${item.active ? 'text-charcoal' : 'text-charcoal/30 line-through'}`}>{item.value}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggleActive(item)} disabled={busyId === item.id}
                        className="font-syne text-[10px] font-bold text-charcoal/40 hover:text-charcoal disabled:opacity-50">
                        {item.active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button onClick={() => remove(item)} disabled={busyId === item.id}
                        className="text-charcoal/30 hover:text-red-500 disabled:opacity-50">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {items.filter(i => i.type === type).length === 0 && (
                  <p className="font-dm text-xs text-charcoal/30 italic">Aucune valeur</p>
                )}
              </div>
              <div className="flex gap-2">
                <input value={newValue[type]} onChange={e => setNewValue(v => ({ ...v, [type]: e.target.value }))}
                  placeholder="Nouvelle valeur"
                  className="flex-1 bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm min-w-0" />
                <button onClick={() => addItem(type)}
                  className="shrink-0 bg-forest text-cream rounded-xl px-2.5 flex items-center justify-center">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function B2BAdminTab() {
  const [sub, setSub] = useState('verifications')

  return (
    <div className="space-y-6">
      <h1 className="font-playfair text-2xl font-bold text-charcoal">Filière B2B</h1>
      <div className="flex gap-2 flex-wrap">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSub(id)}
            className={`flex items-center gap-1.5 font-syne text-sm font-bold px-4 py-2 rounded-xl transition-colors ${
              sub === id ? 'bg-[#1B4332] text-white' : 'bg-white border border-charcoal/10 text-charcoal/50'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {sub === 'verifications' && <VerificationsPanel />}
      {sub === 'listings' && <ListingsPanel />}
      {sub === 'reports' && <ReportsPanel />}
      {sub === 'stats' && <StatsPanel />}
      {sub === 'reference' && <ReferenceDataPanel />}
    </div>
  )
}
