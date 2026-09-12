import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Plus, Trash2, Power, Package, Building2, CheckCircle,
  XCircle, X, AlertCircle, Store, Sprout,
} from 'lucide-react'

const RULE_TYPES = [
  { id: 'MIN_PRICE',              label: 'Prix minimum',               paramsHint: '{"min": 500}' },
  { id: 'MAX_PRICE',               label: 'Prix maximum',               paramsHint: '{"max": 100000}' },
  { id: 'MIN_IMAGES',             label: "Nombre minimum d'images",    paramsHint: '{"min": 1}' },
  { id: 'MIN_DESCRIPTION_LENGTH', label: 'Longueur minimum description', paramsHint: '{"min": 20}' },
  { id: 'BANNED_KEYWORDS',        label: 'Mots-clés interdits',        paramsHint: '{"keywords": ["contrefaçon", "arme"]}' },
  { id: 'CATEGORY_WHITELIST',     label: 'Catégories autorisées',       paramsHint: '{"allowed": ["Riz parfumé", "Riz étuvé"]}' },
  { id: 'MIN_QUANTITY',           label: 'Quantité minimum',           paramsHint: '{"min": 10}' },
]
const ruleTypeLabel = (id) => RULE_TYPES.find(r => r.id === id)?.label || id

// ─── Formulaire nouvelle règle ────────────────────────────────────────────────
function NewRuleForm({ onCreated }) {
  const [targetType, setTargetType] = useState('BOTH')
  const [ruleType, setRuleType]     = useState('MIN_PRICE')
  const [severity, setSeverity]     = useState('FLAG_FOR_REVIEW')
  const [label, setLabel]           = useState('')
  const [params, setParams]         = useState('{"min": 500}')
  const [error, setError]           = useState('')
  const [saving, setSaving]         = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!label.trim()) { setError('Le motif (label) est requis.'); return }
    let parsed
    try { parsed = JSON.parse(params) } catch { setError('Paramètres JSON invalides.'); return }
    setSaving(true)
    try {
      await api.post('/admin/approval-rules', { targetType, ruleType, severity, label: label.trim(), params: parsed })
      setLabel(''); setParams('{}')
      onCreated()
    } catch (err) {
      setError(err.message || 'Erreur lors de la création')
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h3 className="font-syne font-bold text-[#0F1923] flex items-center gap-2"><Plus size={16} /> Nouvelle règle</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-syne text-xs font-bold uppercase tracking-wider text-[#0F1923]/40 mb-1.5">S'applique à</label>
          <select value={targetType} onChange={e => setTargetType(e.target.value)}
            className="w-full bg-[#F0F2F5] rounded-xl px-3 py-2.5 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20">
            <option value="BOTH">Produits + Offres B2B</option>
            <option value="PRODUCT">Produits (boutiques) uniquement</option>
            <option value="OFFER">Offres B2B (coopératives) uniquement</option>
          </select>
        </div>
        <div>
          <label className="block font-syne text-xs font-bold uppercase tracking-wider text-[#0F1923]/40 mb-1.5">Type de règle</label>
          <select value={ruleType} onChange={e => { setRuleType(e.target.value); setParams(RULE_TYPES.find(r => r.id === e.target.value)?.paramsHint || '{}') }}
            className="w-full bg-[#F0F2F5] rounded-xl px-3 py-2.5 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20">
            {RULE_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-syne text-xs font-bold uppercase tracking-wider text-[#0F1923]/40 mb-1.5">Sévérité</label>
          <select value={severity} onChange={e => setSeverity(e.target.value)}
            className="w-full bg-[#F0F2F5] rounded-xl px-3 py-2.5 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20">
            <option value="FLAG_FOR_REVIEW">Mettre en attente de revue manuelle</option>
            <option value="AUTO_REJECT">Refuser automatiquement</option>
          </select>
        </div>
        <div>
          <label className="block font-syne text-xs font-bold uppercase tracking-wider text-[#0F1923]/40 mb-1.5">Motif affiché au vendeur</label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex : Prix trop bas, vérification requise"
            className="w-full bg-[#F0F2F5] rounded-xl px-3 py-2.5 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20" />
        </div>
        <div className="sm:col-span-2">
          <label className="block font-syne text-xs font-bold uppercase tracking-wider text-[#0F1923]/40 mb-1.5">Paramètres (JSON)</label>
          <input value={params} onChange={e => setParams(e.target.value)} placeholder='{"min": 500}'
            className="w-full bg-[#F0F2F5] rounded-xl px-3 py-2.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20" />
        </div>
      </div>
      {error && <p className="font-dm text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={13} />{error}</p>}
      <button type="submit" disabled={saving}
        className="flex items-center gap-2 bg-[#1B4332] text-white font-syne text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#153a29] transition-colors disabled:opacity-50">
        <Plus size={14} /> {saving ? 'Création…' : 'Ajouter la règle'}
      </button>
    </form>
  )
}

// ─── Liste des règles ─────────────────────────────────────────────────────────
function RulesList({ rules, onToggle, onDelete }) {
  if (rules.length === 0) return (
    <div className="bg-white rounded-3xl p-10 text-center border border-gray-100">
      <ShieldCheck size={36} className="mx-auto text-gray-200 mb-3" />
      <p className="font-syne font-bold text-gray-400">Aucune règle configurée</p>
      <p className="font-dm text-sm text-gray-300 mt-1">Sans règle, tout produit/offre est approuvé automatiquement.</p>
    </div>
  )
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {['Cible', 'Règle', 'Sévérité', 'Motif', 'Statut', ''].map(h => (
              <th key={h} className="px-4 py-3 text-left font-syne text-[10px] font-bold tracking-widest uppercase text-[#0F1923]/35">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rules.map(r => (
            <tr key={r.id} className="hover:bg-[#F0F2F5]/40 transition-colors">
              <td className="px-4 py-3 font-dm text-xs text-[#0F1923]/60">{{ PRODUCT: 'Produits', OFFER: 'Offres B2B', BOTH: 'Les deux' }[r.targetType]}</td>
              <td className="px-4 py-3 font-syne text-sm font-bold text-[#0F1923]">{ruleTypeLabel(r.ruleType)}</td>
              <td className="px-4 py-3">
                <span className={`font-syne text-[10px] font-bold px-2.5 py-1 rounded-full ${r.severity === 'AUTO_REJECT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {r.severity === 'AUTO_REJECT' ? 'Refus auto' : 'Revue manuelle'}
                </span>
              </td>
              <td className="px-4 py-3 font-dm text-xs text-[#0F1923]/50 max-w-[220px] truncate">{r.label}</td>
              <td className="px-4 py-3">
                <button onClick={() => onToggle(r)}
                  className={`flex items-center gap-1.5 font-syne text-[10px] font-bold px-2.5 py-1 rounded-full ${r.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  <Power size={10} /> {r.active ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td className="px-4 py-3">
                <button onClick={() => onDelete(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Modal décision (approuver/refuser) ───────────────────────────────────────
function DecisionModal({ item, kind, onClose, onDecided }) {
  const [reason, setReason] = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const decide = async (action) => {
    if (action === 'reject' && !reason.trim()) { setError('Motif de refus requis.'); return }
    setLoading(true); setError('')
    try {
      const path = kind === 'PRODUCT' ? `/admin/moderation/product/${item.id}/${action}` : `/admin/moderation/offer/${item.id}/${action}`
      await api.post(path, action === 'reject' ? { reason: reason.trim() } : {})
      onDecided()
      onClose()
    } catch (err) {
      setError(err.message || 'Erreur')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-[#1B4332] px-6 py-4 flex items-center justify-between">
          <p className="font-playfair text-lg font-bold text-white">{kind === 'PRODUCT' ? item.name : item.product}</p>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="font-dm text-sm text-[#0F1923]/60">
            Signalé pour revue : <span className="font-semibold text-[#0F1923]">{item.rejectionReason}</span>
          </p>
          <div>
            <label className="block font-syne text-xs font-bold uppercase tracking-wider text-[#0F1923]/40 mb-1.5">Motif de refus (si refusé)</label>
            <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Expliquez pourquoi ce contenu est refusé…"
              className="w-full bg-[#F0F2F5] rounded-xl px-3 py-2.5 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 resize-none" />
          </div>
          {error && <p className="font-dm text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={13} />{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => decide('reject')} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white font-syne text-sm font-bold py-3 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">
              <XCircle size={15} /> Refuser
            </button>
            <button onClick={() => decide('approve')} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-syne text-sm font-bold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
              <CheckCircle size={15} /> Approuver
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ApprovalRulesTab() {
  const [rules, setRules]     = useState([])
  const [queue, setQueue]     = useState({ products: [], offers: [] })
  const [loading, setLoading] = useState(true)
  const [decisionItem, setDecisionItem] = useState(null) // { item, kind }

  const load = useCallback(async () => {
    try {
      const [r, q] = await Promise.all([
        api.get('/admin/approval-rules'),
        api.get('/admin/moderation/queue'),
      ])
      setRules(r.rules || [])
      setQueue(q)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleRule = async (rule) => {
    await api.put(`/admin/approval-rules/${rule.id}`, { active: !rule.active })
    load()
  }
  const deleteRule = async (rule) => {
    if (!window.confirm(`Supprimer la règle "${rule.label}" ?`)) return
    await api.delete(`/admin/approval-rules/${rule.id}`)
    load()
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-[#52B788]/30 border-t-[#52B788] rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-[#0F1923]/40">Administration</p>
        <h1 className="font-playfair text-3xl font-bold text-[#0F1923] flex items-center gap-2"><ShieldCheck size={26} /> Modération produits &amp; offres</h1>
        <p className="font-dm text-sm text-[#0F1923]/50 mt-1">
          Chaque produit/offre est vérifié à la publication contre ces règles : conforme → publié automatiquement,
          signalé → file d'attente ci-dessous, en violation d'une règle "refus auto" → refusé immédiatement.
        </p>
      </div>

      {/* File d'attente */}
      <div>
        <h2 className="font-syne font-bold text-[#0F1923] mb-3">File d'attente ({queue.products.length + queue.offers.length})</h2>
        {queue.products.length + queue.offers.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-gray-100">
            <CheckCircle size={32} className="mx-auto text-green-200 mb-2" />
            <p className="font-dm text-sm text-gray-400">Rien en attente — tout est à jour.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {queue.products.map(p => (
              <button key={`p-${p.id}`} onClick={() => setDecisionItem({ item: p, kind: 'PRODUCT' })}
                className="text-left bg-white rounded-2xl border border-amber-200 p-4 hover:border-amber-400 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Store size={13} className="text-[#1B4332]" />
                  <p className="font-syne text-sm font-bold text-[#0F1923] truncate">{p.name}</p>
                </div>
                <p className="font-dm text-xs text-[#0F1923]/50">{p.shop?.name} · {p.price} FCFA</p>
                <p className="font-dm text-xs text-amber-600 mt-1">{p.rejectionReason}</p>
              </button>
            ))}
            {queue.offers.map(o => (
              <button key={`o-${o.id}`} onClick={() => setDecisionItem({ item: o, kind: 'OFFER' })}
                className="text-left bg-white rounded-2xl border border-amber-200 p-4 hover:border-amber-400 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Sprout size={13} className="text-[#1B4332]" />
                  <p className="font-syne text-sm font-bold text-[#0F1923] truncate">{o.product}</p>
                </div>
                <p className="font-dm text-xs text-[#0F1923]/50">{o.cooperative?.name || o.producer?.user?.name} · {o.quantity} {o.unit}</p>
                <p className="font-dm text-xs text-amber-600 mt-1">{o.rejectionReason}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Règles */}
      <div className="space-y-4">
        <h2 className="font-syne font-bold text-[#0F1923]">Règles configurées</h2>
        <NewRuleForm onCreated={load} />
        <RulesList rules={rules} onToggle={toggleRule} onDelete={deleteRule} />
      </div>

      <AnimatePresence>
        {decisionItem && (
          <DecisionModal item={decisionItem.item} kind={decisionItem.kind}
            onClose={() => setDecisionItem(null)} onDecided={load} />
        )}
      </AnimatePresence>
    </div>
  )
}
