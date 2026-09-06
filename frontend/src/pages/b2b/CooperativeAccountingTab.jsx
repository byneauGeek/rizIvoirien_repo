import { useEffect, useState } from 'react'
import { AlertCircle, BarChart2 } from 'lucide-react'
import { api } from '../../api/client'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

// LOT AUDIT-ACC-05/ACC-04 (audit XXX RIZ) : gap confirmé — aucun accès
// comptable scopé à UNE coopérative n'existait (le module accounting*.js est
// exclusivement ADMIN/COMMERCIAL, sur des données plateforme). Cette page lit
// GET /cooperative/accounting, scopé aux membres de LA coopérative appelante
// uniquement — jamais la comptabilité globale de la plateforme.
export default function CooperativeAccountingTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    api.get('/b2b/cooperative/accounting')
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

  const cards = [
    { label: 'Chiffre d\'affaires (ventes membres)', value: data.totalSales, positive: true },
    { label: 'Commissions perçues', value: -data.totalCommissions, positive: true },
    { label: 'Déjà versé aux membres', value: -data.totalPayments, positive: null },
    { label: 'Montant dû aux membres', value: data.totalDue, positive: data.totalDue >= 0 },
  ]

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-playfair text-2xl font-bold text-charcoal flex items-center gap-2"><BarChart2 size={22} /> Comptabilité de la coopérative</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white border border-charcoal/10 rounded-2xl p-4">
            <p className="font-dm text-xs text-charcoal/40 mb-1">{c.label}</p>
            <p className={`font-syne text-lg font-bold ${c.positive === null ? 'text-charcoal' : c.positive ? 'text-forest' : 'text-red-500'}`}>
              {fmt(c.value)} F
            </p>
          </div>
        ))}
      </div>

      <div>
        <p className="font-syne text-xs font-bold uppercase text-charcoal/40 mb-2">Détail par membre</p>
        {data.byMember.length === 0 ? (
          <div className="text-center py-12 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
            <p className="font-dm text-charcoal/40">Aucun mouvement pour l'instant.</p>
          </div>
        ) : (
          <div className="bg-white border border-charcoal/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal/6 text-left">
                  <th className="px-4 py-2.5 font-syne text-xs font-bold uppercase text-charcoal/40">Membre</th>
                  <th className="px-4 py-2.5 font-syne text-xs font-bold uppercase text-charcoal/40 text-right">Ventes</th>
                  <th className="px-4 py-2.5 font-syne text-xs font-bold uppercase text-charcoal/40 text-right">Commissions</th>
                  <th className="px-4 py-2.5 font-syne text-xs font-bold uppercase text-charcoal/40 text-right">Payé</th>
                  <th className="px-4 py-2.5 font-syne text-xs font-bold uppercase text-charcoal/40 text-right">Solde</th>
                </tr>
              </thead>
              <tbody>
                {data.byMember.map(m => (
                  <tr key={m.producerId} className="border-b border-charcoal/4 last:border-0">
                    <td className="px-4 py-2.5 font-dm text-charcoal">{m.name}</td>
                    <td className="px-4 py-2.5 font-dm text-right text-charcoal/70">{fmt(m.sales)}</td>
                    <td className="px-4 py-2.5 font-dm text-right text-charcoal/70">{fmt(m.commissions)}</td>
                    <td className="px-4 py-2.5 font-dm text-right text-charcoal/70">{fmt(m.payments)}</td>
                    <td className={`px-4 py-2.5 font-syne font-bold text-right ${m.balance >= 0 ? 'text-forest' : 'text-red-500'}`}>{fmt(m.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
