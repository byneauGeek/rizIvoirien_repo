import { useEffect, useState } from 'react'
import { AlertCircle, Search, ArrowUpRight, ArrowDownRight, Package } from 'lucide-react'
import { api } from '../../api/client'
import { fmt, fmtDate } from '../../utils/status'
import { TRANSACTION_TYPE_LABEL } from './statusLabels'

const TYPES = Object.keys(TRANSACTION_TYPE_LABEL)

export default function TransactionsTab() {
  const [filters, setFilters] = useState({ type: '', status: '', dateFrom: '', dateTo: '' })
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.type) params.set('type', filters.type)
      if (filters.status) params.set('status', filters.status)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      const data = await api.get(`/accounting/financial-transactions?${params}`)
      setTransactions(data.transactions || [])
      setTotal(data.total || 0)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => { e.preventDefault(); load() }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Comptabilité</p>
        <h1 className="font-playfair text-2xl font-bold text-charcoal">Transactions</h1>
        <p className="font-dm text-sm text-charcoal/50 mt-1">
          Le grand livre : chaque mouvement financier de la plateforme, quelle que soit son origine.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 bg-white border border-charcoal/10 rounded-2xl p-4">
        <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm">
          <option value="">Tous types</option>
          {TYPES.map(t => <option key={t} value={t}>{TRANSACTION_TYPE_LABEL[t]}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm">
          <option value="">Tous statuts</option>
          <option value="PENDING">En attente</option>
          <option value="CONFIRMED">Confirmée</option>
          <option value="CANCELLED">Annulée</option>
        </select>
        <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm" />
        <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm" />
        <button type="submit" className="flex items-center gap-1.5 bg-charcoal text-cream font-syne text-sm font-bold px-4 py-2 rounded-xl">
          <Search size={14} /> Filtrer
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <Package className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucune transaction pour ces critères.</p>
        </div>
      ) : (
        <>
          <p className="font-dm text-xs text-charcoal/40">{total} résultat{total > 1 ? 's' : ''}</p>
          <div className="space-y-2 overflow-x-auto">
            {transactions.map(tx => (
              <div key={tx.id} className="bg-white border border-charcoal/10 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tx.direction === 'IN' ? 'bg-green-50' : 'bg-red-50'}`}>
                    {tx.direction === 'IN'
                      ? <ArrowDownRight size={16} className="text-green-600" />
                      : <ArrowUpRight size={16} className="text-red-500" />}
                  </div>
                  <div>
                    <p className="font-syne font-bold text-charcoal text-sm">{TRANSACTION_TYPE_LABEL[tx.type] || tx.type}</p>
                    <p className="font-dm text-xs text-charcoal/40">{tx.reference} · {fmtDate(tx.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-playfair text-lg font-bold ${tx.direction === 'IN' ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.direction === 'IN' ? '+' : '−'}{fmt(tx.amount)} F
                  </p>
                  <p className="font-dm text-xs text-charcoal/40">{tx.status}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
