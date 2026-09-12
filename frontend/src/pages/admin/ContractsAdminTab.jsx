import { useEffect, useState, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { api } from '../../api/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Store, Truck, CheckCircle, Clock, RefreshCw,
  Eye, AlertCircle, X, Search, Download, ShieldCheck
} from 'lucide-react'

const downloadContract = async (contract, holderName) => {
  if (contract.status !== 'SIGNED') return
  const date = contract.signedAt
    ? new Date(contract.signedAt).toISOString().split('T')[0]
    : 'non-signe'
  const slug = (holderName || 'contrat').replace(/\s+/g, '-').toLowerCase()
  const filename = `contrat-${slug}-${date}.pdf`

  const { default: html2pdf } = await import('html2pdf.js')
  await html2pdf()
    .set({
      margin: [15, 15, 15, 15],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(DOMPurify.sanitize(contract.content))
    .save()
}

const contractStatusBadge = (status) => {
  if (status === 'SIGNED') return { cls: 'bg-green-100 text-green-700', label: '✓ Signé', icon: CheckCircle }
  return { cls: 'bg-amber-100 text-amber-700', label: '⏳ En attente', icon: Clock }
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
function ContractPreviewModal({ contract, onClose, onRegenerate }) {
  const [regenLoading, setRegenLoading] = useState(false)
  const [regenMsg, setRegenMsg]         = useState(null)
  const [error, setError]               = useState(null)

  const regen = async () => {
    setRegenLoading(true); setRegenMsg(null); setError(null)
    try {
      const endpoint = contract.type === 'SHOP'
        ? `/admin/contracts/regenerate/shop/${contract.shopId}`
        : `/admin/contracts/regenerate/driver/${contract.driverId}`
      await api.post(endpoint, {})
      setRegenMsg('Contrat régénéré. Le titulaire devra signer à nouveau.')
      onRegenerate()
    } catch (e) {
      setError(e.message || 'Erreur lors de la régénération')
    } finally { setRegenLoading(false) }
  }

  const { cls, label } = contractStatusBadge(contract.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#1B4332] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <p className="font-playfair text-base font-bold text-white">
                {contract.type === 'SHOP' ? contract.shopName : contract.driverName}
              </p>
              <p className="font-syne text-[10px] text-white/50">
                {contract.type === 'SHOP' ? 'Contrat boutique' : 'Contrat livreur'} · Réf. #{contract.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-syne text-xs font-bold px-3 py-1.5 rounded-full ${cls}`}>{label}</span>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X size={14} className="text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contract.content) }} />
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/80 shrink-0 space-y-3">
          {contract.signedAt && (
            <p className="font-dm text-xs text-green-700 flex items-center gap-1.5">
              <CheckCircle size={12} />
              Signé le {new Date(contract.signedAt).toLocaleDateString('fr-FR')} à {new Date(contract.signedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {contract.lastSignature && (
            <div className="bg-charcoal/4 rounded-xl px-4 py-3 space-y-1">
              <p className="flex items-center gap-1.5 font-syne text-xs font-bold text-charcoal">
                <ShieldCheck size={13} className="text-green-600" /> Preuve de signature
              </p>
              <p className="font-dm text-xs text-charcoal/60">Nom saisi : <span className="font-semibold text-charcoal">{contract.lastSignature.signedByName}</span></p>
              {contract.lastSignature.ipAddress && (
                <p className="font-dm text-xs text-charcoal/60">Adresse IP : <span className="font-mono">{contract.lastSignature.ipAddress}</span></p>
              )}
              <p className="font-dm text-[10px] text-charcoal/40 break-all">Empreinte du contenu signé : {contract.lastSignature.contentHash}</p>
            </div>
          )}
          {error && (
            <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertCircle size={13} className="text-red-500 shrink-0" />
              <p className="font-dm text-sm text-red-600">{error}</p>
            </div>
          )}
          {regenMsg && (
            <p className="font-dm text-xs text-green-600 flex items-center gap-1.5">
              <CheckCircle size={12} /> {regenMsg}
            </p>
          )}
          <div className="flex items-center gap-3">
            {contract.status === 'SIGNED' && (
              <button onClick={() => downloadContract(contract, contract.type === 'SHOP' ? contract.shopName : contract.driverName)}
                className="flex items-center gap-2 bg-green-600 text-white font-syne text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-green-700 transition-colors">
                <Download size={14} /> Télécharger le contrat
              </button>
            )}
            <button onClick={regen} disabled={regenLoading}
              className="flex items-center gap-2 bg-[#0F1923] text-white font-syne text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#1a2c3d] transition-colors disabled:opacity-50">
              <RefreshCw size={14} className={regenLoading ? 'animate-spin' : ''} />
              {regenLoading ? 'Régénération…' : 'Régénérer le contrat'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ContractsAdminTab() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [filter, setFilter]       = useState('ALL')   // ALL | SHOP | DRIVER
  const [statusFilter, setStatusFilter] = useState('ALL') // ALL | PENDING_SIGNATURE | SIGNED
  const [search, setSearch]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/contracts')
      setContracts(data.contracts || [])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = contracts
    .filter(c => filter === 'ALL' || c.type === filter)
    .filter(c => statusFilter === 'ALL' || c.status === statusFilter)
    .filter(c => {
      if (!search) return true
      const name = c.type === 'SHOP' ? (c.shopName || '') : (c.driverName || '')
      return name.toLowerCase().includes(search.toLowerCase())
    })

  const signedCount  = contracts.filter(c => c.status === 'SIGNED').length
  const pendingCount = contracts.filter(c => c.status === 'PENDING_SIGNATURE').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-[#0F1923]/40">Administration</p>
          <h1 className="font-playfair text-3xl font-bold text-[#0F1923]">Contrats</h1>
          <p className="font-dm text-sm text-[#0F1923]/50 mt-1">Gestion des contrats de partenariat boutiques et livreurs.</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 bg-white border border-gray-200 text-[#0F1923]/60 font-syne text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total contrats', value: contracts.length, cls: 'bg-[#0F1923] text-white', sub: 'boutiques + livreurs' },
          { label: 'Signés', value: signedCount, cls: 'bg-green-600 text-white', sub: 'compte actif confirmé' },
          { label: 'En attente', value: pendingCount, cls: 'bg-amber-500 text-white', sub: 'signature requise' },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl p-5 ${k.cls}`}>
            <p className="font-syne text-xs font-bold uppercase tracking-wider opacity-70">{k.label}</p>
            <p className="font-playfair text-4xl font-bold mt-1">{k.value}</p>
            <p className="font-dm text-xs opacity-60 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Chercher un nom…"
            className="w-full pl-9 pr-4 py-2 bg-[#F0F2F5] rounded-xl font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1.5">
          {[
            { id: 'ALL',    label: 'Tous' },
            { id: 'SHOP',   label: '🏪 Boutiques' },
            { id: 'DRIVER', label: '🚚 Livreurs' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-2 rounded-xl font-syne text-xs font-bold transition-all ${
                filter === f.id ? 'bg-[#0F1923] text-white' : 'bg-[#F0F2F5] text-[#0F1923]/60 hover:bg-gray-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5">
          {[
            { id: 'ALL',                label: 'Tous statuts' },
            { id: 'SIGNED',             label: '✓ Signés' },
            { id: 'PENDING_SIGNATURE',  label: '⏳ En attente' },
          ].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-2 rounded-xl font-syne text-xs font-bold transition-all ${
                statusFilter === f.id ? 'bg-[#0F1923] text-white' : 'bg-[#F0F2F5] text-[#0F1923]/60 hover:bg-gray-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#52B788]/30 border-t-[#52B788] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-100">
          <FileText size={40} className="mx-auto text-gray-200 mb-4" />
          <p className="font-syne font-bold text-gray-400">Aucun contrat trouvé</p>
          <p className="font-dm text-sm text-gray-300 mt-1">Les contrats sont générés lors de l'approbation d'une boutique ou d'un livreur</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Titulaire', 'Type', 'Statut', 'Généré le', 'Signé le', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left font-syne text-[10px] font-bold tracking-widest uppercase text-[#0F1923]/35">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => {
                const { cls, label } = contractStatusBadge(c.status)
                const name = c.type === 'SHOP' ? c.shopName : c.driverName
                return (
                  <tr key={c.id} className="hover:bg-[#F0F2F5]/40 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          c.type === 'SHOP' ? 'bg-[#1B4332]/10' : 'bg-[#0F1923]/10'
                        }`}>
                          {c.type === 'SHOP'
                            ? <Store size={14} className="text-[#1B4332]" />
                            : <Truck size={14} className="text-[#0F1923]/60" />
                          }
                        </div>
                        <p className="font-syne text-sm font-bold text-[#0F1923]">{name || '—'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        c.type === 'SHOP' ? 'bg-[#1B4332]/10 text-[#1B4332]' : 'bg-[#0F1923]/8 text-[#0F1923]/60'
                      }`}>
                        {c.type === 'SHOP' ? '🏪 Boutique' : '🚚 Livreur'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-syne text-[10px] font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
                    </td>
                    <td className="px-5 py-4 font-dm text-xs text-[#0F1923]/50">
                      {new Date(c.generatedAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-5 py-4 font-dm text-xs text-[#0F1923]/50">
                      {c.signedAt ? new Date(c.signedAt).toLocaleDateString('fr-FR') : <span className="text-amber-500">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelected(c)}
                          className="flex items-center gap-1.5 bg-[#F0F2F5] text-[#0F1923]/60 font-syne text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#0F1923]/10 hover:text-[#0F1923] transition-colors">
                          <Eye size={12} /> Voir / Régénérer
                        </button>
                        {c.status === 'SIGNED' && (
                          <button onClick={() => downloadContract(c, c.type === 'SHOP' ? c.shopName : c.driverName)}
                            className="flex items-center gap-1.5 bg-green-50 text-green-700 font-syne text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors">
                            <Download size={12} /> Télécharger
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <ContractPreviewModal
            contract={selected}
            onClose={() => setSelected(null)}
            onRegenerate={() => { setSelected(null); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
