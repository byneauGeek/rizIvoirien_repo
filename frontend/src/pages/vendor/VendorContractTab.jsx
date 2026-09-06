import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/client'
import DOMPurify from 'dompurify'
import { FileText, CheckCircle, Clock, AlertTriangle, CheckSquare, Square, Download } from 'lucide-react'

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

export default function VendorContractTab() {
  const [contract, setContract]   = useState(null)
  const [signed, setSigned]       = useState(false)
  const [loading, setLoading]     = useState(true)
  const [accepted, setAccepted]   = useState(false)
  const [signing, setSigning]     = useState(false)
  const [error, setError]         = useState(null)

  const load = useCallback(() => {
    api.get('/shops/my/contract')
      .then(d => {
        setContract(d.contract)
        setSigned(d.contractSigned || d.contract?.status === 'SIGNED')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [load])

  const sign = async () => {
    if (!accepted) return
    setSigning(true); setError(null)
    try {
      await api.put('/shops/my/contract/sign', {})
      setSigned(true)
      setContract(c => c ? { ...c, status: 'SIGNED', signedAt: new Date().toISOString() } : c)
    } catch (e) { setError(e.message || 'Erreur lors de la signature') }
    finally { setSigning(false) }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-[#E8A217]/30 border-t-[#E8A217] rounded-full animate-spin" />
    </div>
  )

  if (!contract) return (
    <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-50">
      <FileText size={40} className="mx-auto text-charcoal/20 mb-4" />
      <p className="font-syne font-bold text-charcoal/40">Aucun contrat disponible</p>
      <p className="font-dm text-sm text-charcoal/30 mt-1">Le contrat est généré après validation de votre dossier par l'administration</p>
    </div>
  )

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Boutique</p>
        <h1 className="font-playfair text-3xl font-bold text-charcoal">Mon contrat</h1>
      </div>

      <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${
        signed ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
      }`}>
        {signed
          ? <CheckCircle size={18} className="text-green-600 shrink-0" />
          : <Clock size={18} className="text-amber-600 shrink-0" />
        }
        <div className="flex-1">
          <p className={`font-syne text-sm font-bold ${signed ? 'text-green-700' : 'text-amber-700'}`}>
            {signed ? 'Contrat signé' : 'Contrat en attente de signature'}
          </p>
          {signed && contract.signedAt && (
            <p className="font-dm text-xs text-green-600 mt-0.5">
              Signé le {new Date(contract.signedAt).toLocaleDateString('fr-FR')} à {new Date(contract.signedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        {signed && (
          <button onClick={() => downloadContract(contract, 'boutique')}
            className="flex items-center gap-2 bg-green-600 text-white font-syne text-xs font-bold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors shrink-0">
            <Download size={13} /> Télécharger
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-[#0F1923] px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <FileText size={15} className="text-white" />
          </div>
          <div>
            <p className="font-playfair text-base font-bold text-white">Contrat de partenariat vendeur</p>
            <p className="font-syne text-[10px] text-white/40">Document officiel RizIvoirien</p>
          </div>
        </div>

        <div className="px-6 py-6 max-h-[55vh] overflow-y-auto">
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contract.content) }} />
        </div>

        {!signed && (
          <div className="border-t border-gray-100 px-6 py-5 bg-gray-50/80 space-y-4">
            {error && (
              <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
                <AlertTriangle size={13} className="text-red-500 shrink-0" />
                <p className="font-dm text-sm text-red-600">{error}</p>
              </div>
            )}
            <label className="flex items-start gap-3 cursor-pointer">
              <button type="button" onClick={() => setAccepted(v => !v)} className="mt-0.5 shrink-0 text-[#0F1923]">
                {accepted ? <CheckSquare size={20} /> : <Square size={20} className="text-charcoal/30" />}
              </button>
              <span className="font-dm text-sm text-charcoal/70 leading-relaxed">
                J'ai lu et j'accepte l'intégralité du contrat de partenariat vendeur RizIvoirien.
              </span>
            </label>
            <button onClick={sign} disabled={!accepted || signing}
              className="w-full py-3 rounded-2xl bg-[#E8A217] text-white font-syne font-bold text-sm hover:bg-[#d4901a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {signing
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <FileText size={15} />
              }
              Signer le contrat
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
