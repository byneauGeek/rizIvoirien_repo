import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Upload, Eye, EyeOff, ArrowRight, ArrowLeft, User, Car, Lock, Key, AlertCircle, X } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import { api, uploadImages } from '../api/client'
import ImageDropZone from '../components/ui/ImageDropZone'

// ─── Step labels ────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: "Code d'invitation", icon: Key },
  { num: 2, label: 'Identité',          icon: User },
  { num: 3, label: 'Permis & Véhicule', icon: Car },
  { num: 4, label: 'Compte',            icon: Lock },
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

function Select({ children, className = '', ...props }) {
  return (
    <select
      {...props}
      className={`w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 font-dm text-charcoal focus:outline-none focus:border-forest transition-colors ${className}`}
    >
      {children}
    </select>
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

// ─── Upload button with preview ──────────────────────────────────────────────
function UploadField({ label, url, onUpload, accept = 'image/*', previewClass = 'h-28 w-full rounded-2xl object-cover' }) {
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
      {url && (
        <img src={url} alt="aperçu" className={`mt-3 ${previewClass} shadow-card`} loading="lazy" />
      )}
    </div>
  )
}

// ─── Progress bar ────────────────────────────────────────────────────────────
function ProgressBar({ current }) {
  return (
    <div className="w-full mb-10">
      <div className="flex items-center justify-between relative">
        {/* connector line */}
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-charcoal/10 -z-0" />
        <div
          className="absolute left-0 top-5 h-0.5 bg-forest transition-all duration-500 -z-0"
          style={{ width: `${((current - 1) / (STEPS.length - 1)) * 100}%` }}
        />
        {STEPS.map(({ num, label, icon: Icon }) => {
          const done    = num < current
          const active  = num === current
          return (
            <div key={num} className="flex flex-col items-center gap-1.5 z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  done   ? 'bg-forest border-forest text-cream'
                  : active ? 'bg-white border-forest text-forest shadow-lg'
                  : 'bg-white border-charcoal/15 text-charcoal/30'
                }`}
              >
                {done
                  ? <CheckCircle size={18} />
                  : <Icon size={16} />
                }
              </div>
              <span className={`font-syne text-[10px] font-bold tracking-wide text-center leading-tight max-w-[64px] hidden sm:block ${active ? 'text-forest' : done ? 'text-charcoal/60' : 'text-charcoal/30'}`}>
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
export default function DriverRegisterPage() {
  const navigate = useNavigate()
  const [step, setStep]       = useState(1)
  const [done, setDone]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [showPw, setShowPw]   = useState(false)

  const [formData, setFormData] = useState({
    // Step 1
    inviteCode:      '',
    inviteValid:     false,
    // Step 2
    firstName:       '',
    lastName:        '',
    birthDate:       '',
    nationality:     'Ivoirienne',
    idNumber:        '',
    idPhoto:         '',
    phone:           '',
    // Step 3
    licenseNumber:   '',
    licenseExpiry:   '',
    licensePhoto:    '',
    vehicleType:     '',
    licensePlate:    '',
    vehiclePhoto:    '',
    // Step 4
    email:           '',
    password:        '',
    confirmPassword: '',
    avatar:          '',
  })

  const set = (field) => (value) =>
    setFormData(f => ({ ...f, [field]: value }))

  const setField = (field) => (e) =>
    setFormData(f => ({ ...f, [field]: e.target.value }))

  // ── Step 1 ─────────────────────────────────────────────────────────────────
  const handleCheckInvite = async (e) => {
    e.preventDefault()
    setError('')
    if (!formData.inviteCode.trim()) {
      setError('Veuillez saisir votre code d\'invitation.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/check-invite', { inviteCode: formData.inviteCode.trim() })
      setFormData(f => ({ ...f, inviteValid: true }))
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2 validate ────────────────────────────────────────────────────────
  const validateStep2 = () => {
    if (!formData.firstName.trim())   return 'Le prénom est requis.'
    if (!formData.lastName.trim())    return 'Le nom est requis.'
    if (!formData.birthDate)          return 'La date de naissance est requise.'
    if (!formData.nationality.trim()) return 'La nationalité est requise.'
    if (!formData.idNumber.trim())    return 'Le numéro CNI / Passeport est requis.'
    if (!formData.phone.trim())       return 'Le téléphone est requis.'
    return null
  }

  // ── Step 3 validate ────────────────────────────────────────────────────────
  const validateStep3 = () => {
    if (!formData.licenseNumber.trim())  return 'Le numéro de permis est requis.'
    if (!formData.licenseExpiry)         return 'La date d\'expiration du permis est requise.'
    if (!formData.vehicleType)           return 'Le type de véhicule est requis.'
    if (!formData.licensePlate.trim())   return 'La plaque d\'immatriculation est requise.'
    return null
  }

  // ── Step 4 validate ────────────────────────────────────────────────────────
  const validateStep4 = () => {
    if (!formData.email.trim())                       return 'L\'email est requis.'
    if (!formData.password)                           return 'Le mot de passe est requis.'
    if (formData.password.length < 6)                 return 'Le mot de passe doit contenir au moins 6 caractères.'
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
    const err = validateStep4()
    if (err) { setError(err); return }
    setLoading(true)
    try {
      await api.post('/auth/register-driver', {
        inviteCode:    formData.inviteCode,
        // Le backend attend `name` (pas firstName/lastName) et `vehiclePlate`
        // (pas licensePlate) — le mismatch faisait échouer la validation des
        // champs requis côté serveur même quand tout était rempli côté client.
        name:          `${formData.firstName} ${formData.lastName}`.trim(),
        birthDate:     formData.birthDate,
        nationality:   formData.nationality,
        idNumber:      formData.idNumber,
        idPhoto:       formData.idPhoto,
        phone:         formData.phone,
        licenseNumber: formData.licenseNumber,
        licenseExpiry: formData.licenseExpiry,
        licensePhoto:  formData.licensePhoto,
        vehicleType:   formData.vehicleType,
        vehiclePlate:  formData.licensePlate,
        vehiclePhoto:  formData.vehiclePhoto,
        email:         formData.email,
        password:      formData.password,
        avatar:        formData.avatar,
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
            <div className="w-20 h-20 rounded-full bg-forest/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-forest" />
            </div>
            <h2 className="font-playfair text-3xl font-bold text-charcoal mb-3">
              Dossier soumis ✓
            </h2>
            <p className="font-dm text-charcoal/60 leading-relaxed mb-8">
              Votre dossier est en cours de vérification par notre équipe.
              Vous recevrez une notification dès son activation.
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
            Devenir Livreur
          </h1>
          <p className="font-dm text-charcoal/50">
            Rejoignez notre réseau de livraison — Étape {step} sur {STEPS.length}
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
                onSubmit={handleCheckInvite}
                className="space-y-6"
              >
                <div>
                  <h2 className="font-playfair text-2xl font-bold text-charcoal mb-1">Code d'invitation</h2>
                  <p className="font-dm text-sm text-charcoal/50 mb-6">
                    Saisissez le code fourni par l'équipe RizIvoirien pour continuer.
                  </p>
                  <Label>Code d'invitation (ex : RIZ-XXXXXX)</Label>
                  <Input
                    type="text"
                    value={formData.inviteCode}
                    onChange={setField('inviteCode')}
                    placeholder="RIZ-XXXXXX"
                    className="text-center text-xl tracking-widest font-syne"
                    required
                  />
                  {formData.inviteValid && (
                    <p className="flex items-center gap-1.5 font-syne text-sm text-forest font-bold mt-2">
                      <CheckCircle size={15} /> Code accepté
                    </p>
                  )}
                  <ErrorMsg msg={error} />
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-4 rounded-2xl hover:bg-forest/90 transition-colors disabled:opacity-60"
                >
                  {loading
                    ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                    : <><span>Valider</span><ArrowRight size={16} /></>
                  }
                </motion.button>
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
                <h2 className="font-playfair text-2xl font-bold text-charcoal mb-4">Identité personnelle</h2>

                {/* Prénom + Nom */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prénom *</Label>
                    <Input
                      type="text"
                      value={formData.firstName}
                      onChange={setField('firstName')}
                      placeholder="Konan"
                      required
                    />
                  </div>
                  <div>
                    <Label>Nom *</Label>
                    <Input
                      type="text"
                      value={formData.lastName}
                      onChange={setField('lastName')}
                      placeholder="Yao"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Date de naissance *</Label>
                  <Input
                    type="date"
                    value={formData.birthDate}
                    onChange={setField('birthDate')}
                    required
                  />
                </div>

                <div>
                  <Label>Nationalité *</Label>
                  <Input
                    type="text"
                    value={formData.nationality}
                    onChange={setField('nationality')}
                    placeholder="Ivoirienne"
                    required
                  />
                </div>

                <div>
                  <Label>Numéro CNI / Passeport *</Label>
                  <Input
                    type="text"
                    value={formData.idNumber}
                    onChange={setField('idNumber')}
                    placeholder="CI-0000000000"
                    required
                  />
                </div>

                <div>
                  <Label>Photo CNI (recto)</Label>
                  <ImageDropZone
                    url={formData.idPhoto}
                    onUpload={set('idPhoto')}
                    label="Déposer la photo CNI"
                    hint="JPG, PNG · recto visible"
                    accent="forest"
                    authRequired={false}
                  />
                </div>

                <div>
                  <Label>Téléphone *</Label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={setField('phone')}
                    placeholder="+225 07 00 00 00 00"
                    required
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
                    className="flex-1 flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-3.5 rounded-2xl hover:bg-forest/90 transition-colors"
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
                onSubmit={handleNext(validateStep3)}
                className="space-y-5"
              >
                <h2 className="font-playfair text-2xl font-bold text-charcoal mb-4">Permis &amp; Véhicule</h2>

                <div>
                  <Label>Numéro de permis de conduire *</Label>
                  <Input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={setField('licenseNumber')}
                    placeholder="AB123456"
                    required
                  />
                </div>

                <div>
                  <Label>Date d'expiration du permis *</Label>
                  <Input
                    type="date"
                    value={formData.licenseExpiry}
                    onChange={setField('licenseExpiry')}
                    required
                  />
                </div>

                <div>
                  <Label>Photo du permis de conduire</Label>
                  <ImageDropZone
                    url={formData.licensePhoto}
                    onUpload={set('licensePhoto')}
                    label="Déposer la photo du permis"
                    hint="JPG, PNG · lisible"
                    accent="forest"
                    authRequired={false}
                  />
                </div>

                <div>
                  <Label>Type de véhicule *</Label>
                  <Select
                    value={formData.vehicleType}
                    onChange={setField('vehicleType')}
                    required
                  >
                    <option value="">-- Sélectionner --</option>
                    <option value="moto">Moto</option>
                    <option value="voiture">Voiture</option>
                    <option value="tricycle">Tricycle</option>
                    <option value="camionnette">Camionnette</option>
                  </Select>
                </div>

                <div>
                  <Label>Plaque d'immatriculation *</Label>
                  <Input
                    type="text"
                    value={formData.licensePlate}
                    onChange={setField('licensePlate')}
                    placeholder="AB 1234 CI"
                    required
                  />
                </div>

                <div>
                  <Label>Photo du véhicule</Label>
                  <ImageDropZone
                    url={formData.vehiclePhoto}
                    onUpload={set('vehiclePhoto')}
                    label="Déposer la photo du véhicule"
                    hint="JPG, PNG · plaque visible"
                    accent="forest"
                    authRequired={false}
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
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-3.5 rounded-2xl hover:bg-forest/90 transition-colors"
                  >
                    Suivant <ArrowRight size={16} />
                  </motion.button>
                </div>
              </motion.form>
            )}

            {/* ── STEP 4 ── */}
            {step === 4 && (
              <motion.form
                key="step4"
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -32 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <h2 className="font-playfair text-2xl font-bold text-charcoal mb-4">Créer votre compte</h2>

                <div>
                  <Label>Email *</Label>
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

                {/* Avatar optionnel avec preview circulaire */}
                <div>
                  <Label>Photo de profil (optionnel)</Label>
                  <div className="flex justify-center">
                    <ImageDropZone
                      url={formData.avatar}
                      onUpload={set('avatar')}
                      label="Photo de profil"
                      hint="Visage bien visible"
                      shape="round"
                      aspect="h-24 w-24"
                      accent="forest"
                      authRequired={false}
                    />
                  </div>
                </div>

                <ErrorMsg msg={error} />

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep(3) }}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-2xl border-2 border-charcoal/12 font-syne text-sm font-bold text-charcoal/60 hover:border-charcoal/30 transition-colors"
                  >
                    <ArrowLeft size={15} /> Étape précédente
                  </button>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-3.5 rounded-2xl hover:bg-forest/90 transition-colors disabled:opacity-60"
                  >
                    {loading
                      ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                      : <><span>Soumettre le dossier</span><CheckCircle size={16} /></>
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

// ─── Inline avatar upload button (avoids duplicate hook confusion) ────────────
function UploadAvatarBtn({ url, onUpload }) {
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
        className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-charcoal/20 rounded-2xl font-syne text-sm text-charcoal/60 hover:border-forest hover:text-forest transition-colors disabled:opacity-50"
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
