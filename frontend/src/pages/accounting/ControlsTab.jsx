import { useEffect, useState } from 'react'
import { AlertCircle, ShieldAlert, CheckCircle2, RefreshCw, Clock } from 'lucide-react'
import { api } from '../../api/client'
import { fmt, fmtDate } from '../../utils/status'

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-charcoal/5">
      <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40 mb-3">{title}</p>
      {children}
    </div>
  )
}

function ConsistencySection() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = () => api.get('/accounting/controls/treasury-consistency').then(setData).catch(err => setError(err.message))
  useEffect(() => { load() }, [])

  if (error) return <Section title="Cohérence de trésorerie"><p className="font-dm text-xs text-red-600">{error}</p></Section>
  if (!data) return null

  return (
    <Section title="Cohérence de trésorerie">
      {data.anomalies > 0 && (
        <p className="font-dm text-xs text-red-600 mb-2 flex items-center gap-1.5"><ShieldAlert size={13} /> {data.anomalies} compte(s) incohérent(s)</p>
      )}
      <div className="space-y-1.5">
        {data.accounts.map(a => (
          <div key={a.accountId} className={`flex items-center justify-between px-3 py-2 rounded-xl ${a.consistent ? 'bg-cream' : 'bg-red-50'}`}>
            <span className="font-dm text-xs text-charcoal flex items-center gap-1.5">
              {a.consistent ? <CheckCircle2 size={13} className="text-green-600" /> : <ShieldAlert size={13} className="text-red-500" />}
              {a.name}
            </span>
            <span className="font-syne text-xs font-bold text-charcoal/60">
              {fmt(a.cachedBalance)} F {!a.consistent && <span className="text-red-600">(attendu {fmt(a.expectedBalance)} F)</span>}
            </span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function OverdueSection({ canManage }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = () => api.get('/accounting/controls/overdue').then(setData).catch(err => setError(err.message))
  useEffect(() => { load() }, [])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await api.post('/accounting/controls/overdue/refresh', {})
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  if (error) return <Section title="Dettes & créances échues"><p className="font-dm text-xs text-red-600">{error}</p></Section>
  if (!data) return null
  const total = data.debts.length + data.receivables.length

  return (
    <Section title="Dettes & créances échues">
      <div className="flex items-center justify-between mb-2">
        <p className="font-dm text-xs text-charcoal/50">{total} en retard</p>
        {canManage && (
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-1.5 font-syne text-xs font-bold text-forest disabled:opacity-50">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Rafraîchir les statuts
          </button>
        )}
      </div>
      {total === 0 ? <p className="font-dm text-xs text-charcoal/30 italic">Aucun retard</p> : (
        <div className="space-y-1">
          {data.debts.map(d => (
            <div key={`d${d.id}`} className="flex items-center justify-between bg-cream rounded-xl px-3 py-2">
              <span className="font-dm text-xs text-charcoal">Dette · {d.beneficiaryName || `#${d.beneficiaryUserId}`} · échue le {fmtDate(d.dueDate)}</span>
              <span className="font-syne text-xs font-bold text-red-600">{fmt(d.initialAmount - d.paidAmount)} F</span>
            </div>
          ))}
          {data.receivables.map(r => (
            <div key={`r${r.id}`} className="flex items-center justify-between bg-cream rounded-xl px-3 py-2">
              <span className="font-dm text-xs text-charcoal">Créance · {r.debtorName || `#${r.debtorUserId}`} · échue le {fmtDate(r.dueDate)}</span>
              <span className="font-syne text-xs font-bold text-red-600">{fmt(r.amount - r.receivedAmount)} F</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

function StalePaymentsSection() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/accounting/controls/stale-payments?hours=24').then(setData).catch(err => setError(err.message))
  }, [])

  if (error) return <Section title="Paiements en cours depuis longtemps"><p className="font-dm text-xs text-red-600">{error}</p></Section>
  if (!data) return null

  return (
    <Section title="Paiements en cours depuis longtemps">
      {data.payments.length === 0 ? (
        <p className="font-dm text-xs text-charcoal/30 italic">Aucun paiement bloqué</p>
      ) : (
        <div className="space-y-1">
          {data.payments.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2">
              <span className="font-dm text-xs text-charcoal flex items-center gap-1.5">
                <Clock size={12} className="text-amber-600" /> {p.reference} · {p.paymentOrder?.reference}
              </span>
              <span className="font-syne text-xs font-bold text-amber-700">{fmt(p.amount)} F</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

function ReconciliationSection({ canManage }) {
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/accounting/reconcilable-accounts').then(d => {
      setAccounts(d.accounts || [])
      if (d.accounts?.[0]) setAccountId(String(d.accounts[0].id))
    }).catch(err => setError(err.message))
  }, [])

  const load = async (id) => {
    if (!id) return
    try {
      const res = await api.get(`/accounting/treasury/accounts/${id}/reconciliation`)
      setData(res)
      setSelected([])
    } catch (err) {
      setError(err.message)
    }
  }
  useEffect(() => { load(accountId) }, [accountId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const markSelected = async () => {
    if (selected.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await api.post(`/accounting/treasury/accounts/${accountId}/reconcile`, { transactionIds: selected, reconciled: true })
      await load(accountId)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Rapprochement bancaire">
      {error && <p className="font-dm text-xs text-red-600 mb-2">{error}</p>}
      <select value={accountId} onChange={e => setAccountId(e.target.value)}
        className="bg-cream border border-charcoal/10 rounded-lg px-3 py-1.5 font-dm text-xs mb-3">
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 font-dm text-xs text-charcoal/50">
            <span>Rapproché : <strong className="text-charcoal">{fmt(data.reconciledTotal)} F</strong></span>
            <span>Non rapproché : <strong className="text-charcoal">{fmt(data.unreconciledTotal)} F</strong></span>
          </div>

          {canManage && data.unreconciled.length > 0 && (
            <button onClick={markSelected} disabled={busy || selected.length === 0}
              className="font-syne text-xs font-bold px-3 py-1.5 rounded-lg bg-forest text-cream disabled:opacity-40">
              Pointer la sélection ({selected.length})
            </button>
          )}

          <div className="space-y-1">
            {data.unreconciled.length === 0 ? (
              <p className="font-dm text-xs text-charcoal/30 italic">Tout est pointé</p>
            ) : data.unreconciled.map(t => (
              <label key={t.id} className="flex items-center gap-2 bg-cream rounded-xl px-3 py-2 cursor-pointer">
                {canManage && (
                  <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                )}
                <span className="font-dm text-xs text-charcoal flex-1">{t.reference} · {fmtDate(t.date)}</span>
                <span className={`font-syne text-xs font-bold ${t.direction === 'IN' ? 'text-green-600' : 'text-red-500'}`}>
                  {t.direction === 'IN' ? '+' : '−'}{fmt(t.amount)} F
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

export default function ControlsTab({ permissions = [] }) {
  const canAudit = permissions.includes('accounting.audit.view')
  const canReconcileView = permissions.includes('accounting.reconciliation.view')
  const canManage = permissions.includes('accounting.reconciliation.manage')

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Comptabilité</p>
        <h1 className="font-playfair text-2xl font-bold text-charcoal">Contrôles</h1>
        <p className="font-dm text-sm text-charcoal/50 mt-1">Rapprochement bancaire et vérifications de cohérence.</p>
      </div>

      {!canAudit && !canReconcileView && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-amber-600 shrink-0" />
          <p className="font-dm text-sm text-amber-700">Aucune permission de contrôle accordée.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {canAudit && <ConsistencySection />}
        {canReconcileView && <OverdueSection canManage={canManage} />}
        {canReconcileView && <StalePaymentsSection />}
        {canReconcileView && <ReconciliationSection canManage={canManage} />}
      </div>
    </div>
  )
}
