import { useEffect, useState, useMemo } from 'react'
import { api } from '../../api/client'
import {
  CheckCircle, AlertTriangle, Store, RotateCcw, Info,
  Image, FileText, MapPin, Settings, Bell, Megaphone,
  ExternalLink, CreditCard,
} from 'lucide-react'
import ImageDropZone from '../../components/ui/ImageDropZone'
import GoogleMapsLocationInput from '../../components/ui/GoogleMapsLocationInput'

/* ── Champs de complétion du profil ── */
const COMPLETION_FIELDS = [
  { key: 'name',          label: 'Nom de la boutique' },
  { key: 'description',   label: 'Description' },
  { key: 'avatar',        label: 'Logo' },
  { key: 'coverImage',    label: 'Photo de couverture' },
  { key: 'phone',         label: 'Téléphone' },
  { key: 'location',      label: 'Localisation' },
  { key: 'deliveryZones', label: 'Zones de livraison' },
  { key: 'openingHours',  label: 'Horaires d\'ouverture' },
]

const DESC_MAX = 500

const PAYMENT_OPTIONS = [
  { value: 'cash',         label: '💵 Espèces' },
  { value: 'orange_money', label: '🟠 Orange Money' },
  { value: 'mtn_money',    label: '🟡 MTN MoMo' },
  { value: 'wave',         label: '🔵 Wave' },
  { value: 'bank',         label: '🏦 Virement bancaire' },
]

/* ── Section card ── */
function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-charcoal/5">
        <div className="w-8 h-8 rounded-xl bg-[#E8A217]/10 flex items-center justify-center shrink-0">
          <Icon size={15} className="text-[#E8A217]" />
        </div>
        <div>
          <p className="font-syne text-sm font-bold text-charcoal">{title}</p>
          {subtitle && <p className="font-dm text-xs text-charcoal/40">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  )
}

/* ── Field ── */
function Field({ label, value, onChange, multiline, type = 'text', hint, placeholder, required, prefix }) {
  const cls = `w-full px-4 py-2.5 rounded-2xl border border-charcoal/10 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A217]/30 placeholder:text-charcoal/25 ${
    required && !value?.toString().trim() ? 'border-red-300 focus:ring-red-200' : ''
  }`
  return (
    <div>
      <label className="block font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-1.5">{label}</label>
      {prefix ? (
        <div className="flex items-center rounded-2xl border border-charcoal/10 overflow-hidden focus-within:ring-2 focus-within:ring-[#E8A217]/30">
          <span className="font-dm text-sm text-charcoal/40 px-3 bg-charcoal/3 border-r border-charcoal/10 py-2.5 whitespace-nowrap shrink-0">{prefix}</span>
          <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="flex-1 px-3 py-2.5 font-dm text-sm focus:outline-none bg-white" />
        </div>
      ) : multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} placeholder={placeholder} className={`${cls} resize-none`} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
      {hint && <p className="font-dm text-[11px] text-charcoal/30 mt-1">{hint}</p>}
    </div>
  )
}

/* ── Description avec compteur ── */
function DescriptionField({ value, onChange }) {
  const len = (value || '').length
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider">Description</label>
        <span className={`font-dm text-[11px] ${len > DESC_MAX - 50 ? 'text-red-500 font-bold' : 'text-charcoal/30'}`}>
          {len} / {DESC_MAX}
        </span>
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value.slice(0, DESC_MAX))}
        rows={4} maxLength={DESC_MAX}
        placeholder="Présentez votre boutique : histoire, valeurs, spécificités du riz proposé…"
        className="w-full px-4 py-2.5 rounded-2xl border border-charcoal/10 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A217]/30 placeholder:text-charcoal/25 resize-none"
      />
    </div>
  )
}

/* ── Toggle ── */
function Toggle({ label, sub, value, onChange, accent = 'safran' }) {
  const activeColor = accent === 'amber' ? 'bg-amber-400' : 'bg-[#E8A217]'
  return (
    <label className="flex items-start gap-3 cursor-pointer group" onClick={() => onChange(!value)}>
      <div className="relative shrink-0 mt-0.5" style={{ width: 40, height: 22 }}>
        <div className={`absolute inset-0 rounded-full transition-colors ${value ? activeColor : 'bg-charcoal/15 group-hover:bg-charcoal/22'}`} />
        <div className="absolute rounded-full bg-white shadow transition-all duration-200"
          style={{ width: 18, height: 18, top: 2, left: value ? 20 : 2 }} />
      </div>
      <div>
        <span className="font-dm text-sm text-charcoal leading-none">{label}</span>
        {sub && <p className="font-dm text-xs text-charcoal/40 mt-0.5">{sub}</p>}
      </div>
    </label>
  )
}

/* ── Aperçu miniature de la boutique ── */
function ShopMiniPreview({ form, shopId }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
      {/* Cover */}
      <div className="relative h-20 bg-gradient-to-r from-[#0F1923] to-[#1B4332]">
        {form.coverImage && (
          <img src={form.coverImage} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Avatar */}
        <div className="absolute bottom-3 left-4 flex items-end gap-2.5">
          {form.avatar ? (
            <img src={form.avatar} alt="" className="w-9 h-9 rounded-xl border-2 border-white object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-xl border-2 border-white bg-[#E8A217]/20 flex items-center justify-center">
              <Store size={14} className="text-[#E8A217]" />
            </div>
          )}
          <div className="pb-0.5">
            <p className="font-playfair text-sm font-bold text-white leading-none truncate max-w-[160px]">
              {form.name || 'Nom de la boutique'}
            </p>
            {form.location && (
              <p className="font-dm text-[10px] text-white/60 mt-0.5 flex items-center gap-1">
                <MapPin size={9} /> {form.location}
              </p>
            )}
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {form.speciality && (
            <span className="font-dm text-[10px] text-charcoal/50 bg-charcoal/5 px-2 py-0.5 rounded-full">{form.speciality}</span>
          )}
          {form.since && (
            <span className="font-dm text-[10px] text-charcoal/50 bg-charcoal/5 px-2 py-0.5 rounded-full">Depuis {form.since}</span>
          )}
        </div>
        {shopId && (
          <a href={`/shop/${shopId}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 font-syne text-[10px] font-bold text-[#E8A217] hover:underline shrink-0">
            Voir <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  )
}

/* ── buildForm ── */
function buildForm(shop) {
  let payments = []
  try { payments = JSON.parse(shop.paymentMethods || '[]') } catch {}
  return {
    name:               shop.name            || '',
    businessName:       shop.businessName    || '',
    rccm:               shop.rccm            || '',
    description:        shop.description     || '',
    speciality:         shop.speciality      || '',
    since:              shop.since           || '',
    phone:              shop.phone           || '',
    email:              shop.email           || '',
    location:           shop.location        || '',
    latitude:           shop.latitude        != null ? String(shop.latitude)  : '',
    longitude:          shop.longitude       != null ? String(shop.longitude) : '',
    coverImage:         shop.coverImage      || '',
    avatar:             shop.avatar          || '',
    minOrder:           shop.minOrder        ?? 0,
    preparationTime:    shop.preparationTime ?? 30,
    openingHours:       shop.openingHours    || '',
    deliveryZones:      shop.deliveryZones   || '',
    paused:             shop.paused          || false,
    pauseNote:          shop.pauseNote       || '',
    notifyEmail:        shop.notifyEmail     ?? true,
    notifyLowStock:     shop.notifyLowStock  ?? true,
    whatsapp:           shop.whatsapp        || '',
    facebook:           shop.facebook        || '',
    instagram:          shop.instagram       || '',
    paymentMethods:     payments,
    tags:               shop.tags            || '',
    announcement:       shop.announcement    || '',
    announcementActive: shop.announcementActive || false,
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   Composant principal
══════════════════════════════════════════════════════════════════════════════ */
export default function VendorShopTab({ onDirtyChange }) {
  const [shop, setShop]       = useState(null)
  const [form, setForm]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    api.get('/shops/my')
      .then(data => { setShop(data); setForm(buildForm(data)) })
      .catch(() => setError('Impossible de charger la boutique'))
      .finally(() => setLoading(false))
  }, [])

  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  /* ── Dirty state ── */
  const isDirty = useMemo(() => {
    if (!shop || !form) return false
    return JSON.stringify(buildForm(shop)) !== JSON.stringify(form)
  }, [shop, form])

  useEffect(() => { onDirtyChange?.(isDirty) }, [isDirty, onDirtyChange])

  const cancel = () => { setForm(buildForm(shop)); setError(null) }

  /* ── Complétion ── */
  const completion = useMemo(() => {
    if (!form) return { score: 0, missing: [] }
    const missing = COMPLETION_FIELDS.filter(f => !form[f.key])
    return {
      score: Math.round(((COMPLETION_FIELDS.length - missing.length) / COMPLETION_FIELDS.length) * 100),
      missing,
    }
  }, [form])

  /* ── Validation ── */
  const validate = () => {
    if (!form.name?.trim()) return 'Le nom de la boutique est requis.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email invalide.'
    if (form.minOrder < 0) return 'Commande minimum ne peut pas être négative.'
    if (form.latitude  && (Number(form.latitude)  < -90  || Number(form.latitude)  > 90))  return 'Latitude invalide (entre -90 et 90).'
    if (form.longitude && (Number(form.longitude) < -180 || Number(form.longitude) > 180)) return 'Longitude invalide (entre -180 et 180).'
    if (shop?.plan === 'BASIC') {
      const zoneCount = String(form.deliveryZones || '').split(',').map(z => z.trim()).filter(Boolean).length
      if (zoneCount > 1) return 'Le plan BASIC est limité à une seule zone de livraison. Passez au plan Certifié pour en configurer plusieurs.'
    }
    return null
  }

  /* ── Sauvegarde ── */
  const save = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true); setError(null); setSaved(false)
    try {
      const payload = {
        ...form,
        latitude:  form.latitude  ? Number(form.latitude)  : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      }
      const updated = await api.put('/shops/my', payload)
      setShop(updated); setForm(buildForm(updated))
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  /* ── Paiements (checkboxes) ── */
  const togglePayment = (value) => {
    const cur = form.paymentMethods || []
    set('paymentMethods')(cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value])
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 border-2 border-[#E8A217]/30 border-t-[#E8A217] rounded-full animate-spin" />
    </div>
  )

  if (!form) return (
    <div className="py-20 text-center font-dm text-charcoal/40">{error || 'Boutique introuvable'}</div>
  )

  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-20 bg-[#F0F2F5] pb-3 pt-1">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Boutique</p>
            <h1 className="font-playfair text-3xl font-bold text-charcoal">Paramètres</h1>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <button onClick={cancel} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-charcoal/15 bg-white font-syne text-sm font-bold text-charcoal/50 hover:text-charcoal transition-colors disabled:opacity-40">
                <RotateCcw size={13} /> Annuler
              </button>
            )}
            <button onClick={save} disabled={saving || !isDirty}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-syne text-sm font-bold transition-all ${
                saved      ? 'bg-green-500 text-white' :
                isDirty    ? 'bg-[#E8A217] text-white hover:bg-[#d4901a]' :
                             'bg-charcoal/10 text-charcoal/30 cursor-not-allowed'
              }`}>
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saved  && <CheckCircle size={14} />}
              {!saving && !saved && <Store size={14} />}
              {saved ? 'Enregistré !' : saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>

        {isDirty && !saved && (
          <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <Info size={13} className="text-amber-600 shrink-0" />
            <p className="font-dm text-xs text-amber-700">Modifications non enregistrées.</p>
          </div>
        )}
      </div>

      {/* Alertes */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600">{error}</p>
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
          <CheckCircle size={14} className="text-green-600 shrink-0" />
          <p className="font-dm text-sm text-green-700">Modifications enregistrées !</p>
        </div>
      )}

      {/* ── Aperçu + complétion ── */}
      <ShopMiniPreview form={form} shopId={shop?.id} />

      <div className="bg-white rounded-3xl px-5 py-4 shadow-sm border border-gray-50">
        <div className="flex items-center justify-between mb-2">
          <p className="font-syne text-xs font-bold text-charcoal">Complétion du profil</p>
          <span className={`font-syne text-xs font-bold ${
            completion.score >= 80 ? 'text-green-600' :
            completion.score >= 50 ? 'text-amber-600' : 'text-red-500'
          }`}>{completion.score}%</span>
        </div>
        <div className="h-2 bg-charcoal/8 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${
            completion.score >= 80 ? 'bg-green-500' :
            completion.score >= 50 ? 'bg-amber-400' : 'bg-red-400'
          }`} style={{ width: `${completion.score}%` }} />
        </div>
        {completion.missing.length > 0 && (
          <p className="font-dm text-[11px] text-charcoal/40 mt-1.5">
            Manquant : {completion.missing.map(f => f.label).join(', ')}
          </p>
        )}
      </div>

      {/* ── Visuels ── */}
      <Section icon={Image} title="Visuels" subtitle="Ce que voient les clients en premier">
        <div>
          <label className="block font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-2">Photo de couverture</label>
          <ImageDropZone url={form.coverImage} onUpload={set('coverImage')} label="Déposer la couverture" hint="JPG, PNG · 1200×400 recommandé" accent="safran" />
        </div>
        <div>
          <label className="block font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-2">Logo / Avatar</label>
          <ImageDropZone shape="round" aspect="h-20 w-20" url={form.avatar} onUpload={set('avatar')} accent="safran" />
        </div>
      </Section>

      {/* ── Identité ── */}
      <Section icon={FileText} title="Identité" subtitle="Vos informations légales et commerciales">
        <Field label="Nom de la boutique *" value={form.name} onChange={set('name')}
          placeholder="ex : Riz du Terroir Abidjanais" required />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Spécialité" value={form.speciality} onChange={set('speciality')}
            placeholder="ex : Riz étuvé local" />
          <Field label="Depuis (année)" value={form.since} onChange={set('since')}
            placeholder="ex : 2018" />
        </div>
        <DescriptionField value={form.description} onChange={set('description')} />
        <Field label="Tags / Mots-clés" value={form.tags} onChange={set('tags')}
          placeholder="ex : riz local, coopérative, sans traitement, bio"
          hint="Séparés par des virgules · améliorent votre visibilité dans la recherche" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Raison sociale" value={form.businessName} onChange={set('businessName')}
            placeholder="ex : Kouassi Agri SARL"
            hint="Nom légal de l'entreprise" />
          <Field label="RCCM" value={form.rccm} onChange={set('rccm')}
            placeholder="CI-ABJ-2024-B-12345" />
        </div>
      </Section>

      {/* ── Contact & Livraison ── */}
      <Section icon={MapPin} title="Contact & Livraison" subtitle="Où vous trouver et comment vous joindre">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Téléphone" value={form.phone} onChange={set('phone')}
            placeholder="+225 07 00 00 00 00" />
          <Field label="Email" value={form.email} onChange={set('email')} type="email"
            placeholder="boutique@exemple.ci" />
        </div>
        <Field label="WhatsApp" value={form.whatsapp} onChange={set('whatsapp')}
          placeholder="+225 07 00 00 00 00"
          hint="Affiché comme bouton vert sur votre page boutique" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Facebook" value={form.facebook} onChange={set('facebook')}
            prefix="facebook.com/" placeholder="ma-boutique" />
          <Field label="Instagram" value={form.instagram} onChange={set('instagram')}
            prefix="instagram.com/" placeholder="@maboutique" />
        </div>
        <Field label="Adresse / Localisation" value={form.location} onChange={set('location')}
          placeholder="ex : Marché de Cocody, Abidjan"
          hint="Visible par les clients sur votre page boutique" />
        <Field label="Zones de livraison" value={form.deliveryZones} onChange={set('deliveryZones')}
          placeholder={shop?.plan === 'BASIC' ? 'ex : Abidjan' : 'ex : Abidjan, Bouaké, Yamoussoukro'}
          hint={shop?.plan === 'BASIC'
            ? 'Plan Basic : une seule zone. Passez au plan Certifié pour en configurer plusieurs.'
            : 'Séparez les zones par des virgules'} />
        <div>
          <label className="block font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-1.5">Position exacte (optionnel)</label>
          <GoogleMapsLocationInput
            latitude={form.latitude ? Number(form.latitude) : null}
            longitude={form.longitude ? Number(form.longitude) : null}
            onLocate={({ lat, lng }) => { set('latitude')(String(lat)); set('longitude')(String(lng)) }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitude GPS" value={form.latitude} onChange={set('latitude')} type="number"
            placeholder="5.3600" hint="-90 à 90" />
          <Field label="Longitude GPS" value={form.longitude} onChange={set('longitude')} type="number"
            placeholder="-4.0083" hint="-180 à 180" />
        </div>
      </Section>

      {/* ── Opérations ── */}
      <Section icon={Settings} title="Opérations" subtitle="Conditions de vente et disponibilités">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-1.5">Commande minimum (FCFA)</label>
            <input type="number" min="0" value={form.minOrder}
              onChange={e => set('minOrder')(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-2xl border border-charcoal/10 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A217]/30" />
            <p className="font-dm text-[11px] text-charcoal/30 mt-1">Montant minimum pour commander</p>
          </div>
          <div>
            <label className="block font-syne text-xs font-bold text-charcoal/40 uppercase tracking-wider mb-1.5">Préparation (minutes)</label>
            <input type="number" min="0" value={form.preparationTime}
              onChange={e => set('preparationTime')(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-2xl border border-charcoal/10 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A217]/30" />
            <p className="font-dm text-[11px] text-charcoal/30 mt-1">Délai moyen avant commande prête</p>
          </div>
        </div>
        <Field label="Horaires d'ouverture" value={form.openingHours} onChange={set('openingHours')}
          placeholder="ex : Lun-Sam 8h-18h, Dim 9h-13h"
          hint="Affiché sur votre page boutique" />
      </Section>

      {/* ── Paiements ── */}
      <Section icon={CreditCard} title="Méthodes de paiement" subtitle="Modes acceptés affichés aux acheteurs">
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_OPTIONS.map(opt => {
            const checked = (form.paymentMethods || []).includes(opt.value)
            return (
              <label key={opt.value}
                onClick={() => togglePayment(opt.value)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border cursor-pointer transition-all ${
                  checked
                    ? 'border-[#E8A217] bg-[#E8A217]/6 text-charcoal'
                    : 'border-charcoal/10 bg-white text-charcoal/50 hover:border-charcoal/20'
                }`}>
                <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                  checked ? 'border-[#E8A217] bg-[#E8A217]' : 'border-charcoal/20'
                }`}>
                  {checked && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                </div>
                <span className="font-dm text-sm">{opt.label}</span>
              </label>
            )
          })}
        </div>
      </Section>

      {/* ── Annonce ── */}
      <Section icon={Megaphone} title="Annonce temporaire" subtitle="Bandeau visible sur votre page boutique publique">
        <Toggle
          label="Afficher une annonce sur ma boutique"
          sub="Visible de tous les visiteurs en haut de votre page"
          value={form.announcementActive}
          onChange={set('announcementActive')}
        />
        {form.announcementActive && (
          <Field label="Texte de l'annonce" value={form.announcement} onChange={set('announcement')}
            placeholder="ex : 🎉 Promotion -20% jusqu'au 30 janvier sur tous les sacs de 25kg"
            hint="Gardez le message court et percutant (max 160 caractères)" />
        )}
      </Section>

      {/* ── État boutique ── */}
      <Section icon={Store} title="État de la boutique" subtitle="Activez la pause si vous êtes temporairement indisponible">
        <Toggle
          label="Mettre la boutique en pause"
          sub="Les clients ne pourront plus passer commande pendant la pause"
          value={form.paused}
          onChange={set('paused')}
          accent="amber"
        />
        {form.paused && (
          <Field label="Raison de la pause" value={form.pauseNote} onChange={set('pauseNote')}
            placeholder="ex : Congé jusqu'au 15 janvier, réouverture le 16"
            hint="Affiché aux clients sur votre page boutique" />
        )}
      </Section>

      {/* ── Notifications ── */}
      <Section icon={Bell} title="Notifications" subtitle="Alertes envoyées à votre adresse email">
        <Toggle label="Nouvelles commandes par email" value={form.notifyEmail} onChange={set('notifyEmail')} />
        <Toggle label="Alertes stock faible par email" value={form.notifyLowStock} onChange={set('notifyLowStock')} />
      </Section>


    </div>
  )
}
