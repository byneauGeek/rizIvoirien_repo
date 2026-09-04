import { useEffect, useState } from 'react'
import { AlertCircle, ShieldCheck, Flag, BarChart2, Package, Check, X, Ban } from 'lucide-react'
import { api } from '../../api/client'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

const SUB_TABS = [
  { id: 'verifications', label: 'Vérifications', icon: ShieldCheck },
  { id: 'listings',      label: 'Annonces',       icon: Package },
  { id: 'reports',       label: 'Signalements',   icon: Flag },
  { id: 'stats',         label: 'Statistiques',   icon: BarChart2 },
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
    </div>
  )
}
