import { useEffect, useState } from 'react'
import { AlertCircle, Package, ChevronDown, ChevronUp, Check, X, Pause, Play, Ban } from 'lucide-react'
import { api } from '../../api/client'
import { fmt, fmtDate } from '../../utils/status'
import { PAYMENT_ORDER_STATUS, PAYMENT_STATUS, badge } from './statusLabels'

const CONTROLLABLE = ['PENDING_CONTROL', 'ON_HOLD']
const EXECUTABLE = ['PENDING_PAYMENT', 'FAILED']
const CANCELLABLE = ['PENDING_CONTROL', 'ON_HOLD', 'PENDING_PAYMENT', 'FAILED']

function ReasonPrompt({ label, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap bg-cream rounded-xl p-2">
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motif…"
        className="flex-1 min-w-[160px] bg-white border border-charcoal/10 rounded-lg px-2.5 py-1.5 font-dm text-xs" />
      <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim()}
        className="font-syne text-xs font-bold px-3 py-1.5 rounded-lg bg-charcoal text-cream disabled:opacity-40">{label}</button>
      <button onClick={onCancel} className="font-dm text-xs text-charcoal/40">Annuler</button>
    </div>
  )
}

function ExecuteForm({ accounts, onExecute, onCancel }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [method, setMethod] = useState('BANK_TRANSFER')
  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap bg-cream rounded-xl p-2">
      <select value={accountId} onChange={e => setAccountId(e.target.value)}
        className="bg-white border border-charcoal/10 rounded-lg px-2.5 py-1.5 font-dm text-xs">
        {accounts.length === 0 && <option value="">Aucun compte actif</option>}
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance)} F)</option>)}
      </select>
      <select value={method} onChange={e => setMethod(e.target.value)}
        className="bg-white border border-charcoal/10 rounded-lg px-2.5 py-1.5 font-dm text-xs">
        <option value="BANK_TRANSFER">Virement bancaire</option>
        <option value="MOBILE_MONEY">Mobile Money</option>
        <option value="CASH">Espèces</option>
        <option value="OTHER">Autre</option>
      </select>
      <button onClick={() => accountId && onExecute(accountId, method)} disabled={!accountId}
        className="font-syne text-xs font-bold px-3 py-1.5 rounded-lg bg-forest text-cream disabled:opacity-40">Exécuter</button>
      <button onClick={onCancel} className="font-dm text-xs text-charcoal/40">Annuler</button>
    </div>
  )
}

function OrderDetail({ order, permissions, accounts, onAction, busy }) {
  const canExecute = permissions.includes('accounting.payments.execute')
  const canCancel = permissions.includes('accounting.payments.cancel')
  const [prompt, setPrompt] = useState(null) // 'reject' | 'hold' | 'cancel' | 'execute' | null

  const processingPayment = order.payments?.find(p => p.status === 'PROCESSING')

  return (
    <div className="mt-3 pt-3 border-t border-charcoal/10 space-y-3">
      {order.remuneration && (
        <p className="font-dm text-xs text-charcoal/50">
          Rémunération liée : <span className="font-bold text-charcoal">{order.remuneration.reference}</span> ({fmt(order.remuneration.netAmount)} F net)
        </p>
      )}
      {order.rejectedReason && <p className="font-dm text-xs text-red-600">Motif : {order.rejectedReason}</p>}
      {order.holdReason && <p className="font-dm text-xs text-orange-600">Motif de mise en attente : {order.holdReason}</p>}

      {order.payments?.length > 0 && (
        <div className="space-y-1">
          <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/30">Tentatives de paiement</p>
          {order.payments.map(p => {
            const pb = badge(PAYMENT_STATUS, p.status)
            return (
              <div key={p.id} className="flex items-center justify-between bg-cream rounded-xl px-3 py-2">
                <span className="font-dm text-xs text-charcoal">{p.reference} · {p.method}{p.failureReason ? ` · ${p.failureReason}` : ''}</span>
                <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full ${pb.color}`}>{pb.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {canExecute && CONTROLLABLE.includes(order.status) && !prompt && (
        <div className="flex items-center gap-2 flex-wrap">
          <button disabled={busy} onClick={() => onAction('control', { decision: 'APPROVE' })}
            className="flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1.5 rounded-lg bg-forest text-cream disabled:opacity-40">
            <Check size={13} /> Approuver
          </button>
          {order.status === 'PENDING_CONTROL' && (
            <button disabled={busy} onClick={() => setPrompt('hold')}
              className="flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 disabled:opacity-40">
              <Pause size={13} /> Mettre en attente
            </button>
          )}
          {order.status === 'ON_HOLD' && (
            <button disabled={busy} onClick={() => onAction('control', { decision: 'RELEASE' })}
              className="flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 disabled:opacity-40">
              <Play size={13} /> Libérer
            </button>
          )}
          <button disabled={busy} onClick={() => setPrompt('reject')}
            className="flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 disabled:opacity-40">
            <X size={13} /> Rejeter
          </button>
        </div>
      )}
      {prompt === 'reject' && (
        <ReasonPrompt label="Confirmer le rejet" onCancel={() => setPrompt(null)}
          onConfirm={(reason) => { setPrompt(null); onAction('control', { decision: 'REJECT', reason }) }} />
      )}
      {prompt === 'hold' && (
        <ReasonPrompt label="Confirmer la mise en attente" onCancel={() => setPrompt(null)}
          onConfirm={(reason) => { setPrompt(null); onAction('control', { decision: 'HOLD', reason }) }} />
      )}

      {canExecute && EXECUTABLE.includes(order.status) && !processingPayment && (
        prompt === 'execute' ? (
          <ExecuteForm accounts={accounts} onCancel={() => setPrompt(null)}
            onExecute={(accountId, method) => { setPrompt(null); onAction('execute', { accountId, method }) }} />
        ) : (
          <button disabled={busy} onClick={() => setPrompt('execute')}
            className="font-syne text-xs font-bold px-3 py-1.5 rounded-lg bg-forest text-cream disabled:opacity-40">
            Exécuter le paiement
          </button>
        )
      )}

      {canExecute && processingPayment && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-dm text-xs text-charcoal/50">Paiement {processingPayment.reference} en cours de confirmation :</span>
          <button disabled={busy} onClick={() => onAction('confirm', { paymentId: processingPayment.id, outcome: 'PAID' })}
            className="flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1.5 rounded-lg bg-forest text-cream disabled:opacity-40">
            <Check size={13} /> Confirmer le succès
          </button>
          <button disabled={busy} onClick={() => setPrompt('fail')}
            className="flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 disabled:opacity-40">
            <X size={13} /> Signaler un échec
          </button>
        </div>
      )}
      {prompt === 'fail' && (
        <ReasonPrompt label="Confirmer l'échec" onCancel={() => setPrompt(null)}
          onConfirm={(reason) => { setPrompt(null); onAction('confirm', { paymentId: processingPayment.id, outcome: 'FAILED', failureReason: reason }) }} />
      )}

      {canCancel && CANCELLABLE.includes(order.status) && prompt !== 'cancel' && (
        <button disabled={busy} onClick={() => setPrompt('cancel')}
          className="flex items-center gap-1.5 font-syne text-xs font-bold text-charcoal/40 hover:text-red-600">
          <Ban size={13} /> Annuler l'ordre
        </button>
      )}
      {prompt === 'cancel' && (
        <ReasonPrompt label="Confirmer l'annulation" onCancel={() => setPrompt(null)}
          onConfirm={(reason) => { setPrompt(null); onAction('cancel', { reason }) }} />
      )}
    </div>
  )
}

export default function PaymentOrdersTab({ permissions = [] }) {
  const [status, setStatus] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [busy, setBusy] = useState(false)

  const canExecute = permissions.includes('accounting.payments.execute')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      const data = await api.get(`/accounting/payment-orders?${params}`)
      setOrders(data.orders || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (canExecute) api.get('/accounting/payable-accounts').then(d => setAccounts(d.accounts || [])).catch(() => {})
  }, [canExecute])

  const loadDetail = async (id) => {
    try {
      const data = await api.get(`/accounting/payment-orders/${id}`)
      setDetail(data)
    } catch (err) {
      setError(err.message)
    }
  }

  const toggleExpand = (order) => {
    if (expandedId === order.id) { setExpandedId(null); return }
    setExpandedId(order.id)
    loadDetail(order.id)
  }

  const handleAction = async (type, payload) => {
    setBusy(true)
    setError(null)
    try {
      if (type === 'control') {
        await api.post(`/accounting/payment-orders/${expandedId}/control`, payload)
      } else if (type === 'cancel') {
        await api.post(`/accounting/payment-orders/${expandedId}/cancel`, payload)
      } else if (type === 'execute') {
        await api.post(`/accounting/payment-orders/${expandedId}/execute`, payload)
        const acc = await api.get('/accounting/payable-accounts')
        setAccounts(acc.accounts || [])
      } else if (type === 'confirm') {
        const { paymentId, ...body } = payload
        await api.post(`/accounting/payments/${paymentId}/confirm`, body)
        const acc = await api.get('/accounting/payable-accounts')
        setAccounts(acc.accounts || [])
      }
      await Promise.all([load(), loadDetail(expandedId)])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Comptabilité</p>
        <h1 className="font-playfair text-2xl font-bold text-charcoal">Ordres de paiement</h1>
        <p className="font-dm text-sm text-charcoal/50 mt-1">
          Contrôlez, exécutez ou annulez chaque ordre. Le solde de trésorerie n'est débité qu'à la confirmation du paiement.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', ...Object.keys(PAYMENT_ORDER_STATUS)].map(s => (
          <button key={s || 'all'} onClick={() => setStatus(s)}
            className={`font-syne text-xs font-bold px-3 py-1.5 rounded-xl ${status === s ? 'bg-charcoal text-cream' : 'bg-white border border-charcoal/10 text-charcoal/50'}`}>
            {s ? badge(PAYMENT_ORDER_STATUS, s).label : 'Tous'}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <Package className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucun ordre de paiement.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => {
            const b = badge(PAYMENT_ORDER_STATUS, order.status)
            return (
              <div key={order.id} className="bg-white border border-charcoal/10 rounded-2xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-3 cursor-pointer" onClick={() => toggleExpand(order)}>
                  <div>
                    <p className="font-syne font-bold text-charcoal text-sm">{order.reference}</p>
                    <p className="font-dm text-xs text-charcoal/40">
                      {order.beneficiaryName || `Utilisateur #${order.beneficiaryUserId}`} · {order.reason} · {fmtDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-playfair text-lg font-bold text-charcoal">{fmt(order.amount)} F</p>
                    <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${b.color}`}>{b.label}</span>
                    {expandedId === order.id ? <ChevronUp size={16} className="text-charcoal/40" /> : <ChevronDown size={16} className="text-charcoal/40" />}
                  </div>
                </div>
                {expandedId === order.id && detail?.id === order.id && (
                  <OrderDetail order={detail} permissions={permissions} accounts={accounts} busy={busy} onAction={handleAction} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
