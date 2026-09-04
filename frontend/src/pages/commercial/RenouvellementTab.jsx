import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { fmt } from '../../utils/status'

const urgencyColor = (days) => {
  if (days <= 7)  return 'bg-red-100 text-red-800 border-red-200'
  if (days <= 14) return 'bg-orange-100 text-orange-800 border-orange-200'
  return 'bg-amber-100 text-amber-800 border-amber-200'
}

export default function RenouvellementTab() {
  const [renewals, setRenewals] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    setLoading(true)
    api.get('/commercial/renewals')
      .then(d => setRenewals(d.renewals || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-playfair text-2xl font-bold text-charcoal">Renouvellements à venir</h2>
        <p className="font-dm text-sm text-charcoal/50">Abonnements expirant dans ≤ 30 jours</p>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-5 font-dm text-xs text-charcoal/50">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-red-400" /> ≤ 7 jours</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-orange-400" /> ≤ 14 jours</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> ≤ 30 jours</span>
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
      ) : renewals.length === 0 ? (
        <div className="text-center py-16 text-charcoal/40">
          <p className="font-dm">Aucun abonnement n'expire dans les 30 prochains jours</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renewals.map(r => (
            <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-charcoal/8">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-syne font-bold text-charcoal text-sm">{r.shop?.name || '—'}</p>
                  <p className="font-dm text-xs text-charcoal/50 mt-0.5">{r.shop?.user?.name}</p>
                </div>
                <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full border ${urgencyColor(r.daysRemaining)}`}>
                  {r.daysRemaining}j
                </span>
              </div>

              <div className="space-y-1 mb-4">
                <p className="font-dm text-xs text-charcoal/60">
                  Plan : <span className="font-bold text-charcoal">{r.plan}</span>
                </p>
                <p className="font-dm text-xs text-charcoal/60">
                  Expire le : <span className="font-bold text-charcoal">{new Date(r.endDate).toLocaleDateString('fr-FR')}</span>
                </p>
                {r.amount && (
                  <p className="font-dm text-xs text-charcoal/60">
                    Montant : <span className="font-bold text-charcoal">{fmt(r.amount)} FCFA</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {r.shop?.user?.phone && (
                  <>
                    <a
                      href={`tel:${r.shop.user.phone}`}
                      className="flex items-center gap-1 font-syne text-xs font-bold text-charcoal/60 hover:text-charcoal transition-colors"
                    >
                      📞 Appeler
                    </a>
                    <a
                      href={`https://wa.me/${r.shop.user.phone.replace(/\D/g, '')}`}
                      target="_blank" rel="noreferrer"
                      className="font-syne text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full hover:bg-green-200 transition-colors"
                    >
                      WhatsApp
                    </a>
                  </>
                )}
                {r.shop?.user?.email && (
                  <a
                    href={`mailto:${r.shop.user.email}`}
                    className="font-syne text-xs font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors"
                  >
                    Email
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
