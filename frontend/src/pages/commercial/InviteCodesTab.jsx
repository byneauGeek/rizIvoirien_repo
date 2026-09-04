import { useState, useEffect } from 'react'
import { Plus, Copy, Check } from 'lucide-react'
import { api } from '../../api/client'
import { fmtDate } from '../../utils/status'

export default function InviteCodesTab() {
  const [codes, setCodes]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [count, setCount]       = useState(1)
  const [copied, setCopied]     = useState(null)
  const [error, setError]       = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/invite-codes')
      setCodes(Array.isArray(data) ? data : [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const generate = async () => {
    setGenerating(true); setError(null)
    try {
      await api.post('/admin/invite-codes', { count })
      load()
    } catch (e) { setError(e.message) }
    finally { setGenerating(false) }
  }

  const copy = (code) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-playfair text-2xl font-bold text-charcoal">Codes d'invitation</h2>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-charcoal/15 rounded-xl px-3 py-2 shadow-sm">
            <span className="font-dm text-sm text-charcoal/60">Générer</span>
            <input
              type="number"
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(10, Number(e.target.value))))}
              className="w-12 font-syne font-bold text-sm text-center border border-charcoal/20 rounded-lg py-1 focus:outline-none focus:border-indigo-500"
              min={1}
              max={10}
            />
            <span className="font-dm text-sm text-charcoal/60">code(s)</span>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 bg-indigo-600 text-white font-syne text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            <Plus size={16} /> {generating ? 'Génération…' : 'Générer'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="font-dm text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : codes.length === 0 ? (
        <div className="text-center py-16 text-charcoal/40">
          <p className="font-dm">Aucun code d'invitation</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal/8">
                {['Code', 'Créé le', 'Statut', 'Utilisé par', 'Copier'].map(h => (
                  <th key={h} className="px-5 py-4 text-left font-syne text-xs font-bold text-charcoal/50 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id} className="border-b border-charcoal/5 hover:bg-charcoal/2 transition-colors">
                  <td className="px-5 py-4">
                    <span className="font-mono font-bold text-sm text-charcoal tracking-wider">{c.code}</span>
                  </td>
                  <td className="px-5 py-4 font-dm text-xs text-charcoal/50">{fmtDate(c.createdAt)}</td>
                  <td className="px-5 py-4">
                    <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full ${
                      c.used ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                    }`}>
                      {c.used ? 'Utilisé' : 'Disponible'}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-dm text-xs text-charcoal/60">
                    {c.usedById ? `ID ${c.usedById}` : '—'}
                  </td>
                  <td className="px-5 py-4">
                    {!c.used && (
                      <button
                        onClick={() => copy(c.code)}
                        className={`flex items-center gap-1.5 font-syne text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                          copied === c.code
                            ? 'bg-green-100 text-green-700'
                            : 'bg-charcoal/5 text-charcoal/60 hover:bg-charcoal/10'
                        }`}
                      >
                        {copied === c.code ? <><Check size={12} /> Copié</> : <><Copy size={12} /> Copier</>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
