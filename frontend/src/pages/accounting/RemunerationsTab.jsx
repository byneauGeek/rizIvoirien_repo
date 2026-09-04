import { useEffect, useState } from 'react'
import { AlertCircle, Plus, X, Users, Search } from 'lucide-react'
import { api } from '../../api/client'
import { fmt, fmtDate } from '../../utils/status'
import { REMUNERATION_STATUS, badge } from './statusLabels'

const BENEFICIARY_TYPES = [
  { value: 'DRIVER', label: 'Livreur', role: 'DRIVER', auto: true },
  { value: 'SELLER', label: 'Vendeur', role: 'SELLER', auto: true },
  { value: 'COOPERATIVE', label: 'Coopérative', role: 'COOPERATIVE', auto: false },
  { value: 'EMPLOYEE', label: 'Employé', role: 'BUYER', auto: false },
]

function BeneficiaryPicker({ beneficiaryType, value, onChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const role = BENEFICIARY_TYPES.find(t => t.value === beneficiaryType)?.role

  const search = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    try {
      const data = await api.get(`/accounting/beneficiaries/search?role=${role}&q=${encodeURIComponent(query.trim())}`)
      setResults(data.users || [])
    } catch { /* affiché via l'erreur globale du formulaire parent */ }
  }

  return (
    <div>
      <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Bénéficiaire</label>
      {selected ? (
        <div className="flex items-center justify-between bg-cream border-2 border-forest/30 rounded-2xl px-4 py-2.5">
          <span className="font-dm text-sm text-charcoal">{selected.name} ({selected.email})</span>
          <button type="button" onClick={() => { setSelected(null); onChange(null) }} className="text-charcoal/40 hover:text-red-500">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher par nom ou email"
            className="flex-1 bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
          <button type="button" onClick={search} className="bg-charcoal text-cream rounded-2xl px-3"><Search size={14} /></button>
        </div>
      )}
      {!selected && results.length > 0 && (
        <div className="mt-2 space-y-1">
          {results.map(u => (
            <button key={u.id} type="button" onClick={() => { setSelected(u); onChange(u.id); setResults([]) }}
              className="w-full text-left bg-white border border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm hover:border-forest/40">
              {u.name} ({u.email})
            </button>
          ))}
        </div>
      )}
      {value && !selected && <input type="hidden" value={value} readOnly />}
    </div>
  )
}

function CalculateForm({ onCreated, onCancel }) {
  const [beneficiaryType, setBeneficiaryType] = useState('DRIVER')
  const [beneficiaryUserId, setBeneficiaryUserId] = useState(null)
  const [form, setForm] = useState({ periodStart: '', periodEnd: '', bonusAmount: '', penaltyAmount: '', advanceAmount: '', grossAmount: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isAuto = BENEFICIARY_TYPES.find(t => t.value === beneficiaryType)?.auto

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!beneficiaryUserId) return setError('Sélectionnez un bénéficiaire.')
    if (!form.periodStart || !form.periodEnd) return setError('Période requise.')
    if (!isAuto && (!form.grossAmount || Number(form.grossAmount) <= 0)) return setError('Montant brut requis pour ce type de bénéficiaire.')

    setSubmitting(true)
    try {
      const created = await api.post('/accounting/remunerations/calculate', {
        beneficiaryUserId, beneficiaryType,
        periodStart: form.periodStart, periodEnd: form.periodEnd,
        bonusAmount: form.bonusAmount || undefined,
        penaltyAmount: form.penaltyAmount || undefined,
        advanceAmount: form.advanceAmount || undefined,
        grossAmount: isAuto ? undefined : form.grossAmount,
      })
      onCreated(created)
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
      <div>
        <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Type de bénéficiaire</label>
        <select value={beneficiaryType} onChange={e => { setBeneficiaryType(e.target.value); setBeneficiaryUserId(null) }}
          className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm">
          {BENEFICIARY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {!isAuto && (
          <p className="font-dm text-xs text-charcoal/40 mt-1">
            La plateforme ne collecte pas les ventes de ce type d'acteur — le montant brut doit être saisi manuellement.
          </p>
        )}
      </div>

      <BeneficiaryPicker beneficiaryType={beneficiaryType} value={beneficiaryUserId} onChange={setBeneficiaryUserId} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Début de période</label>
          <input type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))}
            className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        </div>
        <div>
          <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Fin de période</label>
          <input type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))}
            className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        </div>
      </div>

      {!isAuto && (
        <div>
          <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Montant brut (FCFA)</label>
          <input type="number" min="0" value={form.grossAmount} onChange={e => setForm(f => ({ ...f, grossAmount: e.target.value }))}
            className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Bonus</label>
          <input type="number" min="0" value={form.bonusAmount} onChange={e => setForm(f => ({ ...f, bonusAmount: e.target.value }))}
            className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        </div>
        <div>
          <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Pénalité</label>
          <input type="number" min="0" value={form.penaltyAmount} onChange={e => setForm(f => ({ ...f, penaltyAmount: e.target.value }))}
            className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        </div>
        <div>
          <label className="font-syne text-xs font-bold uppercase text-charcoal/50 block mb-1.5">Avance</label>
          <input type="number" min="0" value={form.advanceAmount} onChange={e => setForm(f => ({ ...f, advanceAmount: e.target.value }))}
            className="w-full bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="bg-forest text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-2xl disabled:opacity-50">
          {submitting ? 'Calcul…' : 'Calculer'}
        </button>
        <button type="button" onClick={onCancel} className="font-dm text-sm text-charcoal/50 px-4 py-2.5">Annuler</button>
      </div>
    </form>
  )
}

function RemunerationRow({ rem, permissions, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')

  const canCreate = permissions.includes('accounting.payroll.create')
  const canValidate = permissions.includes('accounting.payroll.validate')
  const canPay = permissions.includes('accounting.payments.create')
  const b = badge(REMUNERATION_STATUS, rem.status)

  const act = async (action, body) => {
    setBusy(true)
    setError('')
    try {
      await api.post(`/accounting/remunerations/${rem.id}/${action}`, body)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border border-charcoal/10 rounded-2xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-syne font-bold text-charcoal text-sm">{rem.reference} — {rem.beneficiaryType}</p>
          <p className="font-dm text-xs text-charcoal/40">
            {fmtDate(rem.periodStart)} → {fmtDate(rem.periodEnd)} · brut {fmt(rem.grossAmount)} F
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-playfair text-lg font-bold text-charcoal">{fmt(rem.netAmount)} F net</p>
          <span className={`font-syne text-xs font-bold px-3 py-1 rounded-full ${b.color}`}>{b.label}</span>
        </div>
      </div>

      {error && <p className="font-dm text-xs text-red-600 mt-2">{error}</p>}

      <div className="flex gap-2 mt-3 flex-wrap">
        {rem.status === 'CALCULATED' && canCreate && (
          <>
            <button disabled={busy} onClick={() => act('submit')} className="font-syne text-xs font-bold text-forest hover:text-forest-dark disabled:opacity-50">Soumettre à validation</button>
            <button disabled={busy} onClick={() => act('cancel')} className="font-syne text-xs font-bold text-charcoal/40 hover:text-red-500 disabled:opacity-50">Annuler</button>
          </>
        )}
        {rem.status === 'PENDING_VALIDATION' && canValidate && (
          <>
            <button disabled={busy} onClick={() => act('validate')} className="font-syne text-xs font-bold text-forest hover:text-forest-dark disabled:opacity-50">Valider</button>
            <button disabled={busy} onClick={() => setShowReject(true)} className="font-syne text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50">Rejeter</button>
          </>
        )}
        {rem.status === 'PENDING_VALIDATION' && canCreate && (
          <button disabled={busy} onClick={() => act('cancel')} className="font-syne text-xs font-bold text-charcoal/40 hover:text-red-500 disabled:opacity-50">Annuler</button>
        )}
        {rem.status === 'VALIDATED' && canPay && (
          <button disabled={busy} onClick={() => act('create-payment-order')} className="font-syne text-xs font-bold text-forest hover:text-forest-dark disabled:opacity-50">Créer l'ordre de paiement</button>
        )}
      </div>

      {showReject && (
        <div className="mt-3 pt-3 border-t border-charcoal/10 flex gap-2 flex-wrap">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motif du rejet (obligatoire)"
            className="flex-1 bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm min-w-[200px]" />
          <button disabled={busy} onClick={() => act('reject', { reason })} className="bg-red-500 text-white font-syne text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50">Confirmer le rejet</button>
          <button onClick={() => setShowReject(false)} className="font-dm text-xs text-charcoal/40">Annuler</button>
        </div>
      )}
      {rem.status === 'REJECTED' && rem.rejectedReason && (
        <p className="font-dm text-xs text-red-500 mt-2 italic">Motif : {rem.rejectedReason}</p>
      )}
    </div>
  )
}

export default function RemunerationsTab({ permissions = [] }) {
  const [status, setStatus] = useState('')
  const [remunerations, setRemunerations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const canCreate = permissions.includes('accounting.payroll.create')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      const data = await api.get(`/accounting/remunerations?${params}`)
      setRemunerations(data.remunerations || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Comptabilité</p>
          <h1 className="font-playfair text-2xl font-bold text-charcoal">Rémunérations</h1>
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-2 bg-forest text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-2xl">
            {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Annuler' : 'Calculer une rémunération'}
          </button>
        )}
      </div>

      {showForm && <CalculateForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />}

      <div className="flex gap-2 flex-wrap">
        {['', ...Object.keys(REMUNERATION_STATUS)].map(s => (
          <button key={s || 'all'} onClick={() => setStatus(s)}
            className={`font-syne text-xs font-bold px-3 py-1.5 rounded-xl ${status === s ? 'bg-charcoal text-cream' : 'bg-white border border-charcoal/10 text-charcoal/50'}`}>
            {s ? badge(REMUNERATION_STATUS, s).label : 'Tous'}
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
      ) : remunerations.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <Users className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucune rémunération pour ces critères.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {remunerations.map(rem => (
            <RemunerationRow key={rem.id} rem={rem} permissions={permissions} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}
