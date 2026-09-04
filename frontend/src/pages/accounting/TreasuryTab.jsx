import { useEffect, useState } from 'react'
import { AlertCircle, Plus, X, Wallet, Landmark, Smartphone, Coins } from 'lucide-react'
import { api } from '../../api/client'
import { fmt, fmtDate } from '../../utils/status'

const TYPE_ICON = { CAISSE: Coins, BANQUE: Landmark, MOBILE_MONEY: Smartphone, AUTRE: Wallet }
const TYPE_LABEL = { CAISSE: 'Caisse', BANQUE: 'Banque', MOBILE_MONEY: 'Mobile Money', AUTRE: 'Autre' }

function CreateAccountForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ name: '', type: 'CAISSE' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Nom requis.')
    setSubmitting(true)
    try {
      await api.post('/accounting/treasury/accounts', form)
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border-2 border-charcoal/10 rounded-3xl p-6 space-y-4">
      {error && <p className="font-dm text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input placeholder="Nom du compte" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm" />
        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm">
          {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="bg-forest text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-2xl disabled:opacity-50">
          {submitting ? 'Création…' : 'Créer le compte'}
        </button>
        <button type="button" onClick={onCancel} className="font-dm text-sm text-charcoal/50 px-4 py-2.5">Annuler</button>
      </div>
    </form>
  )
}

function AccountCard({ account, onSelect, selected }) {
  const Icon = TYPE_ICON[account.type] || Wallet
  return (
    <button onClick={() => onSelect(account)}
      className={`text-left bg-white rounded-3xl p-5 border-2 transition-colors ${selected ? 'border-forest' : 'border-charcoal/5 hover:border-charcoal/15'}`}>
      <div className="w-10 h-10 bg-forest/10 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={18} className="text-forest" />
      </div>
      <p className="font-playfair text-2xl font-bold text-charcoal">{fmt(account.balance)} F</p>
      <p className="font-syne text-xs font-bold text-charcoal/60 mt-2">{account.name}</p>
      <p className="font-dm text-xs text-charcoal/40">{TYPE_LABEL[account.type]}{!account.active && ' · Désactivé'}</p>
    </button>
  )
}

export default function TreasuryTab({ permissions = [] }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)

  const canManage = permissions.includes('accounting.treasury.manage')

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/accounting/treasury/accounts')
      setAccounts(data.accounts || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const selectAccount = async (account) => {
    setSelected(account)
    try {
      const detail = await api.get(`/accounting/treasury/accounts/${account.id}`)
      setSelectedDetail(detail)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Comptabilité</p>
          <h1 className="font-playfair text-2xl font-bold text-charcoal">Trésorerie</h1>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(s => !s)}
            className="flex items-center gap-2 bg-forest text-cream font-syne text-sm font-bold px-4 py-2.5 rounded-2xl">
            {showCreate ? <X size={16} /> : <Plus size={16} />} {showCreate ? 'Annuler' : 'Nouveau compte'}
          </button>
        )}
      </div>

      {showCreate && <CreateAccountForm onCreated={() => { setShowCreate(false); load() }} onCancel={() => setShowCreate(false)} />}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <Wallet className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucun compte de trésorerie.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(a => <AccountCard key={a.id} account={a} onSelect={selectAccount} selected={selected?.id === a.id} />)}
        </div>
      )}

      {selectedDetail && (
        <div className="bg-white border border-charcoal/10 rounded-2xl p-5">
          <h3 className="font-syne font-bold text-charcoal mb-3">Mouvements récents — {selectedDetail.name}</h3>
          {selectedDetail.transactions.length === 0 ? (
            <p className="font-dm text-sm text-charcoal/40">Aucun mouvement sur ce compte.</p>
          ) : (
            <div className="space-y-1.5">
              {selectedDetail.transactions.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-cream rounded-xl px-3 py-2">
                  <span className="font-dm text-xs text-charcoal">{t.reference} · {fmtDate(t.date)}</span>
                  <span className={`font-syne text-xs font-bold ${t.direction === 'IN' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.direction === 'IN' ? '+' : '−'}{fmt(t.amount)} F
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
