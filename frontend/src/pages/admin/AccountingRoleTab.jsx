import { useEffect, useState } from 'react'
import { AlertCircle, UserPlus, Search, ShieldCheck, Ban, Power, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../../api/client'
import { PERMISSION_GROUPS } from './accountingPermissions'

function ErrorBanner({ error, onDismiss }) {
  if (!error) return null
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
      <AlertCircle size={14} className="text-red-500 shrink-0" />
      <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
      {onDismiss && <button onClick={onDismiss} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>}
    </div>
  )
}

function CreateAccountantForm({ onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.post('/admin/accounting/accountants/create', form)
      setForm({ name: '', email: '', phone: '', password: '' })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border-2 border-charcoal/10 rounded-3xl p-6 space-y-4">
      <h3 className="font-syne font-bold text-charcoal">Créer un compte dédié</h3>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input required placeholder="Nom complet" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        <input required type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        <input placeholder="Téléphone (optionnel)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        <input required type="password" minLength={6} placeholder="Mot de passe" value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
      </div>
      <button type="submit" disabled={submitting}
        className="flex items-center gap-2 bg-forest text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-2xl disabled:opacity-50">
        <UserPlus size={14} /> {submitting ? 'Création…' : 'Créer'}
      </button>
    </form>
  )
}

function PromoteExistingUser({ onPromoted }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const doSearch = async (e) => {
    e.preventDefault()
    if (!search.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await api.get(`/admin/users?search=${encodeURIComponent(search.trim())}&limit=10`)
      setResults((data.users || []).filter(u => !['ADMIN', 'ACCOUNTANT'].includes(u.role)))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const promote = async (user) => {
    setBusyId(user.id)
    setError('')
    try {
      await api.post(`/admin/accounting/accountants/${user.id}/promote`)
      setResults(r => r.filter(u => u.id !== user.id))
      onPromoted()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="bg-white border-2 border-charcoal/10 rounded-3xl p-6 space-y-4">
      <h3 className="font-syne font-bold text-charcoal">Attribuer le rôle à un utilisateur existant</h3>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      <form onSubmit={doSearch} className="flex gap-2">
        <input placeholder="Rechercher par nom ou email" value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        <button type="submit" disabled={loading}
          className="flex items-center gap-1.5 bg-charcoal text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-2xl disabled:opacity-50">
          <Search size={14} /> {loading ? '…' : 'Chercher'}
        </button>
      </form>
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map(u => (
            <div key={u.id} className="flex items-center justify-between bg-cream rounded-2xl px-4 py-2.5">
              <div>
                <p className="font-syne font-bold text-charcoal text-sm">{u.name}</p>
                <p className="font-dm text-xs text-charcoal/40">{u.email} · rôle actuel : {u.role}</p>
              </div>
              <button onClick={() => promote(u)} disabled={busyId === u.id}
                className="font-syne text-xs font-bold text-forest hover:text-forest-dark disabled:opacity-50">
                {busyId === u.id ? '…' : 'Promouvoir'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PermissionsEditor({ accountant, allPermissions, onSaved }) {
  const [selected, setSelected] = useState(new Set(accountant.accountingPermissions?.map(p => p.permission) || []))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (perm) => setSelected(prev => {
    const next = new Set(prev)
    next.has(perm) ? next.delete(perm) : next.add(perm)
    return next
  })

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.put(`/admin/accounting/accountants/${accountant.id}/permissions`, { permissions: [...selected] })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-charcoal/10 space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PERMISSION_GROUPS.map(group => (
          <div key={group.label}>
            <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-2">{group.label}</p>
            <div className="space-y-1.5">
              {group.permissions.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 font-dm text-sm text-charcoal cursor-pointer">
                  <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)}
                    disabled={!allPermissions.includes(key)}
                    className="accent-forest w-4 h-4" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving}
        className="bg-forest text-cream font-syne text-sm font-bold px-4 py-2 rounded-2xl disabled:opacity-50">
        {saving ? 'Enregistrement…' : 'Enregistrer les permissions'}
      </button>
    </div>
  )
}

function AccountantRow({ accountant, allPermissions, onChanged }) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggleBan = async () => {
    setBusy(true)
    try {
      await api.put(`/admin/users/${accountant.id}/ban`, { banned: !accountant.banned })
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const demote = async () => {
    if (!window.confirm(`Retirer le rôle Responsable Comptable à ${accountant.name} ?`)) return
    setBusy(true)
    try {
      await api.post(`/admin/accounting/accountants/${accountant.id}/demote`)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border border-charcoal/10 rounded-2xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accountant.banned ? 'bg-red-50' : 'bg-forest/10'}`}>
            <ShieldCheck size={16} className={accountant.banned ? 'text-red-500' : 'text-forest'} />
          </div>
          <div>
            <p className="font-syne font-bold text-charcoal text-sm">{accountant.name}</p>
            <p className="font-dm text-xs text-charcoal/40">
              {accountant.email} · {accountant.accountingPermissions?.length || 0} permission{accountant.accountingPermissions?.length === 1 ? '' : 's'}
              {accountant.banned && <span className="text-red-500 font-bold"> · Accès désactivé</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleBan} disabled={busy}
            className={`flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50 ${
              accountant.banned ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
            }`}>
            {accountant.banned ? <Power size={12} /> : <Ban size={12} />}
            {accountant.banned ? 'Réactiver' : 'Désactiver'}
          </button>
          <button onClick={demote} disabled={busy} className="font-syne text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50">
            Rétrograder
          </button>
          <button onClick={() => setExpanded(v => !v)} className="text-charcoal/40 hover:text-charcoal">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      {expanded && (
        <PermissionsEditor accountant={accountant} allPermissions={allPermissions} onSaved={onChanged} />
      )}
    </div>
  )
}

export default function AccountingRoleTab() {
  const [accountants, setAccountants] = useState([])
  const [allPermissions, setAllPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [accData, permData] = await Promise.all([
        api.get('/admin/accounting/accountants'),
        api.get('/admin/accounting/permissions'),
      ])
      setAccountants(accData.accountants || [])
      setAllPermissions(permData.permissions || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Comptabilité</p>
        <h1 className="font-playfair text-2xl font-bold text-charcoal">Responsables comptables</h1>
        <p className="font-dm text-sm text-charcoal/50 mt-1">
          Le rôle n'est jamais accordé automatiquement. Chaque permission est attribuée individuellement.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PromoteExistingUser onPromoted={load} />
        <CreateAccountantForm onCreated={load} />
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : accountants.length === 0 ? (
        <div className="text-center py-12 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <p className="font-dm text-charcoal/40">Aucun responsable comptable pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accountants.map(a => (
            <AccountantRow key={a.id} accountant={a} allPermissions={allPermissions} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}
