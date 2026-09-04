/**
 * AIGeneratorPanel
 * Panneau accordéon pour générer titre + description via Claude.
 *
 * Props :
 *   onGenerated  {fn({ name, description })}  Callback quand l'IA répond
 */
import { useState } from 'react'
import { Sparkles, ChevronDown, AlertTriangle, Wand2 } from 'lucide-react'
import { api } from '../../api/client'
import { motion, AnimatePresence } from 'framer-motion'

const HINTS = [
  { key: 'productType',  label: 'Type de riz *',           placeholder: 'ex : Riz jasmin, Riz étuvé local…' },
  { key: 'origin',       label: 'Origine',                  placeholder: 'ex : Côte d\'Ivoire, Thaïlande…' },
  { key: 'quality',      label: 'Qualité / Grade',          placeholder: 'ex : Extra long grain, Premium…' },
  { key: 'packaging',    label: 'Conditionnement',          placeholder: 'ex : Sac 25 kg, Sachet 5 kg…' },
  { key: 'highlight',    label: 'Point fort',               placeholder: 'ex : Bio, Sans OGM, Récolte 2025…' },
]

export default function AIGeneratorPanel({ onGenerated }) {
  const [open, setOpen]           = useState(false)
  const [hints, setHints]         = useState({ productType: '', origin: '', quality: '', packaging: '', highlight: '' })
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(false)
  const [sourceLabel, setSourceLabel] = useState('')

  const set = k => e => setHints(h => ({ ...h, [k]: e.target.value }))

  const generate = async () => {
    if (!hints.productType.trim()) { setError('Précise au minimum le type de riz.'); return }
    setLoading(true); setError(null); setSuccess(false); setSourceLabel('')
    try {
      const result = await api.post('/products/generate', hints)
      onGenerated(result)
      setSourceLabel(result.source === 'ai' ? 'Claude ✦' : 'Génération automatique')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (e) {
      setError(e.message || 'Erreur génération')
    } finally { setLoading(false) }
  }

  return (
    <div className={`rounded-2xl border transition-colors overflow-hidden ${
      open ? 'border-[#E8A217]/40 bg-[#E8A217]/4' : 'border-charcoal/10 bg-white'
    }`}>
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
          open ? 'bg-[#E8A217] text-white' : 'bg-[#E8A217]/10 text-[#E8A217]'
        }`}>
          <Sparkles size={15} />
        </div>
        <div className="flex-1">
          <p className="font-syne text-sm font-bold text-charcoal">Générer avec l'IA</p>
          <p className="font-dm text-xs text-charcoal/40">Titre et description rédigés automatiquement</p>
        </div>
        <ChevronDown
          size={16}
          className={`text-charcoal/30 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Corps */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3 border-t border-[#E8A217]/15">
              <p className="font-dm text-xs text-charcoal/50 pt-4">
                Remplis les infos ci-dessous. L'IA génère un titre accrocheur et une description commerciale.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {HINTS.map(({ key, label, placeholder }) => (
                  <div key={key} className={key === 'productType' || key === 'highlight' ? 'col-span-2' : ''}>
                    <label className="block font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-1">
                      {label}
                    </label>
                    <input
                      value={hints[key]}
                      onChange={set(key)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 rounded-xl border border-charcoal/10 bg-white font-dm text-sm text-charcoal placeholder:text-charcoal/25 focus:outline-none focus:ring-2 focus:ring-[#E8A217]/30"
                    />
                  </div>
                ))}
              </div>

              {/* Erreur */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={13} className="text-red-500 shrink-0" />
                  <p className="font-dm text-xs text-red-600">{error}</p>
                </div>
              )}

              {/* Succès */}
              {success && (
                <div className="flex items-center justify-between gap-2 bg-green-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} className="text-green-600 shrink-0" />
                    <p className="font-dm text-xs text-green-700">Titre et description générés ! Vérifiez et ajustez.</p>
                  </div>
                  {sourceLabel && (
                    <span className="font-syne text-[10px] font-bold text-green-600/70 shrink-0">{sourceLabel}</span>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#E8A217] text-white font-syne text-sm font-bold hover:bg-[#d4901a] transition-colors disabled:opacity-50"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Génération…</>
                  : <><Wand2 size={14} /> Générer le contenu</>
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
