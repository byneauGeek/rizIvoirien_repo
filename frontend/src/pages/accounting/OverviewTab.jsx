import { useEffect, useState } from 'react'
import { AlertCircle, Wallet, ArrowDownCircle, ArrowUpCircle, Coins, Landmark, Users } from 'lucide-react'
import { api } from '../../api/client'
import { fmt } from '../../utils/status'

function Tile({ icon: Icon, label, value, sub, color, bg, onClick }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`text-left bg-white rounded-3xl p-5 shadow-sm border border-charcoal/5 ${onClick ? 'hover:border-forest/30 cursor-pointer' : 'cursor-default'} transition-colors`}>
      <div className={`w-10 h-10 ${bg} rounded-2xl flex items-center justify-center mb-4`}>
        <Icon size={18} className={color} />
      </div>
      <p className="font-playfair text-2xl font-bold text-charcoal">{value}</p>
      {sub && <p className="font-dm text-xs text-charcoal/40 mt-0.5">{sub}</p>}
      <p className="font-syne text-xs font-bold text-charcoal/60 mt-2">{label}</p>
    </button>
  )
}

function StatusRow({ label, counts }) {
  const entries = Object.entries(counts || {})
  if (entries.length === 0) return <p className="font-dm text-xs text-charcoal/30 italic">Aucune donnée</p>
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([status, count]) => (
        <span key={status} className="font-syne text-[10px] font-bold px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/60">
          {status} · {count}
        </span>
      ))}
    </div>
  )
}

export default function OverviewTab({ onNavigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.get('/accounting/dashboard').then(setData).catch(err => setError(err.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  if (loading) return <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
  if (error) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
        <AlertCircle size={14} className="text-red-500 shrink-0" />
        <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
        <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Comptabilité</p>
        <h1 className="font-playfair text-3xl font-bold text-charcoal">Vue d'ensemble</h1>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Tile icon={Wallet} label="Trésorerie totale" value={`${fmt(data.treasury.totalBalance)} F`}
          sub={`${data.treasury.accounts.length} compte${data.treasury.accounts.length > 1 ? 's' : ''}`}
          color="text-forest" bg="bg-forest/10" onClick={() => onNavigate('treasury')} />
        <Tile icon={ArrowUpCircle} label="Encaissements du jour" value={`${fmt(data.today.encaissements)} F`}
          color="text-green-600" bg="bg-green-50" onClick={() => onNavigate('transactions')} />
        <Tile icon={ArrowDownCircle} label="Décaissements du jour" value={`${fmt(data.today.decaissements)} F`}
          color="text-terra" bg="bg-terra/10" onClick={() => onNavigate('transactions')} />
        <Tile icon={Coins} label="Dettes à payer" value={`${fmt(data.debts.totalDue)} F`}
          color="text-amber-600" bg="bg-amber-50" onClick={() => onNavigate('debts')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Tile icon={Landmark} label="Créances à recevoir" value={`${fmt(data.receivables.totalDue)} F`}
          color="text-blue-600" bg="bg-blue-50" onClick={() => onNavigate('debts')} />
        <Tile icon={Users} label="Rémunérations en attente de paiement" value={
          (data.remunerationsByStatus.PAYMENT_PENDING || 0) + (data.remunerationsByStatus.PAYMENT_PROCESSING || 0)
        } color="text-indigo-600" bg="bg-indigo-50" onClick={() => onNavigate('remunerations')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-charcoal/5">
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-3">Paiements</p>
          <StatusRow counts={data.paymentsByStatus} />
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-charcoal/5">
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-3">Ordres de paiement</p>
          <StatusRow counts={data.paymentOrdersByStatus} />
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-charcoal/5">
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-3">Rémunérations</p>
          <StatusRow counts={data.remunerationsByStatus} />
        </div>
      </div>
    </div>
  )
}
