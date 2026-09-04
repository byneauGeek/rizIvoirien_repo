import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  Check, Navigation, MapPin, Store, Phone, Mail,
  Clock, Package, Truck, Star, Shield, Loader2,
  ToggleLeft, ToggleRight, ChevronDown, AlertCircle, X
} from 'lucide-react'
import ImageDropZone from '../../components/ui/ImageDropZone'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const SECTION_TABS = [
  { id: 'identity',    label: 'Identité',         icon: Store },
  { id: 'contact',     label: 'Contact & Localisation', icon: MapPin },
  { id: 'operational', label: 'Opérationnel',      icon: Clock },
  { id: 'subscription', label: 'Abonnement',       icon: Star },
  { id: 'security',    label: 'Sécurité',          icon: Shield },
]

function Field({ label, note, children }) {
  return (
    <div>
      <label className="font-syne text-xs font-bold uppercase tracking-wider text-[#0F1923]/40 block mb-1.5">{label}</label>
      {children}
      {note && <p className="font-dm text-xs text-[#0F1923]/35 mt-1">{note}</p>}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text', required, disabled }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled}
      className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-[#52B788] transition-colors ${disabled ? 'bg-gray-50 text-[#0F1923]/40' : 'bg-white'}`} />
  )
}

export default function ShopSettingsTab({ onShopUpdated }) {
  const { user, updateUser } = useAuth()
  const [section, setSection] = useState('identity')
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    // Identity
    name: '', businessName: '', rccm: '', description: '', speciality: '', since: '',
    coverImage: '', avatar: '',
    // Contact
    phone: '', email: '', location: '', latitude: '', longitude: '', deliveryZones: '',
    // Operational
    minOrder: '', preparationTime: '', openingHours: '', paused: false, pauseNote: '',
    notifyEmail: true, notifyLowStock: true,
  })

  const [geolocating, setGeolocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [certifying, setCertifying] = useState(false)
  const [shopError, setShopError] = useState(null)
  const [geoError, setGeoError] = useState(null)
  const [certifyConfirm, setCertifyConfirm] = useState(false)

  // Security
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)
  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' })
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMsg, setEmailMsg] = useState(null)

  useEffect(() => {
    api.get('/shops/my/dashboard').then(data => {
      const s = data.shop
      setShop(s)
      if (s) setForm({
        name: s.name || '',
        businessName: s.businessName || '',
        rccm: s.rccm || '',
        description: s.description || '',
        speciality: s.speciality || '',
        since: s.since || '',
        coverImage: s.coverImage || '',
        avatar: s.avatar || '',
        phone: s.phone || '',
        email: s.email || '',
        location: s.location || '',
        latitude: s.latitude != null ? String(s.latitude) : '',
        longitude: s.longitude != null ? String(s.longitude) : '',
        deliveryZones: s.deliveryZones || '',
        minOrder: s.minOrder != null ? String(s.minOrder) : '0',
        preparationTime: s.preparationTime != null ? String(s.preparationTime) : '30',
        openingHours: s.openingHours || '',
        paused: s.paused || false,
        pauseNote: s.pauseNote || '',
        notifyEmail: s.notifyEmail !== false,
        notifyLowStock: s.notifyLowStock !== false,
      })
    }).finally(() => setLoading(false))
  }, [])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const setB = (k) => () => setForm(f => ({ ...f, [k]: !f[k] }))

  const handleSave = async (e) => {
    e?.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        latitude: form.latitude !== '' ? parseFloat(form.latitude) : null,
        longitude: form.longitude !== '' ? parseFloat(form.longitude) : null,
        minOrder: Number(form.minOrder) || 0,
        preparationTime: Number(form.preparationTime) || 30,
      }
      const updated = await api.put('/shops/my', payload)
      setShop(updated)
      if (updateUser) updateUser({ shop: { ...user?.shop, ...updated } })
      if (onShopUpdated) onShopUpdated(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) { setShopError(err.message || 'Erreur lors de la sauvegarde') }
    finally { setSaving(false) }
  }

  const handleGeolocate = () => {
    if (!navigator.geolocation) { setGeoError('Géolocalisation non supportée par ce navigateur'); return }
    setGeolocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm(f => ({ ...f, latitude: String(coords.latitude.toFixed(6)), longitude: String(coords.longitude.toFixed(6)) }))
        setGeolocating(false)
      },
      () => { setGeoError("Impossible d'obtenir la position"); setGeolocating(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleCertify = async () => {
    if (!certifyConfirm) { setCertifyConfirm(true); return }
    setCertifyConfirm(false)
    setCertifying(true)
    try {
      const updated = await api.post('/shops/my/certify', {})
      setShop(s => ({ ...s, ...updated }))
      if (updateUser) updateUser({ shop: { ...user?.shop, certified: true, plan: 'CERTIFIED' } })
    } catch (err) { setShopError(err.message || 'Erreur lors de la certification') }
    finally { setCertifying(false) }
  }

  const changePassword = async () => {
    if (pwForm.newPassword !== pwForm.confirm) return setPwMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas' })
    if (pwForm.newPassword.length < 6) return setPwMsg({ type: 'error', text: 'Minimum 6 caractères' })
    setPwLoading(true); setPwMsg(null)
    try {
      await api.put('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      setPwMsg({ type: 'success', text: 'Mot de passe mis à jour !' })
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (e) { setPwMsg({ type: 'error', text: e.message }) }
    finally { setPwLoading(false) }
  }

  const changeEmail = async () => {
    setEmailLoading(true); setEmailMsg(null)
    try {
      await api.put('/auth/change-email', emailForm)
      setEmailMsg({ type: 'success', text: 'Email mis à jour ! Reconnectez-vous.' })
      setEmailForm({ newEmail: '', password: '' })
    } catch (e) { setEmailMsg({ type: 'error', text: e.message }) }
    finally { setEmailLoading(false) }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-[#52B788]/30 border-t-[#52B788] rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-[#0F1923]/40">Configuration</p>
        <h1 className="font-playfair text-3xl font-bold text-[#0F1923]">Ma boutique</h1>
      </div>

      {shopError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 font-dm text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{shopError}</span>
          <button type="button" onClick={() => setShopError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Section nav */}
      <div className="flex gap-2 flex-wrap">
        {SECTION_TABS.map(t => {
          const Icon = t.icon
          const active = section === t.id
          return (
            <button key={t.id} onClick={() => setSection(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-syne text-sm font-bold transition-all ${
                active ? 'bg-[#1B4332] text-white shadow-sm' : 'bg-white text-[#0F1923]/50 hover:bg-gray-50 border border-gray-100'
              }`}>
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── IDENTITÉ ── */}
      {section === 'identity' && (
        <form onSubmit={handleSave} className="space-y-5">
          <Card title="Identité de la boutique" icon={<Store size={15} className="text-[#52B788]" />}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nom de la boutique" note="Visible par tous les acheteurs">
                <TextInput value={form.name} onChange={set('name')} required />
              </Field>
              <Field label="Raison sociale">
                <TextInput value={form.businessName} onChange={set('businessName')} placeholder="SARL Riz du Bandama…" />
              </Field>
              <Field label="N° RCCM">
                <TextInput value={form.rccm} onChange={set('rccm')} placeholder="CI-ABJ-XXXX-XXXX" />
              </Field>
              <Field label="Spécialité">
                <TextInput value={form.speciality} onChange={set('speciality')} placeholder="Riz parfumé, gros grains…" />
              </Field>
              <Field label="Année de création">
                <TextInput value={form.since} onChange={set('since')} placeholder="2020" />
              </Field>
            </div>
            <Field label="Description">
              <textarea value={form.description} onChange={set('description')} rows={4} placeholder="Présentez votre boutique…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-[#52B788] resize-none" />
            </Field>
          </Card>

          <Card title="Visuels" icon={<Star size={15} className="text-[#52B788]" />}>
            <Field label="Logo / Avatar" note="Format carré recommandé (200×200px)">
              <div className="flex items-start gap-4">
                <ImageDropZone
                  url={form.avatar}
                  onUpload={v => set('avatar')(v)}
                  label="Logo de la boutique"
                  hint="JPG, PNG · carré"
                  shape="round"
                  aspect="h-24 w-24"
                  accent="forest"
                />
                <p className="font-dm text-xs text-charcoal/40 mt-2 leading-relaxed">
                  Glissez votre logo ici ou cliquez pour parcourir.<br />Format carré 200×200 px recommandé.
                </p>
              </div>
            </Field>
            <Field label="Image de couverture" note="Format 16/9 recommandé (1200×400px)">
              <ImageDropZone
                url={form.coverImage}
                onUpload={v => set('coverImage')(v)}
                label="Image de couverture"
                hint="JPG, PNG · 1200×400 px recommandé"
                aspect="h-36"
                accent="forest"
              />
            </Field>
          </Card>

          <SaveBtn saving={saving} saved={saved} />
        </form>
      )}

      {/* ── CONTACT & LOCALISATION ── */}
      {section === 'contact' && (
        <form onSubmit={handleSave} className="space-y-5">
          <Card title="Coordonnées" icon={<Phone size={15} className="text-[#52B788]" />}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Téléphone boutique">
                <TextInput value={form.phone} onChange={set('phone')} placeholder="+225 07 00 00 00 00" />
              </Field>
              <Field label="Email boutique">
                <TextInput type="email" value={form.email} onChange={set('email')} placeholder="boutique@exemple.ci" />
              </Field>
            </div>
          </Card>

          <Card title="Localisation & GPS" icon={<MapPin size={15} className="text-[#52B788]" />}>
            <p className="font-dm text-sm text-[#0F1923]/50 -mt-1 mb-4">
              Les coordonnées GPS permettent de calculer automatiquement les frais de livraison par la distance réelle.
            </p>
            <Field label="Adresse / Localisation">
              <TextInput value={form.location} onChange={set('location')} placeholder="Ex: Cocody, Abidjan" />
            </Field>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-syne text-xs font-bold uppercase tracking-wider text-[#0F1923]/40">Coordonnées GPS</label>
                <button type="button" onClick={handleGeolocate} disabled={geolocating}
                  className="flex items-center gap-1.5 font-syne text-xs font-bold text-[#52B788] border border-[#52B788]/30 px-3 py-1.5 rounded-full hover:bg-[#52B788]/8 transition-colors disabled:opacity-50">
                  {geolocating
                    ? <div className="w-3 h-3 border border-[#52B788]/30 border-t-[#52B788] rounded-full animate-spin" />
                    : <Navigation size={11} />}
                  {geolocating ? 'Localisation…' : 'Me géolocaliser'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-dm text-xs text-[#0F1923]/40 block mb-1">Latitude</label>
                  <TextInput type="number" value={form.latitude} onChange={set('latitude')} placeholder="5.3600" />
                </div>
                <div>
                  <label className="font-dm text-xs text-[#0F1923]/40 block mb-1">Longitude</label>
                  <TextInput type="number" value={form.longitude} onChange={set('longitude')} placeholder="-3.9969" />
                </div>
              </div>
              {form.latitude && form.longitude
                ? <div className="mt-2 flex items-center gap-2 text-xs text-green-600 font-dm">
                    <MapPin size={12} /> Position: {parseFloat(form.latitude).toFixed(4)}, {parseFloat(form.longitude).toFixed(4)}
                  </div>
                : <p className="mt-2 font-dm text-xs text-[#0F1923]/35">Sans GPS, les frais seront calculés au poids uniquement.</p>
              }
              {geoError && (
                <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 font-dm text-xs">
                  <AlertCircle size={13} className="shrink-0" />
                  <span className="flex-1">{geoError}</span>
                  <button type="button" onClick={() => setGeoError(null)}><X size={12} /></button>
                </div>
              )}
            </div>
            <Field label="Zones de livraison" note="Séparées par des virgules : Cocody, Plateau, Yopougon…">
              <TextInput value={form.deliveryZones} onChange={set('deliveryZones')} placeholder="Cocody, Plateau, Marcory" />
            </Field>
          </Card>

          <SaveBtn saving={saving} saved={saved} />
        </form>
      )}

      {/* ── OPÉRATIONNEL ── */}
      {section === 'operational' && (
        <form onSubmit={handleSave} className="space-y-5">
          <Card title="Paramètres de commande" icon={<Package size={15} className="text-[#52B788]" />}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Commande minimum (FCFA)">
                <TextInput type="number" value={form.minOrder} onChange={set('minOrder')} placeholder="5000" />
              </Field>
              <Field label="Temps de préparation (minutes)">
                <TextInput type="number" value={form.preparationTime} onChange={set('preparationTime')} placeholder="30" />
              </Field>
            </div>
          </Card>

          <Card title="Horaires d'ouverture" icon={<Clock size={15} className="text-[#52B788]" />}>
            <Field label="Horaires (texte libre)" note="Ex: Lun-Sam 8h–18h, Dim fermé">
              <TextInput value={form.openingHours} onChange={set('openingHours')} placeholder="Lun–Ven 8h–18h, Sam 9h–14h" />
            </Field>
          </Card>

          <Card title="Notifications" icon={<Truck size={15} className="text-[#52B788]" />}>
            <ToggleRow label="Notifications par email" sub="Recevoir les nouvelles commandes par email"
              value={form.notifyEmail} onToggle={setB('notifyEmail')} />
            <ToggleRow label="Alertes stock bas" sub="Être notifié quand un produit a moins de 10 unités"
              value={form.notifyLowStock} onToggle={setB('notifyLowStock')} />
          </Card>

          <Card title="Mode pause" icon={<Clock size={15} className="text-[#52B788]" />}>
            <ToggleRow
              label="Mettre la boutique en pause"
              sub="La boutique n'acceptera plus de nouvelles commandes"
              value={form.paused} onToggle={setB('paused')}
              danger />
            {form.paused && (
              <Field label="Motif de la pause (affiché aux clients)">
                <TextInput value={form.pauseNote} onChange={set('pauseNote')} placeholder="Vacances, réapprovisionnement…" />
              </Field>
            )}
          </Card>

          <SaveBtn saving={saving} saved={saved} />
        </form>
      )}

      {/* ── ABONNEMENT ── */}
      {section === 'subscription' && (
        <div className="space-y-5">
          <div className={`rounded-3xl p-7 ${shop?.certified ? 'bg-[#1B4332]' : 'bg-white border border-gray-100'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`font-syne text-xs font-bold uppercase tracking-widest mb-1 ${shop?.certified ? 'text-white/40' : 'text-[#0F1923]/40'}`}>
                  Plan actuel
                </p>
                <p className={`font-playfair text-3xl font-bold ${shop?.certified ? 'text-[#E8A217]' : 'text-[#0F1923]'}`}>
                  {shop?.certified ? '✓ Certifié' : 'Basic — Gratuit'}
                </p>
                <p className={`font-dm text-sm mt-2 leading-relaxed ${shop?.certified ? 'text-white/55' : 'text-[#0F1923]/50'}`}>
                  {shop?.certified
                    ? 'Badge ✓ Certifié, priorité dans les résultats de recherche, statistiques avancées.'
                    : 'Boutique active, produits illimités. Sans badge de confiance.'}
                </p>
              </div>
              {!shop?.certified && (
                certifyConfirm ? (
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <span className="font-dm text-xs text-[#0F1923]/60">150 000 FCFA/an. Confirmer ?</span>
                    <button onClick={handleCertify} disabled={certifying}
                      className="bg-[#E8A217] text-white font-syne font-bold text-xs px-3 py-2 rounded-xl hover:bg-[#d4920f] transition-colors disabled:opacity-60">
                      Oui
                    </button>
                    <button onClick={() => setCertifyConfirm(false)}
                      className="border border-[#0F1923]/15 font-syne text-xs text-[#0F1923]/50 px-3 py-2 rounded-xl hover:border-[#0F1923]/30 transition-colors">
                      Non
                    </button>
                  </div>
                ) : (
                  <button onClick={handleCertify} disabled={certifying}
                    className="bg-[#E8A217] text-white font-syne font-bold text-sm px-5 py-3 rounded-xl hover:bg-[#d4920f] transition-colors disabled:opacity-60 shrink-0 ml-4">
                    {certifying ? <Loader2 size={15} className="animate-spin" /> : 'Passer Certifié'}
                  </button>
                )
              )}
            </div>
          </div>

          {!shop?.certified && (
            <Card title="Avantages du plan Certifié" icon={<Star size={15} className="text-[#E8A217]" />}>
              <ul className="space-y-3">
                {[
                  'Badge ✓ Certifié visible sur votre boutique',
                  'Mise en avant dans les résultats de recherche',
                  'Position prioritaire dans le carousel homepage',
                  'Statistiques de ventes détaillées',
                  'Support prioritaire 7j/7',
                  '150 000 FCFA / an',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check size={14} className="text-[#52B788] shrink-0" />
                    <span className="font-dm text-sm text-[#0F1923]">{f}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* ── SÉCURITÉ ── */}
      {section === 'security' && (
        <div className="space-y-5">
          <Card title="Changer le mot de passe" icon={<Shield size={15} className="text-[#52B788]" />}>
            <div className="space-y-4">
              <Field label="Mot de passe actuel">
                <TextInput type="password" value={pwForm.currentPassword}
                  onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nouveau mot de passe">
                  <TextInput type="password" value={pwForm.newPassword}
                    onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} />
                </Field>
                <Field label="Confirmation">
                  <TextInput type="password" value={pwForm.confirm}
                    onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
                </Field>
              </div>
              {pwMsg && <p className={`font-dm text-sm ${pwMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{pwMsg.text}</p>}
              <button onClick={changePassword} disabled={pwLoading}
                className="flex items-center gap-2 bg-[#0F1923] text-white font-syne text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#1a2c3d] transition-colors disabled:opacity-60">
                {pwLoading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                Mettre à jour le mot de passe
              </button>
            </div>
          </Card>

          <Card title="Changer l'adresse email" icon={<Mail size={15} className="text-[#52B788]" />}>
            <div className="space-y-4">
              <Field label="Email actuel">
                <TextInput value={user?.email || ''} disabled />
              </Field>
              <Field label="Nouvel email">
                <TextInput type="email" value={emailForm.newEmail}
                  onChange={e => setEmailForm(p => ({ ...p, newEmail: e.target.value }))} placeholder="nouveau@exemple.ci" />
              </Field>
              <Field label="Mot de passe (confirmation)">
                <TextInput type="password" value={emailForm.password}
                  onChange={e => setEmailForm(p => ({ ...p, password: e.target.value }))} />
              </Field>
              {emailMsg && <p className={`font-dm text-sm ${emailMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{emailMsg.text}</p>}
              <button onClick={changeEmail} disabled={emailLoading}
                className="flex items-center gap-2 bg-[#0F1923] text-white font-syne text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#1a2c3d] transition-colors disabled:opacity-60">
                {emailLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Changer l'email
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function Card({ title, icon, children }) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
      <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
        {icon}
        <h2 className="font-syne font-bold text-[#0F1923]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function ToggleRow({ label, sub, value, onToggle, danger = false }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className={`font-syne text-sm font-bold ${danger && value ? 'text-orange-600' : 'text-[#0F1923]'}`}>{label}</p>
        {sub && <p className="font-dm text-xs text-[#0F1923]/40 mt-0.5">{sub}</p>}
      </div>
      <button type="button" onClick={onToggle}
        className={`transition-colors ${value ? (danger ? 'text-orange-500' : 'text-[#52B788]') : 'text-gray-300'}`}>
        {value ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
      </button>
    </div>
  )
}

function SaveBtn({ saving, saved }) {
  return (
    <button type="submit" disabled={saving}
      className={`flex items-center gap-2 font-syne font-bold text-sm px-8 py-3 rounded-2xl transition-all disabled:opacity-60 ${
        saved ? 'bg-green-500 text-white' : 'bg-[#1B4332] text-white hover:bg-[#246043]'
      }`}>
      {saving
        ? <><Loader2 size={15} className="animate-spin" /> Enregistrement…</>
        : saved
        ? <><Check size={15} /> Enregistré avec succès</>
        : <><Check size={15} /> Enregistrer</>
      }
    </button>
  )
}
