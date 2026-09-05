import { useEffect, useState } from 'react'
import { AlertCircle, Download, FileBarChart } from 'lucide-react'
import { api, downloadFile } from '../../api/client'
import { fmt } from '../../utils/status'

const EXPORTS = [
  { type: 'transactions', label: 'Transactions' },
  { type: 'payments', label: 'Paiements' },
  { type: 'remunerations', label: 'Rémunérations' },
  { type: 'debts', label: 'Dettes' },
  { type: 'receivables', label: 'Créances' },
]

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-charcoal/5">
      <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-3">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, count, total }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-charcoal/5 last:border-0">
      <span className="font-dm text-sm text-charcoal/60">{label} <span className="text-charcoal/30">· {count}</span></span>
      <span className="font-syne text-sm font-bold text-charcoal">{fmt(total)} F</span>
    </div>
  )
}

export default function ReportsTab({ permissions = [] }) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(null)

  const canExport = permissions.includes('accounting.documents.export')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await api.get(`/accounting/reports/summary?${params}`)
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = async (type) => {
    setExporting(type)
    setError(null)
    try {
      const params = new URLSearchParams({ type })
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      await downloadFile(`/accounting/reports/export?${params}`, `${type}-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Comptabilité</p>
        <h1 className="font-playfair text-2xl font-bold text-charcoal">Rapports</h1>
        <p className="font-dm text-sm text-charcoal/50 mt-1">Vue agrégée sur une période, et export brut pour un contrôle externe.</p>
      </div>

      <div className="flex items-end gap-3 flex-wrap bg-white rounded-2xl p-4 border border-charcoal/5">
        <div>
          <label className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40">Du</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="block bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm mt-1" />
        </div>
        <div>
          <label className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40">Au</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="block bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm mt-1" />
        </div>
        <button onClick={load} className="bg-charcoal text-cream font-syne text-xs font-bold px-4 py-2 rounded-xl">Appliquer</button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Trésorerie">
            <p className="font-playfair text-2xl font-bold text-charcoal mb-2">{fmt(data.treasury.totalBalance)} F</p>
            {data.treasury.accounts.map(a => <Row key={a.id} label={a.name} count={a.type} total={a.balance} />)}
          </Card>
          <Card title="Transactions (grand livre)">
            {data.transactions.length === 0
              ? <p className="font-dm text-xs text-charcoal/30 italic">Aucune donnée</p>
              : data.transactions.map((t, i) => <Row key={i} label={`${t.type} (${t.direction})`} count={t.count} total={t.total} />)}
          </Card>
          <Card title="Rémunérations">
            {data.remunerations.length === 0
              ? <p className="font-dm text-xs text-charcoal/30 italic">Aucune donnée</p>
              : data.remunerations.map((r, i) => <Row key={i} label={r.status} count={r.count} total={r.total} />)}
          </Card>
          <Card title="Paiements">
            {data.payments.length === 0
              ? <p className="font-dm text-xs text-charcoal/30 italic">Aucune donnée</p>
              : data.payments.map((p, i) => <Row key={i} label={p.status} count={p.count} total={p.total} />)}
          </Card>
          <Card title="Dettes">
            <Row label="Ouvertes sur la période" count={data.debts.opened.count} total={data.debts.opened.total} />
            <Row label="Soldées sur la période" count={data.debts.settled.count} total={data.debts.settled.total} />
          </Card>
          <Card title="Créances">
            <Row label="Ouvertes sur la période" count={data.receivables.opened.count} total={data.receivables.opened.total} />
            <Row label="Soldées sur la période" count={data.receivables.settled.count} total={data.receivables.settled.total} />
          </Card>
        </div>
      )}

      {canExport && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-charcoal/5">
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-3 flex items-center gap-2">
            <FileBarChart size={14} /> Export CSV
          </p>
          <div className="flex flex-wrap gap-2">
            {EXPORTS.map(({ type, label }) => (
              <button key={type} disabled={exporting === type} onClick={() => handleExport(type)}
                className="flex items-center gap-1.5 bg-cream border border-charcoal/10 font-syne text-xs font-bold px-3 py-1.5 rounded-xl text-charcoal/70 hover:border-forest/30 disabled:opacity-50">
                <Download size={12} /> {exporting === type ? 'Export…' : label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
