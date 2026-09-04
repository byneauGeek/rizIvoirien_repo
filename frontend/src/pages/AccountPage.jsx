import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, MapPin, Heart, Plus, Trash2, Check, Edit2, Save, X, AlertCircle } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { firstImage } from '../utils/images'

const fmt = n => Number(n).toLocaleString('fr-FR')

const TABS = [
  { id: 'profile', label: 'Mon profil', icon: User },
  { id: 'addresses', label: 'Adresses', icon: MapPin },
  { id: 'wishlist', label: 'Ma wishlist', icon: Heart },
]

// ─── Profile Tab ──────────────────────────────────────────────
function ProfileTab({ user, onUpdate }) {
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '', email: user.email || '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profileError, setProfileError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setProfileError(null)
    try {
      const updated = await api.put('/auth/profile', { name: form.name, phone: form.phone })
      onUpdate(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) { setProfileError(err.message || 'Erreur lors de la mise à jour') }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-3xl p-8 shadow-card max-w-lg">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-forest/15 flex items-center justify-center">
          <span className="font-playfair text-2xl font-bold text-forest">{user.name?.[0]?.toUpperCase()}</span>
        </div>
        <div>
          <p className="font-playfair text-xl font-bold text-charcoal">{user.name}</p>
          <p className="font-dm text-sm text-charcoal/50">{user.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {[
          { key: 'name', label: 'Nom complet', type: 'text', required: true },
          { key: 'phone', label: 'Téléphone', type: 'tel', placeholder: '+225 07 00 00 00 00' },
          { key: 'email', label: 'Email', type: 'email', disabled: true },
        ].map(({ key, label, type, required, placeholder, disabled }) => (
          <div key={key}>
            <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-2">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={e => !disabled && setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              required={required}
              disabled={disabled}
              className={`w-full border-2 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none transition-colors
                ${disabled ? 'border-charcoal/6 bg-charcoal/3 text-charcoal/40 cursor-not-allowed' : 'border-charcoal/10 focus:border-forest'}`}
            />
          </div>
        ))}

        {profileError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-dm text-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1">{profileError}</span>
            <button type="button" onClick={() => setProfileError(null)}><X size={14} /></button>
          </div>
        )}
        <motion.button type="submit" whileTap={{ scale: 0.98 }} disabled={saving}
          className={`w-full flex items-center justify-center gap-2 font-syne font-bold py-3.5 rounded-xl transition-all
            ${saved ? 'bg-green-500 text-cream' : 'bg-forest text-cream hover:bg-forest-light'} disabled:opacity-60`}>
          {saving ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
            : saved ? <><Check size={16} /> Modifications enregistrées</>
            : <><Save size={16} /> Enregistrer</>}
        </motion.button>
      </form>
    </div>
  )
}

// ─── Addresses Tab ────────────────────────────────────────────
function AddressesTab() {
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newAddr, setNewAddr] = useState({ label: '', address: '', city: 'Abidjan' })
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [addrError, setAddrError] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  useEffect(() => {
    api.get('/addresses').then(setAddresses).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setAddrError(null)
    try {
      const created = await api.post('/addresses', { ...newAddr, isDefault: addresses.length === 0 })
      setAddresses(a => [...a, created])
      setNewAddr({ label: '', address: '', city: 'Abidjan' })
      setShowNew(false)
    } catch (err) { setAddrError(err.message || 'Erreur lors de la création') }
  }

  const handleUpdate = async (id) => {
    setAddrError(null)
    try {
      const updated = await api.put(`/addresses/${id}`, editForm)
      setAddresses(a => a.map(x => x.id === id ? updated : x))
      setEditId(null)
    } catch (err) { setAddrError(err.message || 'Erreur lors de la mise à jour') }
  }

  const handleDelete = async (id) => {
    setDeleteConfirmId(null)
    setAddrError(null)
    try {
      await api.delete(`/addresses/${id}`)
      setAddresses(a => a.filter(x => x.id !== id))
    } catch (err) { setAddrError(err.message || 'Erreur lors de la suppression') }
  }

  const handleSetDefault = async (id) => {
    setAddrError(null)
    try {
      await api.put(`/addresses/${id}/default`, {})
      setAddresses(a => a.map(x => ({ ...x, isDefault: x.id === id })))
    } catch (err) { setAddrError(err.message || 'Erreur') }
  }

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-3xl animate-pulse shadow-card" />)}</div>

  return (
    <div className="space-y-4 max-w-lg">
      {addrError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-dm text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{addrError}</span>
          <button onClick={() => setAddrError(null)}><X size={14} /></button>
        </div>
      )}
      {addresses.map(addr => (
        <div key={addr.id} className="bg-white rounded-3xl p-5 shadow-card">
          {editId === addr.id ? (
            <div className="space-y-3">
              {[
                { key: 'label', placeholder: 'Libellé' },
                { key: 'address', placeholder: 'Adresse' },
                { key: 'city', placeholder: 'Ville' },
              ].map(({ key, placeholder }) => (
                <input key={key} type="text" placeholder={placeholder} value={editForm[key] || ''}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm focus:outline-none focus:border-forest" />
              ))}
              <div className="flex gap-2">
                <button onClick={() => handleUpdate(addr.id)}
                  className="flex-1 bg-forest text-cream font-syne font-bold text-sm py-2 rounded-xl hover:bg-forest-light transition-colors">
                  Enregistrer
                </button>
                <button onClick={() => setEditId(null)}
                  className="px-4 py-2 rounded-xl border-2 border-charcoal/10 font-syne text-sm text-charcoal/50 hover:border-charcoal/20 transition-colors">
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-syne text-sm font-bold text-charcoal">{addr.label}</p>
                  {addr.isDefault && (
                    <span className="font-syne text-[10px] font-bold bg-forest/10 text-forest px-2 py-0.5 rounded-full">Par défaut</span>
                  )}
                </div>
                <p className="font-dm text-sm text-charcoal/60">{addr.address}</p>
                <p className="font-dm text-sm text-charcoal/60">{addr.city}</p>
                {!addr.isDefault && (
                  <button onClick={() => handleSetDefault(addr.id)}
                    className="font-syne text-xs text-forest hover:underline mt-1">
                    Définir par défaut
                  </button>
                )}
              </div>
              <div className="flex gap-2 shrink-0 items-center">
                {deleteConfirmId === addr.id ? (
                  <>
                    <span className="font-dm text-xs text-charcoal/50">Supprimer ?</span>
                    <button onClick={() => handleDelete(addr.id)}
                      className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setDeleteConfirmId(null)}
                      className="p-1.5 rounded-lg border border-charcoal/15 text-charcoal/50 hover:border-charcoal/30 transition-colors">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditId(addr.id); setEditForm({ label: addr.label, address: addr.address, city: addr.city }) }}
                      className="p-2 rounded-xl text-charcoal/40 hover:bg-charcoal/5 hover:text-charcoal transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeleteConfirmId(addr.id)}
                      className="p-2 rounded-xl text-charcoal/40 hover:bg-terra/10 hover:text-terra transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <button onClick={() => setShowNew(v => !v)}
        className="w-full flex items-center gap-2 font-syne text-sm font-bold text-forest border-2 border-dashed border-forest/30 rounded-3xl p-5 hover:bg-forest/4 transition-colors">
        {showNew ? <X size={16} /> : <Plus size={16} />}
        {showNew ? 'Annuler' : 'Ajouter une adresse'}
      </button>

      <AnimatePresence>
        {showNew && (
          <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            onSubmit={handleCreate} className="overflow-hidden bg-white rounded-3xl shadow-card">
            <div className="p-5 space-y-3">
              {[
                { key: 'label', placeholder: 'Libellé (ex: Maison, Bureau)', required: true },
                { key: 'address', placeholder: 'Rue, quartier, numéro...', required: true },
                { key: 'city', placeholder: 'Ville' },
              ].map(({ key, placeholder, required }) => (
                <input key={key} type="text" placeholder={placeholder} required={required}
                  value={newAddr[key]} onChange={e => setNewAddr(a => ({ ...a, [key]: e.target.value }))}
                  className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-forest transition-colors" />
              ))}
              <button type="submit" className="w-full bg-forest text-cream font-syne font-bold py-3 rounded-xl hover:bg-forest-light transition-colors">
                Enregistrer l'adresse
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Wishlist Tab ─────────────────────────────────────────────
function WishlistTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [wishError, setWishError] = useState(null)

  useEffect(() => {
    api.get('/wishlist').then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleRemove = async (productId) => {
    setWishError(null)
    try {
      await api.delete(`/wishlist/${productId}`)
      setItems(prev => prev.filter(w => w.productId !== productId))
    } catch (err) { setWishError(err.message || 'Erreur lors de la suppression') }
  }

  if (loading) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => <div key={i} className="h-56 rounded-3xl bg-white animate-pulse shadow-card" />)}
    </div>
  )

  if (items.length === 0) return (
    <div className="text-center py-20">
      <Heart size={48} className="mx-auto text-charcoal/20 mb-4" />
      <h3 className="font-playfair text-2xl font-bold text-charcoal mb-2">Wishlist vide</h3>
      <p className="font-dm text-charcoal/50 mb-6">Ajoutez des produits à votre liste de souhaits.</p>
      <Link to="/shop" className="btn-primary">Découvrir les produits</Link>
    </div>
  )

  return (
    <div className="space-y-4">
      {wishError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-dm text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{wishError}</span>
          <button onClick={() => setWishError(null)}><X size={14} /></button>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {items.map(w => {
        const p = w.product
        const img = firstImage(p?.images)
        return (
          <div key={w.id} className="bg-white rounded-3xl overflow-hidden shadow-card group">
            <Link to={`/product/${p?.slug}`} className="block relative aspect-[4/3] overflow-hidden bg-forest/5">
              {img ? (
                <img src={img} alt={p?.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">🌾</div>
              )}
            </Link>
            <div className="p-4">
              <Link to={`/product/${p?.slug}`}>
                <p className="font-syne text-sm font-bold text-charcoal truncate hover:text-forest transition-colors">{p?.name}</p>
              </Link>
              <p className="font-dm text-xs text-charcoal/40 mt-0.5 truncate">{p?.shop?.name}</p>
              <div className="flex items-center justify-between mt-3">
                <p className="font-playfair text-base font-bold text-charcoal">{fmt(p?.price)} F</p>
                <button onClick={() => handleRemove(w.productId)}
                  className="p-1.5 rounded-lg text-charcoal/30 hover:bg-terra/10 hover:text-terra transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function AccountPage() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [activeTab, setActiveTab] = useState(params.get('tab') || 'profile')

  useEffect(() => {
    if (!user) navigate('/auth')
    else if (user.role !== 'BUYER') navigate('/')
  }, [user])

  if (!user) return null

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <div className="mb-8">
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Mon espace</p>
          <h1 className="font-playfair text-4xl font-bold text-charcoal">Mon compte</h1>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 flex items-center gap-2 font-syne text-sm font-bold px-5 py-2.5 rounded-full border-2 transition-all
                  ${activeTab === tab.id ? 'bg-forest border-forest text-cream' : 'border-charcoal/15 text-charcoal hover:border-forest/30'}`}>
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {activeTab === 'profile' && <ProfileTab user={user} onUpdate={updateUser} />}
            {activeTab === 'addresses' && <AddressesTab />}
            {activeTab === 'wishlist' && <WishlistTab />}
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer />
    </div>
  )
}
