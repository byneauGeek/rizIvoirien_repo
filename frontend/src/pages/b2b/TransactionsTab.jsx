import { useEffect, useState } from 'react'
import { AlertCircle, DollarSign } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

export default function TransactionsTab() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/b2b/transactions')
      setTransactions(data.transactions || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const cancel = async (id) => {
    setBusyId(id)
    try {
      await api.post(`/b2b/transactions/${id}/cancel`)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-playfair text-2xl font-bold text-charcoal">Mes transactions déclarées</h1>
      <p className="font-dm text-sm text-charcoal/40 -mt-4">
        Un simple constat d'accord commercial — aucun paiement ne transite par la plateforme.
      </p>

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
          <DollarSign className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucune transaction déclarée pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map(tx => {
            const iAmBuyer = tx.buyerUserId === user.id
            return (
              <div key={tx.id} className="bg-white border border-charcoal/10 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-syne font-bold text-charcoal text-sm">
                    {tx.product} — {fmt(tx.quantity)} {tx.unit}
                  </p>
                  <p className="font-dm text-xs text-charcoal/40">
                    {iAmBuyer ? `Vendeur : ${tx.seller.name}` : `Acheteur : ${tx.buyer.name}`} · {fmtDate(tx.createdAt)}
                  </p>
                  {tx.amount != null && <p className="font-dm text-sm text-charcoal/60 mt-1">{fmt(tx.amount)} FCFA</p>}
                  {tx.notes && <p className="font-dm text-xs text-charcoal/40 mt-1 italic">{tx.notes}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${
                    tx.status === 'DECLARED' ? 'text-green-600 bg-green-50' : 'text-charcoal/40 bg-charcoal/5'
                  }`}>
                    {tx.status === 'DECLARED' ? 'Déclarée' : 'Annulée'}
                  </span>
                  {tx.status === 'DECLARED' && (
                    <button onClick={() => cancel(tx.id)} disabled={busyId === tx.id}
                      className="font-syne text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50">
                      {busyId === tx.id ? '…' : 'Annuler'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
