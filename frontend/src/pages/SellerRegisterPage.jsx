import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Upload, Eye, EyeOff, ArrowRight, ArrowLeft, Store, FileText, User, AlertCircle, X, Sprout, Building2, Users } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import { api, uploadImages } from '../api/client'
import ImageDropZone from '../components/ui/ImageDropZone'

// ─── Step labels ────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'Informations légales', icon: FileText },
  { num: 2, label: 'Présentation',         icon: Store },
  { num: 3, label: 'Compte & Localisation',icon: User },
]

// ─── Reusable field components ───────────────────────────────────────────────
function Label({ children }) {
  return (
    <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 block mb-1.5">
      {children}
    </label>
  )
}

function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors ${className}`}
    />
  )
}

function Textarea({ className = '', ...props }) {
  return (
    <textarea
      {...props}
      className={`w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors resize-none ${className}`}
    />
  )
}

function ErrorMsg({ msg }) {
  if (!msg) return null
  return (
    <motion.p
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="font-dm text-sm text-red-600 mt-1"
    >
      {msg}
    </motion.p>
  )
}

// ─── Upload button ────────────────────────────────────────────────────────────
function UploadField({ label, url, onUpload, accept = 'image/*', previewClass }) {
  const ref = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const handleChange = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    setUploadError(null)
    try {
      const urls = await uploadImages(files)
      onUpload(urls[0])
    } catch (err) {
      setUploadError(err.message || 'Erreur lors du téléversement')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <Label>{label}</Label>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={handleChange} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-charcoal/20 rounded-2xl font-syne text-sm text-charcoal/60 hover:border-forest hover:text-forest transition-colors disabled:opacity-50"
      >
        <Upload size={15} />
        {uploading ? 'Téléversement...' : url ? 'Changer la photo' : 'Choisir une photo'}
      </button>
      {uploadError && (
        <div className="flex items-center gap-2 mt-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 font-dm text-xs">
          <AlertCircle size={13} className="shrink-0" />
          <span className="flex-1">{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)}><X size={12} /></button>
        </div>
      )}
      {url && previewClass && (
        <img src={url} alt="aperçu" className={`mt-3 shadow-card ${previewClass}`} loading="lazy" />
      )}
    </div>
  )
}

// ─── Progress bar ────────────────────────────────────────────────────────────
function ProgressBar({ current }) {
  return (
    <div className="w-full mb-10">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-charcoal/10 -z-0" />
        <div
          className="absolute left-0 top-5 h-0.5 bg-safran transition-all duration-500 -z-0"
          style={{ width: `${((current - 1) / (STEPS.length - 1)) * 100}%` }}
        />
        {STEPS.map(({ num, label, icon: Icon }) => {
          const done   = num < current
          const active = num === current
          return (
            <div key={num} className="flex flex-col items-center gap-1.5 z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  done   ? 'bg-safran border-safran text-charcoal'
                  : active ? 'bg-white border-safran text-safran shadow-lg'
                  : 'bg-white border-charcoal/15 text-charcoal/30'
                }`}
              >
                {done ? <CheckCircle size={18} /> : <Icon size={16} />}
              </div>
              <span className={`font-syne text-[10px] font-bold tracking-wide text-center leading-tight max-w-[72px] hidden sm:block ${active ? 'text-safran' : done ? 'text-charcoal/60' : 'text-charcoal/30'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
// LOT AUDIT-ORG-01 (audit XXX RIZ) : gap confirmé — aucun choix de type
// d'organisation n'existait à la création de boutique. COOPERATIVE n'est PAS
// un simple label posé sur Shop (ce serait exactement l'anti-pattern signalé
// par l'audit : "traitée comme une boutique individuelle avec un label
// coopérative") — le système de gestion organisationnelle spécifique existe
// déjà (Cooperative + CooperativeMember, filière B2B), donc ce choix ROUTE
// vers lui plutôt que de dupliquer un champ inerte sur Shop.
const ORG_TYPES = [
  { type: 'INDIVIDUAL',  label: 'Producteur individuel', icon: Sprout,   desc: 'Je vends seul(e), en mon nom propre.' },
  { type: 'COMPANY',     label: 'Entreprise',             icon: Building2, desc: 'Société commerciale (SARL, SA...).' },
  { type: 'COOPERATIVE', label: 'Coopérative',            icon: Users,    desc: 'Groupement de producteurs avec gestion des membres.' },
]

export default function SellerRegisterPage() {
  const navigate = useNavigate()
  const [step, setStep]       = useState(1)
  const [done, setDone]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [orgType, setOrgType] = useState(null)

  const [formData, setFormData] = useState({
    // Step 1
    shopName:        '',
    businessName:    '',
    rccm:            '',
    shopPhone:       '',
    shopEmail:       '',
    // Step 2
    shopDescription: '',
    shopSpeciality:  '',
    shopAvatar:      '',
    shopCover:       '',
    // Step 3
    name:            '',
    email:           '',
    password:        '',
    confirmPassword: '',
    shopLocation:    '',
    minOrder:        0,
    openingHours:    '',
  })

  const set = (field) => (value) =>
    setFormData(f => ({ ...f, [field]: value }))

  const setField = (field) => (e) =>
    setFormData(f => ({ ...f, [field]: e.target.value }))

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!orgType)                      return "Choisissez un type d'organisation."
    if (!formData.shopName.trim())     return 'Le nom de la boutique est requis.'
    if (!formData.businessName.trim()) return 'La raison sociale est requise.'
    if (!formData.rccm.trim())         return 'Le N° RCCM est requis.'
    if (!formData.shopPhone.trim())    return 'Le téléphone de la boutique est requis.'
    return null
  }

  const validateStep2 = () => {
    if (!formData.shopDescription.trim()) return 'La description est requise.'
    return null
  }

  const validateStep3 = () => {
    if (!formData.name.trim())                          return 'Votre nom complet est requis.'
    if (!formData.email.trim())                         return 'L\'email de connexion est requis.'
    if (!formData.password)                             return 'Le mot de passe est requis.'
    if (formData.password.length < 6)                   return 'Le mot de passe doit contenir au moins 6 caractères.'
    if (formData.password !== formData.confirmPassword) return 'Les mots de passe ne correspondent pas.'
    return null
  }

  const handleNext = (validator) => (e) => {
    e && e.preventDefault()
    setError('')
    if (validator) {
      const err = validator()
      if (err) { setError(err); return }
    }
    setStep(s => s + 1)
  }

  // ── Final submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const err = validateStep3()
    if (err) { setError(err); return }
    setLoading(true)
    try {
      await api.post('/auth/register-vendor', {
        email:           formData.email,
        password:        formData.password,
        name:            formData.name,
        shopName:        formData.shopName,
        businessName:    formData.businessName,
        rccm:            formData.rccm,
        shopPhone:       formData.shopPhone,
        shopEmail:       formData.shopEmail,
        shopDescription: formData.shopDescription,
        shopSpeciality:  formData.shopSpeciality,
        shopAvatar:      formData.shopAvatar,
        shopCover:       formData.shopCover,
        minOrder:        Number(formData.minOrder),
        openingHours:    formData.openingHours,
        shopLocation:    formData.shopLocation,
      })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Confirmation screen ────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-cream">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="max-w-md w-full text-center bg-white rounded-3xl shadow-card p-10"
          >
            <div className="w-20 h-20 rounded-full bg-safran/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-safran" />
            </div>
            <h2 className="font-playfair text-3xl font-bold text-charcoal mb-3">
              Boutique soumise ✓
            </h2>
            <p className="font-dm text-charcoal/60 leading-relaxed mb-8">
              Votre boutique est en attente de validation par notre équipe.
              Vous serez notifié par email dès son approbation.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 btn-primary"
            >
              Retour à l'accueil <ArrowRight size={15} />
            </Link>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Page layout ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-playfair text-4xl font-bold text-charcoal mb-2">
            Ouvrir ma Boutique
          </h1>
          <p className="font-dm text-charcoal/50">
            Commencez à vendre votre riz sur RizIvoirien — Étape {step} sur {STEPS.length}
          </p>
        </div>

        <ProgressBar current={step} />

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-card px-8 py-10">
          <AnimatePresence mode="wait">

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -32 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleNext(validateStep1)}
                className="space-y-5"
              >
                <h2 className="font-playfair text-2xl font-bold text-charcoal mb-4">
                  Informations légales
                </h2>

                <div>
                  <Label>Type d'organisation *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {ORG_TYPES.map(({ type, label, icon: Icon, desc }) => (
                      <button key={type} type="button" onClick={() => setOrgType(type)}
                        className={`text-left border-2 rounded-2xl p-3 transition-colors ${
                          orgType === type ? 'border-forest bg-forest/5' : 'border-charcoal/10 hover:border-forest/40'
                        }`}>
                        <Icon size={18} className={orgType === type ? 'text-forest' : 'text-charcoal/40'} />
                        <p className="font-syne text-xs font-bold text-charcoal mt-1.5">{label}</p>
                        <p className="font-dm text-[11px] text-charcoal/40 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {orgType === 'COOPERATIVE' ? (
                  <div className="bg-forest/5 border border-forest/20 rounded-2xl p-5 space-y-3">
                    <p className="font-dm text-sm text-charcoal/70">
                      Une coopérative a besoin d'un espace dédié : gestion des membres, propriété des marchandises,
                      comptabilité par membre. Ce parcours est différent de l'inscription boutique classique.
                    </p>
                    <Link to="/register/b2b?type=COOPERATIVE"
                      className="inline-flex items-center gap-2 bg-forest text-cream font-syne font-bold px-5 py-3 rounded-2xl hover:bg-forest-dark transition-colors">
                      Continuer vers l'inscription Coopérative <ArrowRight size={16} />
                    </Link>
                  </div>
                ) : (
                <>
                <div>
                  <Label>Nom de la boutique *</Label>
                  <Input
                    type="text"
                    value={formData.shopName}
                    onChange={setField('shopName')}
                    placeholder="Riz du Bandama"
                    required
                  />
                </div>

                <div>
                  <Label>Raison sociale / Nom commercial *</Label>
                  <Input
                    type="text"
                    value={formData.businessName}
                    onChange={setField('businessName')}
                    placeholder="SARL Konan &amp; Frères"
                    required
                  />
                </div>

                <div>
                  <Label>N° RCCM (Registre du Commerce) *</Label>
                  <Input
                    type="text"
                    value={formData.rccm}
                    onChange={setField('rccm')}
                    placeholder="CI-ABJ-2024-B-00000"
                    required
                  />
                </div>

                <div>
                  <Label>Téléphone de la boutique *</Label>
                  <Input
                    type="tel"
                    value={formData.shopPhone}
                    onChange={setField('shopPhone')}
                    placeholder="+225 07 00 00 00 00"
                    required
                  />
                </div>

                <div>
                  <Label>Email de la boutique (optionnel)</Label>
                  <Input
                    type="email"
                    value={formData.shopEmail}
                    onChange={setField('shopEmail')}
                    placeholder="boutique@exemple.ci"
                  />
                </div>

                <ErrorMsg msg={error} />

                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 bg-safran text-charcoal font-syne font-bold py-4 rounded-2xl hover:bg-safran/90 transition-colors"
                >
                  Suivant <ArrowRight size={16} />
                </motion.button>
                </>
                )}
              </motion.form>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -32 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleNext(validateStep2)}
                className="space-y-5"
              >
                <h2 className="font-playfair text-2xl font-bold text-charcoal mb-4">
                  Présentation de la boutique
                </h2>

                <div>
                  <Label>Description *</Label>
                  <Textarea
                    rows={4}
                    value={formData.shopDescription}
                    onChange={setField('shopDescription')}
                    placeholder="Décrivez votre boutique, vos produits, votre histoire..."
                    required
                  />
                </div>

                <div>
                  <Label>Spécialité</Label>
                  <Input
                    type="text"
                    value={formData.shopSpeciality}
                    onChange={setField('shopSpeciality')}
                    placeholder="Riz parfumé, Riz étuvé..."
                  />
                </div>

                {/* Logo circulaire */}
                <div>
                  <Label>Logo / Avatar (optionnel)</Label>
                  <div className="flex items-start gap-4">
                    <ImageDropZone
                      url={formData.shopAvatar}
                      onUpload={set('shopAvatar')}
                      label="Logo"
                      hint="Format carré"
                      shape="round"
                      aspect="h-24 w-24"
                      accent="safran"
                      authRequired={false}
                    />
                    <p className="font-dm text-xs text-charcoal/40 mt-2 leading-relaxed">
                      Glissez votre logo ou cliquez.<br />Format carré recommandé.
                    </p>
                  </div>
                </div>

                {/* Cover rectangulaire */}
                <div>
                  <Label>Image de couverture (optionnel)</Label>
                  <ImageDropZone
                    url={formData.shopCover}
                    onUpload={set('shopCover')}
                    label="Bannière de la boutique"
                    hint="JPG, PNG · format paysage recommandé"
                    aspect="h-36"
                    accent="safran"
                    authRequired={false}
                  />
                </div>

                <ErrorMsg msg={error} />

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep(1) }}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-2xl border-2 border-charcoal/12 font-syne text-sm font-bold text-charcoal/60 hover:border-charcoal/30 transition-colors"
                  >
                    <ArrowLeft size={15} /> Étape précédente
                  </button>
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 flex items-center justify-center gap-2 bg-safran text-charcoal font-syne font-bold py-3.5 rounded-2xl hover:bg-safran/90 transition-colors"
                  >
                    Suivant <ArrowRight size={16} />
                  </motion.button>
                </div>
              </motion.form>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <motion.form
                key="step3"
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -32 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <h2 className="font-playfair text-2xl font-bold text-charcoal mb-4">
                  Compte &amp; Localisation
                </h2>

                <div>
                  <Label>Votre nom complet *</Label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={setField('name')}
                    placeholder="Konan Yao"
                    required
                  />
                </div>

                <div>
                  <Label>Email de connexion *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={setField('email')}
                    placeholder="vous@exemple.ci"
                    required
                  />
                </div>

                <div>
                  <Label>Mot de passe *</Label>
                  <div className="relative">
                    <Input
                      type={showPw ? 'text' : 'password'}
                      value={formData.password}
                      onChange={setField('password')}
                      placeholder="••••••••"
                      minLength={6}
                      required
                      className="pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal/60 transition-colors"
                    >
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label>Confirmer le mot de passe *</Label>
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={setField('confirmPassword')}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {/* Séparateur */}
                <div className="border-t border-charcoal/8 pt-2">
                  <p className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/30 mb-4">
                    Informations boutique
                  </p>
                </div>

                <div>
                  <Label>Adresse / Localisation boutique</Label>
                  <Input
                    type="text"
                    value={formData.shopLocation}
                    onChange={setField('shopLocation')}
                    placeholder="Abidjan, Cocody, Rue des Jardins"
                  />
                </div>

                <div>
                  <Label>Commande minimum (FCFA)</Label>
                  <Input
                    type="number"
                    value={formData.minOrder}
                    onChange={setField('minOrder')}
                    placeholder="0"
                    min={0}
                  />
                </div>

                <div>
                  <Label>Horaires d'ouverture</Label>
                  <Input
                    type="text"
                    value={formData.openingHours}
                    onChange={setField('openingHours')}
                    placeholder="Lun–Sam 8h–18h"
                  />
                </div>

                <ErrorMsg msg={error} />

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep(2) }}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-2xl border-2 border-charcoal/12 font-syne text-sm font-bold text-charcoal/60 hover:border-charcoal/30 transition-colors"
                  >
                    <ArrowLeft size={15} /> Étape précédente
                  </button>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 flex items-center justify-center gap-2 bg-safran text-charcoal font-syne font-bold py-3.5 rounded-2xl hover:bg-safran/90 transition-colors disabled:opacity-60"
                  >
                    {loading
                      ? <div className="w-5 h-5 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
                      : <><Store size={16} /><span>Créer ma boutique</span></>
                    }
                  </motion.button>
                </div>
              </motion.form>
            )}

          </AnimatePresence>
        </div>

        {/* Bottom link */}
        <p className="text-center mt-6 font-dm text-sm text-charcoal/40">
          Déjà un compte ?{' '}
          <Link to="/auth" className="text-forest hover:underline font-semibold">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}

// ─── Inline avatar upload button ─────────────────────────────────────────────
function UploadInlineBtn({ url, onUpload }) {
  const ref = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const handleChange = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    setUploadError(null)
    try {
      const urls = await uploadImages(files)
      onUpload(urls[0])
    } catch (err) {
      setUploadError(err.message || 'Erreur lors du téléversement')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-charcoal/20 rounded-2xl font-syne text-sm text-charcoal/60 hover:border-safran hover:text-safran transition-colors disabled:opacity-50"
      >
        <Upload size={15} />
        {uploading ? 'Téléversement...' : url ? 'Changer' : 'Choisir'}
      </button>
      {uploadError && (
        <div className="flex items-center gap-2 mt-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 font-dm text-xs">
          <AlertCircle size={13} className="shrink-0" />
          <span className="flex-1">{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)}><X size={12} /></button>
        </div>
      )}
    </>
  )
}
