import { useState, useEffect } from 'react'
import { Plus, Copy, Check, Trash2, UserX, UserCheck, Eye, EyeOff, RefreshCw, Briefcase, Key, Tag, Zap } from 'lucide-react'
import { api } from '../../api/client'
import { fmtDate } from '../../utils/status'

// ─── Section : Comptes commerciaux ──────────────────────────────────────────

function CommercialAccountsSection() {
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]           = useState({ name: '', email: '', phone: '', password: '' })
  const [showPw, setShowPw]       = useState(false)
  const [creating, setCreating]   = useState(false)
  const [acting, setActing]       = useState(null)
  const [error, setError]         = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/users?role=COMMERCIAL&limit=100')
      setUsers(data.users ?? [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    setCreating(true); setError(null)
    try {
      await api.post('/admin/users/create-commercial', form)
      setForm({ name: '', email: '', phone: '', password: '' })
      setShowCreate(false)
      load()
    } catch (e) { setError(e.message) }
    finally { setCreating(false) }
  }

  const toggleBan = async (user) => {
    setActing(user.id); setError(null)
    try {
      await api.put(`/admin/users/${user.id}/ban`, { banned: !user.banned })
      load()
    } catch (e) { setError(e.message) }
    finally { setActing(null) }
  }

  const deleteUser = async (user) => {
    setActing(user.id); setError(null)
    try {
      await api.delete(`/admin/users/${user.id}`)
      setConfirmDelete(null)
      load()
    } catch (e) { setError(e.message) }
    finally { setActing(null) }
  }

  const inputCls = 'w-full font-dm text-sm bg-white border border-charcoal/20 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors'

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-charcoal/8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Briefcase size={18} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-syne font-bold text-charcoal">Équipe commerciale</h3>
            <p className="font-dm text-xs text-charcoal/50">{users.length} compte{users.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setError(null) }}
          className="flex items-center gap-2 bg-indigo-600 text-white font-syne text-sm font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Créer un compte
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-6 py-5 bg-indigo-50/50 border-b border-indigo-100">
          <h4 className="font-syne text-sm font-bold text-charcoal mb-4">Nouveau compte commercial</h4>
          <form onSubmit={create} className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-syne text-xs font-bold text-charcoal/60 uppercase tracking-wider block mb-1.5">Nom complet *</label>
              <input type="text" value={form.name} onChange={e => setF('name', e.target.value)} required placeholder="Jean Kouassi" className={inputCls} />
            </div>
            <div>
              <label className="font-syne text-xs font-bold text-charcoal/60 uppercase tracking-wider block mb-1.5">Email *</label>
              <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} required placeholder="jean@rizivoirien.ci" className={inputCls} />
            </div>
            <div>
              <label className="font-syne text-xs font-bold text-charcoal/60 uppercase tracking-wider block mb-1.5">Téléphone</label>
              <input type="tel" value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="+225 07 00 00 00 00" className={inputCls} />
            </div>
            <div>
              <label className="font-syne text-xs font-bold text-charcoal/60 uppercase tracking-wider block mb-1.5">Mot de passe *</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setF('password', e.target.value)} required minLength={6} placeholder="••••••••" className={inputCls + ' pr-10'} />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal/70">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="col-span-2 font-dm text-sm text-red-500">{error}</p>}
            <div className="col-span-2 flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => { setShowCreate(false); setError(null) }} className="font-syne text-sm font-bold text-charcoal/60 px-4 py-2 rounded-xl hover:bg-charcoal/5 transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={creating} className="font-syne text-sm font-bold bg-indigo-600 text-white px-5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                {creating ? 'Création…' : 'Créer le compte'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-charcoal/40">
          <Briefcase size={36} className="mb-2 opacity-30" />
          <p className="font-dm text-sm">Aucun compte commercial</p>
          <p className="font-dm text-xs mt-1">Créez le premier compte ou utilisez les codes d'invitation</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-charcoal/8">
              {['Nom', 'Email', 'Téléphone', 'Créé le', 'Statut', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left font-syne text-xs font-bold text-charcoal/50 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={`border-b border-charcoal/5 transition-colors ${u.banned ? 'bg-red-50/50' : 'hover:bg-charcoal/2'}`}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="font-playfair font-bold text-indigo-600 text-sm">{u.name?.[0]}</span>
                    </div>
                    <span className="font-syne text-sm font-semibold text-charcoal">{u.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 font-dm text-sm text-charcoal/70">{u.email}</td>
                <td className="px-5 py-3.5 font-dm text-sm text-charcoal/70">{u.phone || '—'}</td>
                <td className="px-5 py-3.5 font-dm text-xs text-charcoal/50">{fmtDate(u.createdAt)}</td>
                <td className="px-5 py-3.5">
                  <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full ${u.banned ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {u.banned ? 'Suspendu' : 'Actif'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleBan(u)}
                      disabled={acting === u.id}
                      title={u.banned ? 'Réactiver' : 'Suspendre'}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        u.banned
                          ? 'bg-green-50 text-green-600 hover:bg-green-100'
                          : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                      }`}
                    >
                      {u.banned ? <UserCheck size={15} /> : <UserX size={15} />}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(u)}
                      disabled={acting === u.id}
                      title="Supprimer"
                      className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-playfair text-lg font-bold text-charcoal mb-2">Supprimer ce compte ?</h3>
            <p className="font-dm text-sm text-charcoal/70 mb-1">
              <strong>{confirmDelete.name}</strong> · {confirmDelete.email}
            </p>
            <p className="font-dm text-xs text-red-500 mb-5">Cette action est irréversible. Toutes les notes CRM de cet utilisateur seront supprimées.</p>
            {error && <p className="font-dm text-sm text-red-500 mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="font-syne text-sm font-bold text-charcoal/60 px-4 py-2.5 rounded-xl hover:bg-charcoal/5 transition-colors">
                Annuler
              </button>
              <button onClick={() => deleteUser(confirmDelete)} disabled={!!acting} className="font-syne text-sm font-bold bg-red-600 text-white px-5 py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-60 transition-colors">
                {acting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section : Codes d'invitation ─────────────────────────────────────────

function InviteCodesSection() {
  const [codes, setCodes]     = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [count, setCount]     = useState(1)
  const [copied, setCopied]   = useState(null)
  const [error, setError]     = useState(null)
  const [showAll, setShowAll] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/invite-codes')
      setCodes(Array.isArray(data) ? data : [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const generate = async () => {
    setGenerating(true); setError(null)
    try {
      await api.post('/admin/invite-codes', { count })
      load()
    } catch (e) { setError(e.message) }
    finally { setGenerating(false) }
  }

  const copy = (code) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const copyLink = (code) => {
    const url = `${window.location.origin}/commercial/register`
    navigator.clipboard.writeText(`${url}\nCode : ${code}`).catch(() => {})
    setCopied(`link-${code}`)
    setTimeout(() => setCopied(null), 2000)
  }

  const displayCodes = showAll ? codes : codes.filter(c => !c.used)

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-charcoal/8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Key size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-syne font-bold text-charcoal">Codes d'invitation</h3>
            <p className="font-dm text-xs text-charcoal/50">
              {codes.filter(c => !c.used).length} disponible{codes.filter(c => !c.used).length !== 1 ? 's' : ''} sur {codes.length} total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 font-dm text-sm text-charcoal/60 cursor-pointer select-none">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="accent-indigo-600" />
            Afficher utilisés
          </label>
          <div className="flex items-center gap-2 bg-charcoal/5 border border-charcoal/15 rounded-xl px-3 py-2">
            <span className="font-dm text-sm text-charcoal/60">×</span>
            <input
              type="number"
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(10, Number(e.target.value))))}
              className="w-10 font-syne font-bold text-sm text-center bg-transparent focus:outline-none"
              min={1} max={10}
            />
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 bg-amber-500 text-white font-syne text-sm font-bold px-4 py-2 rounded-xl hover:bg-amber-600 disabled:opacity-60 transition-colors"
          >
            <Tag size={15} /> {generating ? 'Génération…' : 'Générer'}
          </button>
          <button onClick={load} disabled={loading} className="p-2 rounded-xl bg-charcoal/5 text-charcoal/50 hover:bg-charcoal/10 transition-colors">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* URL info */}
      <div className="px-6 py-3 bg-indigo-50/60 border-b border-indigo-100 flex items-center gap-3">
        <span className="font-dm text-xs text-charcoal/50">URL d'inscription :</span>
        <code className="font-mono text-xs text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">{window.location.origin}/commercial/register</code>
      </div>

      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100">
          <p className="font-dm text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : displayCodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-charcoal/40">
          <Key size={36} className="mb-2 opacity-30" />
          <p className="font-dm text-sm">Aucun code disponible</p>
          <p className="font-dm text-xs mt-1">Générez des codes pour inviter des commerciaux</p>
        </div>
      ) : (
        <div className="divide-y divide-charcoal/5">
          {displayCodes.map(c => (
            <div key={c.id} className={`flex items-center gap-4 px-6 py-3.5 ${c.used ? 'opacity-50' : ''}`}>
              <span className="font-mono font-bold text-sm text-charcoal tracking-widest flex-1">{c.code}</span>
              <span className="font-dm text-xs text-charcoal/40">{fmtDate(c.createdAt)}</span>
              <span className={`font-syne text-xs font-bold px-2.5 py-0.5 rounded-full ${c.used ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                {c.used ? 'Utilisé' : 'Disponible'}
              </span>
              {!c.used && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copy(c.code)}
                    className={`flex items-center gap-1 font-syne text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                      copied === c.code ? 'bg-green-100 text-green-700' : 'bg-charcoal/5 text-charcoal/60 hover:bg-charcoal/10'
                    }`}
                  >
                    {copied === c.code ? <><Check size={12} /> Copié</> : <><Copy size={12} /> Code</>}
                  </button>
                  <button
                    onClick={() => copyLink(c.code)}
                    className={`flex items-center gap-1 font-syne text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                      copied === `link-${c.code}` ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    }`}
                  >
                    {copied === `link-${c.code}` ? <><Check size={12} /> Copié</> : <><Copy size={12} /> Lien + code</>}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Section : Paramètres généraux ────────────────────────────────────────

function GeneralSettingsSection() {
  const REGISTER_URL = typeof window !== 'undefined' ? `${window.location.origin}/commercial/register` : '/commercial/register'
  const [copied, setCopied]           = useState(false)
  const [autoValidate, setAutoValidate] = useState(true)
  const [toggling, setToggling]       = useState(false)
  const [settingsError, setSettingsError] = useState(null)

  useEffect(() => {
    // Un échec ici laisse le toggle sur sa valeur par défaut (true) sans que
    // l'admin sache qu'elle peut ne pas refléter le réglage réel du serveur
    // — risque concret de le faire basculer par erreur vers l'état inverse.
    api.get('/admin/settings')
      .then(d => { if (d?.autoValidateOrders != null) setAutoValidate(d.autoValidateOrders) })
      .catch(e => setSettingsError(`Valeur affichée potentiellement incorrecte — ${e.message}`))
  }, [])

  const toggle = async () => {
    const next = !autoValidate
    setAutoValidate(next)
    setToggling(true); setSettingsError(null)
    try {
      await api.put('/admin/settings', { autoValidateOrders: next })
    } catch (e) {
      setAutoValidate(!next)
      setSettingsError(e.message)
    } finally { setToggling(false) }
  }

  const copy = () => {
    navigator.clipboard.writeText(REGISTER_URL).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-charcoal/8">
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
          <Briefcase size={18} className="text-slate-500" />
        </div>
        <div>
          <h3 className="font-syne font-bold text-charcoal">Paramètres généraux</h3>
          <p className="font-dm text-xs text-charcoal/50">Workflow de commandes et accès à l'espace commercial</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Auto-validate toggle */}
        <div>
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-3">Workflow des commandes</p>
          <div className="flex items-center justify-between bg-charcoal/3 rounded-xl px-4 py-4">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${autoValidate ? 'bg-green-100' : 'bg-blue-100'}`}>
                <Zap size={16} className={autoValidate ? 'text-green-600' : 'text-blue-600'} />
              </div>
              <div>
                <p className="font-syne text-sm font-bold text-charcoal">Validation automatique des commandes</p>
                <p className="font-dm text-xs text-charcoal/50 mt-0.5 max-w-md">
                  {autoValidate
                    ? 'Les commandes sont confirmées immédiatement à la création et transmises directement à la boutique.'
                    : 'Chaque commande passe par la file de validation. Le commercial doit appeler le client et confirmer avant transmission à la boutique.'}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0 ml-4">
              <button
                onClick={toggle}
                disabled={toggling}
                className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-60 ${autoValidate ? 'bg-green-500' : 'bg-charcoal/25'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoValidate ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
              <span className={`font-syne text-[10px] font-bold ${autoValidate ? 'text-green-600' : 'text-charcoal/40'}`}>
                {autoValidate ? 'Activé' : 'Désactivé'}
              </span>
            </div>
          </div>
          {settingsError && <p className="font-dm text-xs text-red-500 mt-2">{settingsError}</p>}
        </div>

        {/* Access info */}
        <div>
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-3">Accès à l'espace</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-charcoal/3 rounded-xl px-4 py-3">
              <div>
                <p className="font-syne text-sm font-bold text-charcoal">URL d'inscription commerciale</p>
                <code className="font-mono text-xs text-indigo-600">{REGISTER_URL}</code>
              </div>
              <button
                onClick={copy}
                className={`flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                  copied ? 'bg-green-100 text-green-700' : 'bg-charcoal/5 text-charcoal/60 hover:bg-charcoal/10'
                }`}
              >
                {copied ? <><Check size={12} /> Copié</> : <><Copy size={12} /> Copier</>}
              </button>
            </div>
            <div className="flex items-center justify-between bg-charcoal/3 rounded-xl px-4 py-3">
              <div>
                <p className="font-syne text-sm font-bold text-charcoal">URL du tableau de bord</p>
                <code className="font-mono text-xs text-indigo-600">{typeof window !== 'undefined' ? `${window.location.origin}/commercial` : '/commercial'}</code>
              </div>
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div>
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-3">Permissions du rôle COMMERCIAL</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Validation des commandes', allowed: true },
              { label: 'Pipeline boutiques', allowed: true },
              { label: 'Pipeline livreurs', allowed: true },
              { label: 'Demandes de plan', allowed: true },
              { label: 'Contrats', allowed: true },
              { label: 'Renouvellements', allowed: true },
              { label: 'Codes invitation', allowed: true },
              { label: 'Fiches de paie', allowed: true },
              { label: 'Paramètres plateforme', allowed: false },
              { label: 'Finance & analytics', allowed: false },
              { label: 'Journal d\'audit', allowed: false },
              { label: 'Créer des comptes commerciaux', allowed: false },
            ].map(({ label, allowed }) => (
              <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${allowed ? 'bg-green-50' : 'bg-red-50/50'}`}>
                <span className={`text-sm ${allowed ? 'text-green-600' : 'text-red-400'}`}>{allowed ? '✓' : '✗'}</span>
                <span className={`font-dm text-xs ${allowed ? 'text-green-800' : 'text-charcoal/50'}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow info */}
        <div>
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-3">Workflow recommandé</p>
          <ol className="space-y-2">
            {[
              'Générer un code d\'invitation dans la section "Codes d\'invitation"',
              'Partager l\'URL d\'inscription + le code au nouveau commercial',
              'Le commercial crée son compte depuis /commercial/register',
              'Le commercial accède au tableau de bord à /commercial',
              'L\'admin peut suspendre ou supprimer le compte à tout moment',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 font-syne font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span className="font-dm text-sm text-charcoal/70">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ────────────────────────────────────────────────────

export default function CommercialSettingsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-playfair text-2xl font-bold text-charcoal">Espace Commercial</h2>
          <p className="font-dm text-sm text-charcoal/50 mt-1">Gestion des comptes et configuration de l'espace commercial</p>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="font-syne text-xs font-bold text-indigo-600">Rôle COMMERCIAL</span>
        </div>
      </div>

      <CommercialAccountsSection />
      <InviteCodesSection />
      <GeneralSettingsSection />
    </div>
  )
}
