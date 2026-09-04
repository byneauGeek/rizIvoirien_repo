import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sprout, Users, Building2, Factory, Ship, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useB2BReferenceData } from '../hooks/useB2BReferenceData'

const PROFILE_TYPES = [
  {
    type: 'PRODUCER', label: 'Producteur', icon: Sprout,
    desc: 'Je cultive du riz et je veux vendre ma récolte.',
    dashboard: '/producer',
  },
  {
    type: 'COOPERATIVE', label: 'Coopérative', icon: Users,
    desc: "Je représente un groupement de producteurs.",
    dashboard: '/cooperative',
  },
  {
    type: 'TRADER', label: 'Acheteur / Commerçant', icon: Building2,
    desc: "Je cherche à acheter du riz en volume.",
    dashboard: '/trader',
  },
  {
    type: 'PROCESSOR', label: 'Transformateur', icon: Factory,
    desc: 'Rizerie — je transforme le riz paddy.',
    dashboard: '/processor',
  },
  {
    type: 'EXPORTER', label: 'Exportateur', icon: Ship,
    desc: "Je recherche des fournisseurs pour l'export.",
    dashboard: '/exporter',
  },
]

function Label({ children }) {
  return <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/50 block mb-1.5">{children}</label>
}
function Input({ className = '', ...props }) {
  return (
    <input {...props}
      className={`w-full bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-3.5 font-dm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors ${className}`} />
  )
}

export default function B2BRegisterPage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const { regions: CI_REGIONS } = useB2BReferenceData()
  const [profileType, setProfileType] = useState(null)
  const [account, setAccount] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' })
  const [profile, setProfile] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selected = PROFILE_TYPES.find(p => p.type === profileType)
  const set = (field) => (e) => setAccount(a => ({ ...a, [field]: e.target.value }))
  const setP = (field) => (e) => setProfile(p => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (account.password.length < 6) return setError('Le mot de passe doit contenir au moins 6 caractères.')
    if (account.password !== account.confirmPassword) return setError('Les mots de passe ne correspondent pas.')

    setLoading(true)
    try {
      const data = await api.post('/auth/register-b2b', {
        profileType,
        email: account.email,
        password: account.password,
        name: account.name,
        phone: account.phone || undefined,
        profile,
      })
      setSession(data)
      navigate(selected.dashboard)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 pt-28 pb-16">
        <h1 className="font-playfair text-4xl font-bold text-charcoal mb-2">Rejoindre la filière riz</h1>
        <p className="font-dm text-charcoal/50 mb-10">
          Producteurs, coopératives, acheteurs, transformateurs, exportateurs — publiez une offre ou une
          demande et entrez en contact directement.
        </p>

        <AnimatePresence mode="wait">
          {!profileType ? (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PROFILE_TYPES.map(({ type, label, icon: Icon, desc }) => (
                <button key={type} onClick={() => setProfileType(type)}
                  className="text-left bg-white border-2 border-charcoal/10 rounded-3xl p-6 hover:border-forest transition-colors">
                  <Icon className="text-forest mb-3" size={28} />
                  <h3 className="font-syne font-bold text-charcoal mb-1">{label}</h3>
                  <p className="font-dm text-sm text-charcoal/50">{desc}</p>
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.form key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmit} className="space-y-5">
              <button type="button" onClick={() => setProfileType(null)}
                className="flex items-center gap-1.5 font-syne text-xs font-bold text-charcoal/40 hover:text-charcoal">
                <ArrowLeft size={14} /> Changer de profil
              </button>

              <div className="flex items-center gap-2 mb-2">
                <selected.icon className="text-forest" size={20} />
                <h2 className="font-syne font-bold text-charcoal">{selected.label}</h2>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="font-dm text-sm text-red-600">{error}</p>
                </div>
              )}

              <div><Label>Nom complet</Label><Input required value={account.name} onChange={set('name')} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Email</Label><Input type="email" required value={account.email} onChange={set('email')} /></div>
                <div><Label>Téléphone</Label><Input value={account.phone} onChange={set('phone')} placeholder="07 00 00 00 00" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Mot de passe</Label><Input type="password" required minLength={6} value={account.password} onChange={set('password')} /></div>
                <div><Label>Confirmer</Label><Input type="password" required value={account.confirmPassword} onChange={set('confirmPassword')} /></div>
              </div>

              <div className="h-px bg-charcoal/10 my-2" />

              {profileType === 'PRODUCER' && (
                <>
                  <div><Label>Région</Label><Input required list="regions" value={profile.region || ''} onChange={setP('region')} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label>Superficie (ha)</Label><Input type="number" min="0" step="0.1" value={profile.surfaceHa || ''} onChange={setP('surfaceHa')} /></div>
                    <div><Label>Capacité (kg)</Label><Input type="number" min="0" value={profile.capacityKg || ''} onChange={setP('capacityKg')} /></div>
                  </div>
                </>
              )}
              {profileType === 'COOPERATIVE' && (
                <>
                  <div><Label>Nom de la coopérative</Label><Input required value={profile.name || ''} onChange={setP('name')} /></div>
                  <div><Label>Responsable</Label><Input required value={profile.responsable || ''} onChange={setP('responsable')} /></div>
                  <div><Label>Région</Label><Input required list="regions" value={profile.region || ''} onChange={setP('region')} /></div>
                </>
              )}
              {(profileType === 'TRADER' || profileType === 'PROCESSOR' || profileType === 'EXPORTER') && (
                <>
                  <div><Label>Nom de l'entreprise</Label><Input required value={profile.companyName || ''} onChange={setP('companyName')} /></div>
                  <div><Label>Zones d'intérêt</Label><Input value={profile.zones || ''} onChange={setP('zones')} placeholder="Ex : Bouaké, San-Pédro" /></div>
                  {profileType === 'EXPORTER' && (
                    <div><Label>Capacité d'achat (kg)</Label><Input type="number" min="0" value={profile.capacityKg || ''} onChange={setP('capacityKg')} /></div>
                  )}
                </>
              )}

              <datalist id="regions">
                {CI_REGIONS.map(r => <option key={r} value={r} />)}
              </datalist>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-forest text-cream font-syne font-bold py-4 rounded-2xl hover:bg-forest-dark transition-colors disabled:opacity-50">
                {loading ? 'Création…' : 'Créer mon compte'} <ArrowRight size={16} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="font-dm text-sm text-charcoal/40 mt-8 text-center">
          Déjà inscrit ? <Link to="/auth" className="text-forest font-bold">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
