import { useState, useEffect } from 'react'
import { RefreshCw, Bell } from 'lucide-react'
import { api } from '../../api/client'
import { fmtDate } from '../../utils/status'

const AGE_COLOR = (days) => {
  if (days < 7)  return 'text-green-600'
  if (days <= 30) return 'text-amber-600'
  return 'text-red-600'
}

export default function ContratsTab({ onRefreshKpis }) {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading]     = useState(false)
  const [type, setType]           = useState('ALL')
  const [pending, setPending]     = useState(true)
  const [acting, setActing]       = useState(null)
  const [error, setError]         = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/contracts')
      let list = data.contracts || []
      if (pending) list = list.filter(c => c.status === 'PENDING_SIGNATURE')
      if (type !== 'ALL') list = list.filter(c => c.type === type)
      setContracts(list)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [type, pending])

  const doAction = async (label, fn) => {
    setActing(label); setError(null)
    try { await fn(); load(); onRefreshKpis?.() }
    catch (e) { setError(e.message) }
    finally { setActing(null) }
  }

  const regen  = (c) => doAction(`regen-${c.id}`, () =>
    c.type === 'SHOP'
      ? api.post(`/admin/contracts/regenerate/shop/${c.shopId}`)
      : api.post(`/admin/contracts/regenerate/driver/${c.driverId}`)
  )

  const remind = (c) => doAction(`remind-${c.id}`, () =>
    c.type === 'SHOP'
      ? api.post(`/commercial/shops/${c.shopId}/remind-contract`)
      : api.post(`/commercial/drivers/${c.driverId}/remind-contract`)
  )

  const ageInDays = (d) => Math.floor((Date.now() - new Date(d)) / (1000 * 60 * 60 * 24))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-playfair text-2xl font-bold text-charcoal">Contrats</h2>
        <label className="flex items-center gap-2 font-syne text-sm font-semibold text-charcoal/70 cursor-pointer select-none">
          <input type="checkbox" checked={pending} onChange={e => setPending(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
          En attente uniquement
        </label>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 mb-5">
        {[['ALL', 'Tous'], ['SHOP', 'Boutiques'], ['DRIVER', 'Livreurs']].map(([k, l]) => (
          <button key={k} onClick={() => setType(k)}
            className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
              type === k ? 'bg-charcoal text-white border-charcoal' : 'border-charcoal/20 text-charcoal/60 hover:border-charcoal/40'
            }`}>{l}</button>
        ))}
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
      ) : contracts.length === 0 ? (
        <div className="text-center py-16 text-charcoal/40">
          <p className="font-dm">Aucun contrat</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal/8">
                {['Partenaire', 'Type', 'Généré le', 'Ancienneté', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-4 text-left font-syne text-xs font-bold text-charcoal/50 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => {
                const age = ageInDays(c.generatedAt)
                const name = c.type === 'SHOP' ? c.shopName : c.driverName
                return (
                  <tr key={c.id} className="border-b border-charcoal/5 hover:bg-charcoal/2 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-syne text-sm font-bold text-charcoal">{name || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-xs font-bold px-2 py-0.5 rounded-full ${c.type === 'SHOP' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-dm text-xs text-charcoal/60">{fmtDate(c.generatedAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-sm font-bold ${AGE_COLOR(age)}`}>{age}j</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full ${
                        c.status === 'SIGNED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {c.status === 'SIGNED' ? 'Signé' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {c.status === 'PENDING_SIGNATURE' && (
                          <button
                            onClick={() => remind(c)}
                            disabled={acting === `remind-${c.id}`}
                            className="flex items-center gap-1 bg-blue-50 text-blue-700 font-syne text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          >
                            <Bell size={12} /> {acting === `remind-${c.id}` ? '…' : 'Relancer'}
                          </button>
                        )}
                        <button
                          onClick={() => regen(c)}
                          disabled={acting === `regen-${c.id}`}
                          className="flex items-center gap-1 bg-charcoal/5 text-charcoal/70 border border-charcoal/15 font-syne text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-charcoal/10 disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw size={12} /> {acting === `regen-${c.id}` ? '…' : 'Régénérer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
