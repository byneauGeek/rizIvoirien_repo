import { useEffect, useState } from 'react'
import { AlertCircle, Wallet } from 'lucide-react'
import { api } from '../../api/client'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const LEDGER_TYPE_LABEL = { SALE_CREDIT: 'Vente', COMMISSION: 'Commission', PAYMENT: 'Paiement', ADJUSTMENT: 'Ajustement' }

// LOT AUDIT-ACC-05/PERM (audit XXX RIZ) : un membre (PRODUCER) n'avait aucun
// moyen de voir ce qu'il a vendu, gagné, ou ce qui lui reste dû — seule la
// coopérative pouvait consulter cette donnée depuis MembersTab.jsx. Self-service,
// jamais les données d'un autre membre (GET /my-ledger scope à req.user).
export default function MyAccountTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    api.get('/b2b/my-ledger')
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
  if (error) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 max-w-lg">
        <AlertCircle size={14} className="text-red-500 shrink-0" />
        <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
        <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-playfair text-2xl font-bold text-charcoal flex items-center gap-2"><Wallet size={22} /> Mon compte</h1>
      <div className="bg-forest/5 rounded-2xl px-6 py-5 flex items-center justify-between">
        <span className="font-dm text-sm text-charcoal/50">Solde actuel (dû par ma coopérative)</span>
        <span className={`font-syne text-2xl font-bold ${data.balance >= 0 ? 'text-forest' : 'text-red-500'}`}>{fmt(data.balance)} FCFA</span>
      </div>
      <div>
        <p className="font-syne text-xs font-bold uppercase text-charcoal/40 mb-2">Historique des mouvements</p>
        {data.entries.length === 0 ? (
          <div className="text-center py-12 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
            <p className="font-dm text-charcoal/40">Aucun mouvement pour l'instant.</p>
            <p className="font-dm text-xs text-charcoal/30 mt-1">Les ventes de vos marchandises apparaîtront ici, avec les paiements reçus.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {data.entries.map(e => (
              <div key={e.id} className="bg-white border border-charcoal/10 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-syne text-sm font-bold text-charcoal">{LEDGER_TYPE_LABEL[e.type] || e.type}</p>
                  {e.description && <p className="font-dm text-xs text-charcoal/40">{e.description}</p>}
                  <p className="font-dm text-[11px] text-charcoal/30">{new Date(e.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
                <span className={`font-syne font-bold ${e.amount >= 0 ? 'text-forest' : 'text-red-500'}`}>
                  {e.amount >= 0 ? '+' : ''}{fmt(e.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
