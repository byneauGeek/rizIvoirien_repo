import { useEffect, useState, useMemo } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  User, Phone, Mail, Car, CreditCard, Shield,
  Camera, Save, Loader2, CheckCircle, AlertCircle, X
} from 'lucide-react'
import ImageDropZone from '../../components/ui/ImageDropZone'

export default function ProfileTab() {
  const { user } = useAuth()
  const [driver, setDriver] = useState(null)
  const [loading, setLoading] = useState(true)
  // LOT 12 (Espace livreur) : catégories chargées depuis le catalogue
  // VehicleType administré (LOT4) — avant ce lot, une liste codée en dur ici
  // ne reflétait jamais ce qu'un admin ajoutait ou renommait.
  const [vehicleTypes, setVehicleTypes] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [form, setForm] = useState({
    vehicleType: '', vehiclePlate: '', vehiclePhoto: '',
    licenseNumber: '', licenseExpiry: '', licensePhoto: '',
    idNumber: '', idPhoto: '', avatar: '',
  })
  const [initialForm, setInitialForm] = useState(null)
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  const buildForm = (d) => ({
    vehicleType: d.vehicleType || '',
    vehiclePlate: d.vehiclePlate || '',
    vehiclePhoto: d.vehiclePhoto || '',
    licenseNumber: d.licenseNumber || '',
    licenseExpiry: d.licenseExpiry ? d.licenseExpiry.slice(0, 10) : '',
    licensePhoto: d.licensePhoto || '',
    idNumber: d.idNumber || '',
    idPhoto: d.idPhoto || '',
    avatar: d.avatar || '',
  })

  useEffect(() => {
    api.get('/drivers/vehicle-types').then(({ vehicleTypes }) => setVehicleTypes(vehicleTypes || [])).catch(() => {})
    api.get('/drivers/me').then(d => {
      setDriver(d)
      const f = buildForm(d)
      setForm(f)
      setInitialForm(f)
    }).finally(() => setLoading(false))
  }, [])

  const isDirty = useMemo(() => {
    if (!initialForm) return false
    return JSON.stringify(form) !== JSON.stringify(initialForm)
  }, [form, initialForm])

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await api.put('/drivers/profile', {
        ...form,
        licenseExpiry: form.licenseExpiry || null,
      })
      setDriver(updated)
      const f = buildForm(updated)
      setForm(f)
      setInitialForm(f)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { setSaveError(e.message || 'Erreur lors de la mise à jour') }
    finally { setSaving(false) }
  }

  const changePassword = async () => {
    if (pwForm.newPassword !== pwForm.confirm) return setPwMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas' })
    if (pwForm.newPassword.length < 6) return setPwMsg({ type: 'error', text: 'Minimum 6 caractères' })
    setPwLoading(true)
    setPwMsg(null)
    try {
      await api.put('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      setPwMsg({ type: 'success', text: 'Mot de passe mis à jour !' })
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (e) { setPwMsg({ type: 'error', text: e.message }) }
    finally { setPwLoading(false) }
  }

  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Livreur</p>
          <h1 className="font-playfair text-3xl font-bold text-charcoal">Mon profil</h1>
        </div>
        {driver && (
          <div className="flex items-center gap-2 mt-1">
            <span className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full ${
              driver.plan === 'PREMIUM' ? 'bg-safran/15 text-safran' : 'bg-charcoal/8 text-charcoal/50'
            }`}>
              {driver.plan || 'BASIC'}
            </span>
            <span className="font-dm text-xs text-charcoal/40">
              {driver.plan === 'PREMIUM' ? 'Commission majorée · Priorité haute' : 'Commission standard'}
            </span>
          </div>
        )}
      </div>

      {/* Avatar + identity */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <User size={16} className="text-forest" />
          <h2 className="font-syne font-bold text-charcoal">Identité</h2>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <ImageDropZone
            url={form.avatar}
            onUpload={url => setForm(p => ({ ...p, avatar: url }))}
            label="Photo de profil"
            hint="Visage visible"
            shape="round"
            aspect="h-20 w-20"
            accent="forest"
          />
          <div>
            <p className="font-syne text-sm font-bold text-charcoal">{user?.name}</p>
            <p className="font-dm text-xs text-charcoal/40 mt-0.5">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <LabelInput label="Nom complet" value={user?.name || ''} disabled />
          <LabelInput label="Email" value={user?.email || ''} disabled />
          <LabelInput label="Téléphone" value={user?.phone || ''} disabled />
          <LabelInput label="N° CNI" {...f('idNumber')} placeholder="CI-XXXX-XXXX" />
        </div>

        <div>
          <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1.5">
            Photo CNI
          </label>
          <ImageDropZone
            url={form.idPhoto}
            onUpload={url => setForm(p => ({ ...p, idPhoto: url }))}
            label="Déposer la photo CNI"
            hint="JPG, PNG · recto visible"
            accent="forest"
          />
        </div>
      </div>

      {/* Permis */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <CreditCard size={16} className="text-forest" />
          <h2 className="font-syne font-bold text-charcoal">Permis de conduire</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <LabelInput label="N° Permis" {...f('licenseNumber')} placeholder="PERM-XXXXX" />
          <div>
            <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1">
              Date d'expiration
            </label>
            <input type="date" {...f('licenseExpiry')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
          </div>
        </div>
        <div>
          <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1.5">
            Photo permis
          </label>
          <ImageDropZone
            url={form.licensePhoto}
            onUpload={url => setForm(p => ({ ...p, licensePhoto: url }))}
            label="Déposer la photo du permis"
            hint="JPG, PNG · lisible"
            accent="forest"
          />
        </div>
      </div>

      {/* Véhicule */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <Car size={16} className="text-forest" />
          <h2 className="font-syne font-bold text-charcoal">Véhicule</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1">
              Type de véhicule
            </label>
            <select value={form.vehicleType} onChange={e => setForm(p => ({ ...p, vehicleType: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-dm text-sm focus:outline-none focus:border-forest bg-white">
              <option value="">Sélectionner…</option>
              {/* Valeur existante conservée même si elle ne correspond plus à
                  une catégorie active (catégorie désactivée depuis, ancienne
                  saisie libre) — jamais silencieusement effacée. */}
              {form.vehicleType && !vehicleTypes.some(v => v.code === form.vehicleType) && (
                <option value={form.vehicleType}>{form.vehicleType}</option>
              )}
              {vehicleTypes.map(v => <option key={v.code} value={v.code}>{v.label}</option>)}
            </select>
          </div>
          <LabelInput label="Plaque d'immatriculation" {...f('vehiclePlate')} placeholder="AB-1234-CI" />
        </div>
        <div>
          <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1.5">
            Photo véhicule
          </label>
          <ImageDropZone
            url={form.vehiclePhoto}
            onUpload={url => setForm(p => ({ ...p, vehiclePhoto: url }))}
            label="Déposer la photo du véhicule"
            hint="JPG, PNG · plaque visible"
            accent="forest"
          />
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 font-dm text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Save button */}
      <button onClick={save} disabled={saving || !isDirty}
        className="w-full flex items-center justify-center gap-2 bg-forest text-white font-syne font-bold py-3.5 rounded-2xl hover:bg-forest-light transition-colors disabled:opacity-40">
        {saving
          ? <><Loader2 size={16} className="animate-spin" /> Enregistrement…</>
          : saved
          ? <><CheckCircle size={16} /> Profil mis à jour</>
          : <><Save size={16} /> {isDirty ? 'Enregistrer les modifications' : 'Aucune modification'}</>
        }
      </button>

      {/* Change password */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <Shield size={16} className="text-forest" />
          <h2 className="font-syne font-bold text-charcoal">Changer le mot de passe</h2>
        </div>
        <LabelInput label="Mot de passe actuel" type="password"
          value={pwForm.currentPassword} onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} />
        <div className="grid grid-cols-2 gap-4">
          <LabelInput label="Nouveau mot de passe" type="password"
            value={pwForm.newPassword} onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} />
          <LabelInput label="Confirmation" type="password"
            value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
        </div>
        {pwMsg && (
          <p className={`font-dm text-sm ${pwMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{pwMsg.text}</p>
        )}
        <button onClick={changePassword} disabled={pwLoading}
          className="flex items-center gap-2 bg-charcoal text-white font-syne text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-charcoal/80 transition-colors disabled:opacity-60">
          {pwLoading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
          Mettre à jour
        </button>
      </div>
    </div>
  )
}

function LabelInput({ label, type = 'text', disabled, ...props }) {
  return (
    <div>
      <label className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 block mb-1">{label}</label>
      <input type={type} disabled={disabled} {...props}
        className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 font-dm text-sm focus:outline-none focus:border-forest ${disabled ? 'bg-gray-50 text-charcoal/40' : 'bg-white'}`} />
    </div>
  )
}
