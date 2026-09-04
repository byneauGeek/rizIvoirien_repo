import { useState, useEffect } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { api } from '../../api/client'
import { fmt, fmtDate } from '../../utils/status'

const STATUS_COLORS = {
  PENDING:  'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export default function DemandesTab({ onRefreshKpis }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(false)
  const [statusFilter, setStatus] = useState('PENDING')
  const [typeFilter, setType]     = useState('ALL')
  const [acting, setActing]     = useState(null)
  const [error, setError]       = useState(null)
  const [modal, setModal]       = useState(null) // { type: 'approve'|'reject', request }
  const [adminNote, setAdminNote] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      const data = await api.get(`/admin/plan-requests?${params}`)
      let reqs = data.requests || []
      if (typeFilter !== 'ALL') reqs = reqs.filter(r => r.type === typeFilter)
      setRequests(reqs)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter, typeFilter])

  const openModal = (type, request) => { setModal({ type, request }); setAdminNote('') }
  const closeModal = () => { setModal(null); setAdminNote('') }

  const confirm = async () => {
    if (!modal) return
    if (modal.type === 'reject' && !adminNote.trim()) { setError('Un motif de refus est requis.'); return }
    setActing(modal.request.id); setError(null)
    try {
      if (modal.type === 'approve') {
        await api.put(`/admin/plan-requests/${modal.request.id}/approve`, { adminNote: adminNote || undefined })
      } else {
        await api.put(`/admin/plan-requests/${modal.request.id}/reject`, { adminNote })
      }
      closeModal()
      load()
      onRefreshKpis?.()
    } catch (e) { setError(e.message) }
    finally { setActing(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-playfair text-2xl font-bold text-charcoal">Demandes de montée en plan</h2>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="flex gap-2">
          {[['ALL', 'Tous'], ['PENDING', 'En attente'], ['APPROVED', 'Approuvés'], ['REJECTED', 'Refusés']].map(([k, l]) => (
            <button key={k} onClick={() => setStatus(k)}
              className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
                statusFilter === k ? 'bg-charcoal text-white border-charcoal' : 'border-charcoal/20 text-charcoal/60 hover:border-charcoal/40'
              }`}>{l}</button>
          ))}
        </div>
        <div className="w-px h-5 bg-charcoal/15" />
        <div className="flex gap-2">
          {[['ALL', 'Tous'], ['SHOP', 'Boutiques'], ['DRIVER', 'Livreurs']].map(([k, l]) => (
            <button key={k} onClick={() => setType(k)}
              className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
                typeFilter === k ? 'bg-indigo-600 text-white border-indigo-600' : 'border-indigo-200 text-indigo-500 hover:border-indigo-400'
              }`}>{l}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="font-dm text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-charcoal/40">
          <p className="font-dm">Aucune demande</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal/8">
                {['Partenaire', 'Type', 'Plan demandé', 'Montant', 'Message', 'Date', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-4 text-left font-syne text-xs font-bold text-charcoal/50 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map(r => {
                const name = r.type === 'SHOP'
                  ? (r.shop?.name || r.shop?.user?.name || `Boutique #${r.shopId}`)
                  : (r.driver?.user?.name || `Livreur #${r.driverId}`)
                return (
                  <tr key={r.id} className="border-b border-charcoal/5 hover:bg-charcoal/2 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-syne text-sm font-bold text-charcoal">{name}</p>
                      <p className="font-dm text-xs text-charcoal/50">
                        {r.type === 'SHOP' ? r.shop?.user?.email : r.driver?.user?.email}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-xs font-bold px-2 py-0.5 rounded-full ${r.type === 'SHOP' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-syne text-sm font-bold text-charcoal">{r.toPlan}</p>
                      {r.billingPeriod && (
                        <p className="font-dm text-xs text-charcoal/50">{r.billingPeriod === 'annual' ? 'Annuel' : 'Mensuel'}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 font-dm text-sm text-charcoal">{r.amount ? `${fmt(r.amount)} FCFA` : '—'}</td>
                    <td className="px-5 py-4 max-w-xs">
                      <p className="font-dm text-xs text-charcoal/70 truncate">{r.note || '—'}</p>
                      {r.adminNote && (
                        <p className="font-dm text-xs text-red-500 truncate">Refus : {r.adminNote}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 font-dm text-xs text-charcoal/50 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {r.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => openModal('approve', r)}
                            disabled={acting === r.id}
                            className="flex items-center gap-1 bg-green-50 text-green-700 font-syne text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle size={12} /> Approuver
                          </button>
                          <button
                            onClick={() => openModal('reject', r)}
                            disabled={acting === r.id}
                            className="flex items-center gap-1 bg-red-50 text-red-700 font-syne text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            <XCircle size={12} /> Refuser
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-playfair text-xl font-bold text-charcoal mb-4">
              {modal.type === 'approve' ? '✅ Approuver la demande' : '❌ Refuser la demande'}
            </h3>
            <p className="font-dm text-sm text-charcoal/70 mb-4">
              {modal.type === 'approve'
                ? `Le partenaire passera au plan ${modal.request.toPlan}.`
                : 'Précisez le motif de refus (obligatoire).'}
            </p>
            {modal.type === 'reject' && (
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="Motif de refus…"
                rows={3}
                className="w-full font-dm text-sm border border-charcoal/20 rounded-xl px-3 py-2.5 mb-4 focus:outline-none focus:border-red-500 resize-none"
              />
            )}
            {modal.type === 'approve' && (
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="Note optionnelle pour le partenaire…"
                rows={2}
                className="w-full font-dm text-sm border border-charcoal/20 rounded-xl px-3 py-2.5 mb-4 focus:outline-none focus:border-green-500 resize-none"
              />
            )}
            {error && <p className="font-dm text-sm text-red-500 mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={closeModal} className="font-syne text-sm font-bold text-charcoal/60 px-4 py-2.5 rounded-xl hover:bg-charcoal/5 transition-colors">
                Annuler
              </button>
              <button
                onClick={confirm}
                disabled={!!acting}
                className={`font-syne text-sm font-bold text-white px-5 py-2.5 rounded-xl disabled:opacity-50 transition-colors ${
                  modal.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {acting ? 'En cours…' : modal.type === 'approve' ? 'Confirmer' : 'Refuser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
