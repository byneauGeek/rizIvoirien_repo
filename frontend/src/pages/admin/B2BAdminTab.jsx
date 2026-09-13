import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, ShieldCheck, Flag, BarChart2, Package, Check, X, Ban, ListTree, Plus, Trash2, Eye, Store, Users, Clock, FileText } from 'lucide-react'
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

// LOT AUDIT-B2B-04 (audit XXX RIZ) : gap confirmé — la liste n'exposait que
// user{name,email,phone}, aucun contexte Shop (produits, commandes, note),
// aucun historique. Fiche complète chargée à la demande (GET .../:type/:id).
const PROFILE_FIELD_LABELS = {
  region: 'Région', department: 'Département', commune: 'Commune', locality: 'Localité',
  farmType: 'Type de production', surfaceHa: 'Superficie (ha)', capacityKg: 'Capacité (kg)',
  description: 'Description', name: 'Nom', responsable: 'Responsable', zone: "Zone d'activité",
  companyName: "Nom de l'entreprise", activity: 'Activité', zones: 'Zones recherchées',
}

function ProfileDetailModal({ profileType, id, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get(`/admin/b2b/verifications/${profileType}/${id}`)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [profileType, id])

  const { profile, shop, members, history } = data || {}

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal/6 sticky top-0 bg-white z-10">
          <div>
            <p className="text-xs text-charcoal/40 font-medium">{profileType} #{id}</p>
            <h3 className="font-bold text-charcoal">Fiche candidature B2B</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-charcoal/8 rounded-lg transition-colors">
            <X size={18} className="text-charcoal/50" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <p className="text-center text-charcoal/40 py-8">Chargement…</p>
          ) : error ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : (
            <>
              {/* Informations générales */}
              <section>
                <h4 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-2">Informations générales</h4>
                <div className="bg-charcoal/3 rounded-xl p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <p><span className="text-charcoal/40">Nom / email :</span> {profile.user.name} · {profile.user.email}</p>
                  <p><span className="text-charcoal/40">Téléphone :</span> {profile.user.phone || '—'}</p>
                  <p><span className="text-charcoal/40">Compte créé le :</span> {new Date(profile.user.createdAt).toLocaleDateString('fr-FR')}</p>
                  <p><span className="text-charcoal/40">Compte banni :</span> {profile.user.banned ? 'Oui' : 'Non'}</p>
                  <p><span className="text-charcoal/40">Statut B2B :</span> {profile.verification}</p>
                  {profile.rejectionReason && <p className="col-span-2 text-red-600"><span className="text-charcoal/40">Motif refus :</span> {profile.rejectionReason}</p>}
                </div>
              </section>

              {/* Informations professionnelles */}
              <section>
                <h4 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-2">Informations professionnelles déclarées</h4>
                <div className="bg-charcoal/3 rounded-xl p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {Object.entries(PROFILE_FIELD_LABELS)
                    .filter(([field]) => profile[field] !== undefined && profile[field] !== null && profile[field] !== '')
                    .map(([field, label]) => (
                      <p key={field}><span className="text-charcoal/40">{label} :</span> {String(profile[field])}</p>
                    ))}
                </div>
              </section>

              {/* Documents */}
              <section>
                <h4 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-2 flex items-center gap-1.5"><FileText size={13} /> Documents</h4>
                {profile.documentUrl ? (
                  <a href={profile.documentUrl} target="_blank" rel="noreferrer" className="block">
                    <img src={profile.documentUrl} alt="Pièce justificative" className="max-h-64 rounded-xl border border-charcoal/10" loading="lazy" />
                  </a>
                ) : (
                  <p className="text-sm text-red-500">Aucune pièce justificative fournie</p>
                )}
              </section>

              {/* Activité boutique */}
              <section>
                <h4 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-2 flex items-center gap-1.5"><Store size={13} /> Boutique associée</h4>
                {shop ? (
                  <div className="bg-charcoal/3 rounded-xl p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <p><span className="text-charcoal/40">Nom :</span> {shop.name}{shop.businessName ? ` (${shop.businessName})` : ''}</p>
                    <p><span className="text-charcoal/40">Statut :</span> {shop.status} {shop.active ? '· actif' : '· inactif'}</p>
                    <p><span className="text-charcoal/40">Plan :</span> {shop.plan} {shop.certified ? '· certifié' : ''}</p>
                    <p><span className="text-charcoal/40">Note :</span> {shop.rating}/5 ({shop.reviewCount} avis)</p>
                    <p><span className="text-charcoal/40">Produits :</span> {shop._count.products}</p>
                    <p><span className="text-charcoal/40">Commandes :</span> {shop._count.orders}</p>
                    <p className="col-span-2"><span className="text-charcoal/40">Localisation :</span> {shop.location || '—'}</p>
                  </div>
                ) : (
                  <p className="text-sm text-charcoal/40">Ce compte n'a pas de boutique B2C (pas SELLER, ou boutique jamais créée).</p>
                )}
              </section>

              {/* Membres (coopérative uniquement) */}
              {profileType === 'COOPERATIVE' && (
                <section>
                  <h4 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-2 flex items-center gap-1.5"><Users size={13} /> Membres ({members?.length || 0})</h4>
                  {members?.length ? (
                    <div className="space-y-1.5">
                      {members.map(m => (
                        <div key={m.id} className="bg-charcoal/3 rounded-xl px-4 py-2 text-sm flex items-center justify-between">
                          <span>{m.producer.user.name} — {m.producer.region}</span>
                          <span className="text-xs text-charcoal/40">{m.producer.verification}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-charcoal/40">Aucun membre enregistré.</p>
                  )}
                </section>
              )}

              {/* Historique */}
              <section>
                <h4 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-2 flex items-center gap-1.5"><Clock size={13} /> Historique des décisions</h4>
                {history?.length ? (
                  <div className="space-y-1.5">
                    {history.map(h => {
                      let details = {}
                      try { details = JSON.parse(h.details || '{}') } catch { /* ignore */ }
                      return (
                        <div key={h.id} className="bg-charcoal/3 rounded-xl px-4 py-2 text-sm flex items-center justify-between">
                          <span>{details.verification || '—'} par {h.adminName || `admin #${h.adminId}`}</span>
                          <span className="text-xs text-charcoal/40">{new Date(h.createdAt).toLocaleString('fr-FR')}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-charcoal/40">Aucune décision passée.</p>
                )}
              </section>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function VerificationsPanel() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [filter, setFilter] = useState('PENDING')
  const [detail, setDetail] = useState(null) // { profileType, id } | null

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
    // LOT AUDIT-B2B-03 (audit XXX RIZ) : un refus sans motif était indiscernable
    // d'un abandon de candidature pour le titulaire — demande le motif ici,
    // seul point d'entrée réel de cette décision côté admin.
    let reason
    if (verification === 'REJECTED') {
      reason = window.prompt('Motif du refus (affiché au candidat) :')
      if (reason === null) return // annulé
    }
    const key = `${p.profileType}-${p.id}`
    setBusyKey(key)
    try {
      await api.put(`/admin/b2b/verifications/${p.profileType}/${p.id}`, { verification, reason })
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
                  {/* LOT AUDIT-G13 (audit XXX RIZ) : gap confirmé — l'admin décidait sans jamais voir aucune pièce justificative */}
                  {p.documentUrl ? (
                    <a href={p.documentUrl} target="_blank" rel="noreferrer"
                      className="font-syne text-xs font-bold text-forest hover:underline">Voir la pièce justificative</a>
                  ) : (
                    <p className="font-dm text-xs text-red-500">Aucune pièce justificative fournie</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDetail({ profileType: p.profileType, id: p.id })}
                    className="flex items-center gap-1 bg-charcoal/5 text-charcoal font-syne text-xs font-bold px-3 py-1.5 rounded-xl">
                    <Eye size={12} /> Voir la fiche
                  </button>
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

      {detail && (
        <ProfileDetailModal profileType={detail.profileType} id={detail.id} onClose={() => setDetail(null)} />
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
