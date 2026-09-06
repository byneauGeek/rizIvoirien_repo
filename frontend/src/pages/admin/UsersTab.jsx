import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'
import { fmtDate } from '../../utils/status'
import { Search, UserX, UserCheck, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'

const ROLE_COLORS = {
  BUYER: 'bg-blue-100 text-blue-700',
  SELLER: 'bg-forest/10 text-forest',
  DRIVER: 'bg-amber-100 text-amber-700',
  ADMIN: 'bg-terra/15 text-terra',
}

const ROLES = ['', 'BUYER', 'SELLER', 'DRIVER', 'ADMIN']
const LIMIT = 50

export default function UsersTab() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [banError, setBanError] = useState(null)
  const [confirmBan, setConfirmBan] = useState(null)

  const totalPages = Math.ceil(total / LIMIT)

  const load = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({ limit: LIMIT, offset: page * LIMIT })
    if (roleFilter) qs.set('role', roleFilter)
    if (query) qs.set('search', query)
    api.get(`/admin/users?${qs}`)
      .then(d => { setUsers(d.users ?? []); setTotal(d.total ?? 0); setBanError(null) })
      .catch(e => setBanError(e.message))
      .finally(() => setLoading(false))
  }, [roleFilter, query, page])

  useEffect(() => { load() }, [load])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(0)
    setQuery(search)
  }

  const handleRoleFilter = (r) => {
    setPage(0)
    setRoleFilter(r)
  }

  const toggleBan = async (user) => {
    setConfirmBan(user)
  }

  const confirmBanAction = async () => {
    if (!confirmBan) return
    const user = confirmBan
    const newBanned = !user.banned
    setConfirmBan(null)
    setBanError(null)
    try {
      await api.put(`/admin/users/${user.id}/ban`, { banned: newBanned })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, banned: newBanned } : u))
    } catch (err) { setBanError(err.message) }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Gestion</p>
        <h1 className="font-playfair text-4xl font-bold text-charcoal">Utilisateurs <span className="text-charcoal/30">({users.length})</span></h1>
      </div>

      {banError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{banError}</p>
          <button onClick={() => setBanError(null)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}

      {confirmBan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <p className="font-playfair text-xl font-bold text-charcoal">
              {confirmBan.banned ? 'Débannir' : 'Bannir'} {confirmBan.name} ?
            </p>
            <p className="font-dm text-sm text-charcoal/50">
              {confirmBan.banned
                ? 'L\'utilisateur pourra à nouveau accéder à la plateforme.'
                : 'L\'utilisateur sera bloqué et ne pourra plus se connecter.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBan(null)}
                className="flex-1 border-2 border-charcoal/15 font-syne font-semibold text-sm py-2.5 rounded-xl text-charcoal hover:bg-charcoal/5 transition-colors">
                Annuler
              </button>
              <button onClick={confirmBanAction}
                className={`flex-1 font-syne font-bold text-sm py-2.5 rounded-xl transition-colors ${confirmBan.banned ? 'bg-forest text-white hover:bg-forest/90' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                {confirmBan.banned ? 'Débannir' : 'Bannir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nom ou email..."
              className="pl-9 pr-4 py-2.5 border-2 border-charcoal/10 rounded-full font-dm text-sm focus:outline-none focus:border-forest transition-colors w-56"
            />
          </div>
          <button type="submit" className="bg-charcoal text-cream font-syne font-bold text-sm px-5 py-2 rounded-full hover:bg-charcoal/80 transition-colors">
            Chercher
          </button>
        </form>

        <div className="flex gap-2 flex-wrap">
          {ROLES.map(r => (
            <button key={r} onClick={() => handleRoleFilter(r)}
              className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${roleFilter === r ? 'bg-charcoal border-charcoal text-cream' : 'border-charcoal/15 text-charcoal hover:border-charcoal/30'}`}>
              {r || 'Tous'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal/6">
                {['Utilisateur', 'Email', 'Téléphone', 'Rôle', 'Inscription', 'Statut', ''].map(h => (
                  <th key={h} className="px-5 py-4 text-left font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-charcoal/2 transition-colors ${u.banned ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-forest/10 flex items-center justify-center shrink-0">
                        <span className="font-syne text-xs font-bold text-forest">{u.name?.[0]}</span>
                      </div>
                      <p className="font-syne text-sm font-semibold text-charcoal">{u.name}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-dm text-sm text-charcoal/60">{u.email}</td>
                  <td className="px-5 py-4 font-dm text-sm text-charcoal/60">{u.phone || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${ROLE_COLORS[u.role] || 'bg-charcoal/8 text-charcoal/50'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-dm text-xs text-charcoal/40">{fmtDate(u.createdAt)}</td>
                  <td className="px-5 py-4">
                    <span className={`font-syne text-xs font-bold px-2 py-1 rounded-full ${u.banned ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                      {u.banned ? 'Banni' : 'Actif'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => toggleBan(u)}
                      className={`flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${u.banned ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                      {u.banned ? <UserCheck size={12} /> : <UserX size={12} />}
                      {u.banned ? 'Débannir' : 'Bannir'}
                    </button>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr><td colSpan={7} className="px-5 py-12 text-center font-dm text-charcoal/40">Aucun utilisateur trouvé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="font-dm text-sm text-charcoal/50">
            {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} sur {total} utilisateurs
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="p-2 rounded-xl border border-charcoal/15 text-charcoal hover:border-charcoal/30 disabled:opacity-30 transition-colors">
              <ChevronLeft size={16} />
            </button>
            {[...Array(Math.min(totalPages, 7))].map((_, i) => {
              const p = totalPages <= 7 ? i : Math.max(0, Math.min(page - 3, totalPages - 7)) + i
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-xl font-syne text-sm font-bold border transition-all ${p === page ? 'bg-charcoal border-charcoal text-cream' : 'border-charcoal/15 text-charcoal hover:border-charcoal/30'}`}>
                  {p + 1}
                </button>
              )
            })}
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="p-2 rounded-xl border border-charcoal/15 text-charcoal hover:border-charcoal/30 disabled:opacity-30 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
