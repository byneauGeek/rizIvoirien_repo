import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { CI_REGIONS } from '../../utils/regions'
import { VERIFICATION_LABEL } from './roleMeta'

const FIELDS = {
  PRODUCER: [
    { name: 'region', label: 'Région', required: true, regionInput: true },
    { name: 'department', label: 'Département' },
    { name: 'commune', label: 'Commune' },
    { name: 'locality', label: 'Localité' },
    { name: 'farmType', label: 'Type de production' },
    { name: 'surfaceHa', label: 'Superficie (ha)', type: 'number' },
    { name: 'capacityKg', label: 'Capacité (kg)', type: 'number' },
    { name: 'description', label: 'Description', textarea: true },
  ],
  COOPERATIVE: [
    { name: 'name', label: 'Nom de la coopérative', required: true },
    { name: 'responsable', label: 'Responsable', required: true },
    { name: 'region', label: 'Région', required: true, regionInput: true },
    { name: 'zone', label: "Zone d'activité" },
    { name: 'description', label: 'Description', textarea: true },
  ],
  TRADER: [
    { name: 'companyName', label: "Nom de l'entreprise", required: true },
    { name: 'activity', label: 'Activité' },
    { name: 'zones', label: 'Zones recherchées' },
  ],
  PROCESSOR: [
    { name: 'companyName', label: "Nom de l'entreprise", required: true },
    { name: 'zones', label: 'Zones recherchées' },
  ],
  EXPORTER: [
    { name: 'companyName', label: "Nom de l'entreprise", required: true },
    { name: 'capacityKg', label: "Capacité d'achat (kg)", type: 'number' },
    { name: 'zones', label: 'Zones recherchées' },
  ],
}

export default function ProfileTab() {
  const { user } = useAuth()
  const fields = FIELDS[user.role] || []
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [requestingVerif, setRequestingVerif] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/b2b/my-profile')
      setProfile(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const set = (field) => (e) => setProfile(p => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const data = {}
      for (const f of fields) data[f.name] = profile[f.name] ?? ''
      const updated = await api.put('/b2b/my-profile', data)
      setProfile(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
  if (error && !profile) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
        <AlertCircle size={14} className="text-red-500 shrink-0" />
        <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
        <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
      </div>
    )
  }

  const badge = VERIFICATION_LABEL[profile?.verification] || VERIFICATION_LABEL.UNVERIFIED

  const requestVerification = async () => {
    setRequestingVerif(true)
    setError(null)
    try {
      const updated = await api.post('/b2b/my-profile/request-verification')
      setProfile(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setRequestingVerif(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-playfair text-2xl font-bold text-charcoal">Mon profil</h1>
        <div className="flex items-center gap-2">
          <span className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full ${badge.color}`}>{badge.label}</span>
          {profile?.verification === 'UNVERIFIED' && (
            <button onClick={requestVerification} disabled={requestingVerif}
              className="font-syne text-xs font-bold text-forest hover:text-forest-dark disabled:opacity-50 underline">
              {requestingVerif ? '…' : 'Demander la vérification'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map(f => (
          <div key={f.name}>
            <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 block mb-1.5">
              {f.label}
            </label>
            {f.textarea ? (
              <textarea rows={3} value={profile?.[f.name] || ''} onChange={set(f.name)}
                className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm text-charcoal focus:outline-none focus:border-forest resize-none" />
            ) : (
              <input
                type={f.type || 'text'}
                required={f.required}
                list={f.regionInput ? 'regions' : undefined}
                value={profile?.[f.name] ?? ''}
                onChange={set(f.name)}
                className="w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3 font-dm text-charcoal focus:outline-none focus:border-forest"
              />
            )}
          </div>
        ))}
        <datalist id="regions">{CI_REGIONS.map(r => <option key={r} value={r} />)}</datalist>

        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-forest text-cream font-syne font-bold px-6 py-3 rounded-2xl hover:bg-forest-dark transition-colors disabled:opacity-50">
          {saved ? <><CheckCircle2 size={16} /> Enregistré</> : saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
