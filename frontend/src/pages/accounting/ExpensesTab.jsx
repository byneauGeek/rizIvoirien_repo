import { useEffect, useState } from 'react'
import { AlertCircle, Plus, X, Receipt, FileText } from 'lucide-react'
import { api, uploadAccountingDocument } from '../../api/client'
import { fmt, fmtDate } from '../../utils/status'
import { EXPENSE_STATUS, badge } from './statusLabels'

function DocumentsSection({ expenseId, permissions }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('RECEIPT')
  const [error, setError] = useState(null)
  const canView = permissions.includes('accounting.documents.view')
  const canUpload = permissions.includes('accounting.transactions.create')

  const load = async () => {
    try {
      const data = await api.get(`/accounting/documents?targetType=EXPENSE&targetId=${expenseId}`)
      setDocs(data.documents || [])
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  useEffect(() => { if (canView) load() }, [expenseId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await uploadAccountingDocument({ targetType: 'EXPENSE', targetId: expenseId, docType }, file)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (!canView) return null
  return (
    <div className="mt-3 pt-3 border-t border-charcoal/10 space-y-2">
      <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/30">Pièces justificatives</p>
      {error && <p className="font-dm text-xs text-red-600">{error}</p>}
      {loading ? (
        <p className="font-dm text-xs text-charcoal/30">Chargement…</p>
      ) : docs.length === 0 ? (
        <p className="font-dm text-xs text-charcoal/30 italic">Aucune pièce jointe</p>
      ) : (
        <div className="space-y-1">
          {docs.map(d => (
            <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 bg-cream rounded-xl px-3 py-2 hover:bg-charcoal/5">
              <FileText size={13} className="text-charcoal/40 shrink-0" />
              <span className="font-dm text-xs text-charcoal flex-1">{d.docType}</span>
              <span className="font-dm text-[10px] text-charcoal/30">{fmtDate(d.uploadedAt)}</span>
            </a>
          ))}
        </div>
      )}
      {canUpload && (
        <div className="flex items-center gap-2 flex-wrap">
          <select value={docType} onChange={e => setDocType(e.target.value)}
            className="bg-white border border-charcoal/10 rounded-lg px-2 py-1.5 font-dm text-xs">
            <option value="RECEIPT">Reçu</option>
            <option value="INVOICE">Facture</option>
            <option value="OTHER">Autre</option>
          </select>
          <label className={`font-syne text-xs font-bold px-3 py-1.5 rounded-lg bg-charcoal text-cream cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
            {uploading ? 'Envoi…' : 'Joindre un fichier'}
            <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleFile} disabled={uploading} className="hidden" />
          </label>
        </div>
      )}
    </div>
  )
}

const CATEGORIES = ['Loyer', 'Carburant', 'Fournitures', 'Salaires', 'Marketing', 'Maintenance', 'Autre']

function CreateForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ category: CATEGORIES[0], amount: '', supplier: '', description: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.amount || Number(form.amount) <= 0) return setError('Montant invalide.')
    setSubmitting(true)
    try {
      await api.post('/accounting/expenses', {
        category: form.category,
        amount: Number(form.amount),
        supplier: form.supplier || undefined,
        description: form.description || undefined,
      })
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
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <input type="number" min="0" placeholder="Montant (FCFA)" value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        <input placeholder="Fournisseur (optionnel)" value={form.supplier}
          onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm sm:col-span-2" />
      </div>
      <textarea rows={2} placeholder="Description (optionnel)" value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm resize-none" />
      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="bg-forest text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-2xl disabled:opacity-50">
          {submitting ? 'Création…' : 'Créer le brouillon'}
        </button>
        <button type="button" onClick={onCancel} className="font-dm text-sm text-charcoal/50 px-4 py-2.5">Annuler</button>
      </div>
    </form>
  )
}

function RejectPrompt({ onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  return (
    <div className="mt-3 pt-3 border-t border-charcoal/10 flex items-center gap-2 flex-wrap">
      <input placeholder="Motif du rejet" value={reason} onChange={e => setReason(e.target.value)}
        className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm flex-1 min-w-[180px]" />
      <button onClick={() => onConfirm(reason)} className="bg-red-500 text-white font-syne text-xs font-bold px-3 py-1.5 rounded-xl">Confirmer le rejet</button>
      <button onClick={onCancel} className="font-dm text-xs text-charcoal/40">Annuler</button>
    </div>
  )
}

function CreatePaymentOrderForm({ expense, onDone, onCancel }) {
  const [beneficiaryName, setBeneficiaryName] = useState(expense.supplier || '')
  const [reason, setReason] = useState(`Dépense ${expense.reference} — ${expense.category}`)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!beneficiaryName.trim()) return setError('Bénéficiaire requis.')
    setSubmitting(true)
    try {
      await api.post('/accounting/payment-orders', {
        beneficiaryName: beneficiaryName.trim(),
        amount: expense.amount,
        reason: reason.trim(),
        sourceType: 'EXPENSE',
        sourceId: expense.id,
      })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 pt-3 border-t border-charcoal/10 space-y-2">
      {error && <p className="font-dm text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <input placeholder="Bénéficiaire" value={beneficiaryName} onChange={e => setBeneficiaryName(e.target.value)}
          className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm flex-1 min-w-[160px]" />
        <input placeholder="Motif" value={reason} onChange={e => setReason(e.target.value)}
          className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm flex-1 min-w-[200px]" />
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={submitting}
          className="bg-forest text-cream font-syne text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50">
          {submitting ? '…' : "Créer l'ordre de paiement"}
        </button>
        <button type="button" onClick={onCancel} className="font-dm text-xs text-charcoal/40">Annuler</button>
      </div>
    </form>
  )
}

export default function ExpensesTab({ permissions = [] }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [rejectingId, setRejectingId] = useState(null)
  const [payingId, setPayingId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const canCreate = permissions.includes('accounting.transactions.create')
  const canValidate = permissions.includes('accounting.transactions.validate')
  const canPay = permissions.includes('accounting.payments.create')

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/accounting/expenses')
      setExpenses(data.expenses || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const act = async (id, action, body) => {
    setBusyId(id)
    try {
      await api.post(`/accounting/expenses/${id}/${action}`, body)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
      setRejectingId(null)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Supprimer ce brouillon de dépense ?')) return
    setBusyId(id)
    try {
      await api.delete(`/accounting/expenses/${id}`)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Comptabilité</p>
          <h1 className="font-playfair text-2xl font-bold text-charcoal">Dépenses</h1>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(s => !s)}
            className="flex items-center gap-2 bg-forest text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-2xl">
            {showCreate ? <X size={16} /> : <Plus size={16} />}
            {showCreate ? 'Annuler' : 'Nouvelle dépense'}
          </button>
        )}
      </div>

      {showCreate && <CreateForm onCreated={() => { setShowCreate(false); load() }} onCancel={() => setShowCreate(false)} />}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <Receipt className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucune dépense pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map(exp => {
            const b = badge(EXPENSE_STATUS, exp.status)
            const busy = busyId === exp.id
            return (
              <div key={exp.id} className="bg-white border border-charcoal/10 rounded-2xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-syne font-bold text-charcoal text-sm">{exp.reference} · {exp.category}</p>
                    <p className="font-dm text-xs text-charcoal/40">
                      {exp.supplier ? `${exp.supplier} · ` : ''}{fmtDate(exp.date)}
                      {exp.description && ` · ${exp.description}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-playfair text-lg font-bold text-charcoal">{fmt(exp.amount)} F</p>
                    <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${b.color}`}>{b.label}</span>
                  </div>
                </div>

                {canCreate && exp.status === 'DRAFT' && (
                  <div className="flex items-center gap-3 mt-2">
                    <button disabled={busy} onClick={() => act(exp.id, 'submit')}
                      className="font-syne text-xs font-bold text-forest hover:text-forest-dark disabled:opacity-50">
                      Soumettre pour validation
                    </button>
                    <button disabled={busy} onClick={() => remove(exp.id)}
                      className="font-syne text-xs font-bold text-red-500 hover:text-red-600 disabled:opacity-50">
                      Supprimer
                    </button>
                  </div>
                )}

                {canValidate && exp.status === 'PENDING_VALIDATION' && (
                  rejectingId === exp.id ? (
                    <RejectPrompt onConfirm={(reason) => act(exp.id, 'reject', { reason })} onCancel={() => setRejectingId(null)} />
                  ) : (
                    <div className="flex items-center gap-3 mt-2">
                      <button disabled={busy} onClick={() => act(exp.id, 'validate')}
                        className="font-syne text-xs font-bold text-forest hover:text-forest-dark disabled:opacity-50">
                        Valider
                      </button>
                      <button disabled={busy} onClick={() => setRejectingId(exp.id)}
                        className="font-syne text-xs font-bold text-red-500 hover:text-red-600 disabled:opacity-50">
                        Rejeter
                      </button>
                    </div>
                  )
                )}

                {canPay && exp.status === 'VALIDATED' && (
                  payingId === exp.id ? (
                    <CreatePaymentOrderForm expense={exp} onDone={() => { setPayingId(null); load() }} onCancel={() => setPayingId(null)} />
                  ) : (
                    <button onClick={() => setPayingId(exp.id)} className="mt-2 font-syne text-xs font-bold text-forest hover:text-forest-dark">
                      Créer l'ordre de paiement
                    </button>
                  )
                )}

                <DocumentsSection expenseId={exp.id} permissions={permissions} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
