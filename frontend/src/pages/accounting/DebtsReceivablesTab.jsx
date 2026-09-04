import { useEffect, useState } from 'react'
import { AlertCircle, Plus, X, Coins } from 'lucide-react'
import { api } from '../../api/client'
import { fmt, fmtDate } from '../../utils/status'
import { DEBT_STATUS, badge } from './statusLabels'

function RecordPaymentForm({ kind, item, onDone, onCancel }) {
  const remaining = kind === 'debts' ? item.initialAmount - item.paidAmount : item.amount - item.receivedAmount
  const [amount, setAmount] = useState(remaining)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!amount || Number(amount) <= 0) return setError('Montant invalide.')
    setSubmitting(true)
    try {
      await api.post(`/accounting/${kind}/${item.id}/record-payment`, { amount: Number(amount) })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 pt-3 border-t border-charcoal/10 flex items-center gap-2 flex-wrap">
      {error && <p className="font-dm text-xs text-red-600 w-full">{error}</p>}
      <input type="number" min="0" max={remaining} step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
        className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-32" />
      <button type="submit" disabled={submitting}
        className="bg-forest text-cream font-syne text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50">
        {submitting ? '…' : 'Enregistrer le règlement'}
      </button>
      <button type="button" onClick={onCancel} className="font-dm text-xs text-charcoal/40">Annuler</button>
    </form>
  )
}

function CreateForm({ kind, onCreated, onCancel }) {
  const isDebt = kind === 'debts'
  const [form, setForm] = useState({ name: '', amount: '', description: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Nom du bénéficiaire/débiteur requis.')
    if (!form.amount || Number(form.amount) <= 0) return setError('Montant invalide.')
    setSubmitting(true)
    try {
      const payload = isDebt
        ? { beneficiaryName: form.name, initialAmount: Number(form.amount), sourceType: 'MANUAL', description: form.description }
        : { debtorName: form.name, amount: Number(form.amount), sourceType: 'MANUAL', description: form.description }
      await api.post(`/accounting/${kind}`, payload)
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border-2 border-charcoal/10 rounded-3xl p-6 space-y-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600">{error}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input placeholder={isDebt ? 'Bénéficiaire' : 'Débiteur'} value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        <input type="number" min="0" placeholder="Montant (FCFA)" value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
      </div>
      <textarea rows={2} placeholder="Description (optionnel)" value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm resize-none" />
      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="bg-forest text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-2xl disabled:opacity-50">
          {submitting ? 'Création…' : 'Créer'}
        </button>
        <button type="button" onClick={onCancel} className="font-dm text-sm text-charcoal/50 px-4 py-2.5">Annuler</button>
      </div>
    </form>
  )
}

export default function DebtsReceivablesTab({ permissions = [] }) {
  const [kind, setKind] = useState('debts') // 'debts' | 'receivables'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [payingId, setPayingId] = useState(null)

  const canCreate = permissions.includes('accounting.transactions.create')

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get(`/accounting/${kind}`)
      setItems(data[kind] || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDebt = kind === 'debts'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Comptabilité</p>
          <h1 className="font-playfair text-2xl font-bold text-charcoal">Dettes & Créances</h1>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(s => !s)}
            className="flex items-center gap-2 bg-forest text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-2xl">
            {showCreate ? <X size={16} /> : <Plus size={16} />}
            {showCreate ? 'Annuler' : `Nouvelle ${isDebt ? 'dette' : 'créance'}`}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => { setKind('debts'); setShowCreate(false) }}
          className={`font-syne text-sm font-bold px-4 py-2 rounded-2xl ${kind === 'debts' ? 'bg-charcoal text-cream' : 'bg-white border border-charcoal/10 text-charcoal/50'}`}>
          À payer
        </button>
        <button onClick={() => { setKind('receivables'); setShowCreate(false) }}
          className={`font-syne text-sm font-bold px-4 py-2 rounded-2xl ${kind === 'receivables' ? 'bg-charcoal text-cream' : 'bg-white border border-charcoal/10 text-charcoal/50'}`}>
          À recevoir
        </button>
      </div>

      {showCreate && <CreateForm kind={kind} onCreated={() => { setShowCreate(false); load() }} onCancel={() => setShowCreate(false)} />}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <Coins className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucune {isDebt ? 'dette' : 'créance'} pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const total = isDebt ? item.initialAmount : item.amount
            const done = isDebt ? item.paidAmount : item.receivedAmount
            const remaining = total - done
            const b = badge(DEBT_STATUS, item.status)
            const who = isDebt ? (item.beneficiaryName || `Utilisateur #${item.beneficiaryUserId}`) : (item.debtorName || `Utilisateur #${item.debtorUserId}`)
            return (
              <div key={item.id} className="bg-white border border-charcoal/10 rounded-2xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-syne font-bold text-charcoal text-sm">{who}</p>
                    <p className="font-dm text-xs text-charcoal/40">
                      {item.description || item.sourceType} · créée le {fmtDate(item.createdAt)}
                      {item.dueDate && ` · échéance ${fmtDate(item.dueDate)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-playfair text-lg font-bold text-charcoal">{fmt(remaining)} F <span className="text-xs font-normal text-charcoal/40">restant / {fmt(total)} F</span></p>
                    <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${b.color}`}>{b.label}</span>
                  </div>
                </div>
                {canCreate && !['PAID', 'CANCELLED'].includes(item.status) && (
                  payingId === item.id ? (
                    <RecordPaymentForm kind={kind} item={item} onDone={() => { setPayingId(null); load() }} onCancel={() => setPayingId(null)} />
                  ) : (
                    <button onClick={() => setPayingId(item.id)} className="mt-2 font-syne text-xs font-bold text-forest hover:text-forest-dark">
                      Enregistrer un règlement
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
