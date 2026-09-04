import { useState, useEffect } from 'react'
import { X, Phone, Mail, CheckCircle, XCircle, RefreshCw, Bell, TrendingUp, TrendingDown, Truck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../api/client'
import { fmt, fmtDate, fmtDriverId, fmtOrderId } from '../../utils/status'
import CommercialNotes from './CommercialNotes'

const DRIVER_STATUS = {
  PENDING:   { label: 'En attente', color: 'bg-amber-100 text-amber-800' },
  ACTIVE:    { label: 'Actif',      color: 'bg-green-100 text-green-800' },
  SUSPENDED: { label: 'Suspendu',   color: 'bg-red-100 text-red-800' },
  REJECTED:  { label: 'Rejeté',     color: 'bg-gray-100 text-gray-700' },
}

function Trend({ current, prev }) {
  if (!prev) return <span className="font-dm text-xs text-charcoal/40">— vs mois préc.</span>
  const pct = Math.round(((current - prev) / (prev || 1)) * 100)
  const up = pct >= 0
  return (
    <span className={`flex items-center gap-0.5 font-dm text-xs ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{pct}% vs mois préc.
    </span>
  )
}

export default function FicheLivreur({ driver: driverPreview, onClose, onRefresh }) {
  const [driver, setDriver]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(null)
  const [error, setError]     = useState(null)
  const [tab, setTab]         = useState('apercu') // 'apercu' | 'activite' | 'notes'

  useEffect(() => {
    if (!driverPreview?.id) return
    setLoading(true)
    api.get(`/commercial/drivers/${driverPreview.id}`)
      .then(setDriver)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [driverPreview?.id])

  if (!driverPreview) return null

  const statusInfo  = DRIVER_STATUS[driverPreview.status] || DRIVER_STATUS.PENDING
  const stats       = driver?.stats
  const acceptRate  = driver?.acceptanceRate != null ? `${Math.round(driver.acceptanceRate * 100)}%` : '—'

  const doAction = async (label, fn) => {
    setActing(label); setError(null)
    try {
      await fn()
      const updated = await api.get(`/commercial/drivers/${driverPreview.id}`)
      setDriver(updated)
      onRefresh?.()
    } catch (e) { setError(e.message) }
    finally { setActing(null) }
  }

  const approve = () => doAction('approve', () => api.put(`/admin/drivers/${driverPreview.id}/status`, { status: 'ACTIVE' }))
  const premium = () => doAction('premium', () => api.put(`/admin/drivers/${driverPreview.id}/plan`, { plan: 'PREMIUM' }))
  const suspend = () => {
    const note = prompt('Motif de suspension (requis)')
    if (!note?.trim()) return
    doAction('suspend', () => api.put(`/admin/drivers/${driverPreview.id}/status`, { status: 'SUSPENDED', note }))
  }
  const regen  = () => doAction('regen',  () => api.post(`/admin/contracts/regenerate/driver/${driverPreview.id}`))
  const remind = () => doAction('remind', () => api.post(`/commercial/drivers/${driverPreview.id}/remind-contract`))

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.aside
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full max-w-2xl bg-white h-full overflow-y-auto flex flex-col shadow-2xl"
        >
          {/* ── Header ── */}
          <div className="sticky top-0 z-10 bg-white border-b border-charcoal/10 px-6 py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
              <span className="font-playfair font-bold text-blue-600 text-xl">{driverPreview.user?.name?.[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-playfair text-xl font-bold text-charcoal">{driverPreview.user?.name}</h2>
                <span className={`font-syne text-xs font-bold px-2.5 py-0.5 rounded-full ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                <span className={`font-syne text-xs font-bold px-2.5 py-0.5 rounded-full ${driverPreview.plan === 'PREMIUM' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                  {driverPreview.plan || 'BASIC'}
                </span>
              </div>
              <p className="font-dm text-xs text-charcoal/50">{fmtDriverId(driverPreview.id)} · {driverPreview.vehicleType || 'Livreur'}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-charcoal/5 text-charcoal/50 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-charcoal/10 px-6">
            {[['apercu', 'Aperçu'], ['activite', 'Livraisons récentes'], ['notes', 'Notes CRM']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`font-syne text-xs font-bold px-4 py-3 border-b-2 transition-colors ${
                  tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-charcoal/50 hover:text-charcoal'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 px-6 py-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="font-dm text-sm text-red-600">{error}</p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-7 h-7 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            )}

            {/* ══════ TAB APERÇU ══════ */}
            {!loading && tab === 'apercu' && (
              <>
                {/* Contact rapide */}
                <section className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
                  <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-blue-600 mb-3">Contact rapide</h3>
                  {driver?.user?.phone && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 font-dm text-sm text-charcoal flex-1">
                        <Phone size={14} className="text-blue-400 shrink-0" />
                        <a href={`tel:${driver.user.phone}`} className="hover:text-blue-600 font-bold transition-colors">{driver.user.phone}</a>
                      </div>
                      <a
                        href={`https://wa.me/${driver.user.phone.replace(/\D/g, '')}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 font-syne text-xs font-bold bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors"
                      >
                        WhatsApp
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 font-dm text-sm text-charcoal">
                    <Mail size={14} className="text-blue-400 shrink-0" />
                    <a href={`mailto:${driver?.user?.email}`} className="hover:text-blue-600 transition-colors">{driver?.user?.email}</a>
                  </div>
                </section>

                {/* Identité véhicule */}
                {(driver?.vehicleType || driver?.licenseNumber) && (
                  <section>
                    <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-3">Véhicule & Permis</h3>
                    <div className="bg-charcoal/3 rounded-2xl p-4 grid grid-cols-2 gap-3">
                      {driver.vehicleType && (
                        <div>
                          <p className="font-dm text-xs text-charcoal/50">Véhicule</p>
                          <p className="font-syne font-bold text-sm text-charcoal">{driver.vehicleType} {driver.vehiclePlate ? `· ${driver.vehiclePlate}` : ''}</p>
                        </div>
                      )}
                      {driver.licenseNumber && (
                        <div>
                          <p className="font-dm text-xs text-charcoal/50">N° Permis</p>
                          <p className="font-syne font-bold text-sm text-charcoal">{driver.licenseNumber}</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Plan & Contrat */}
                <section>
                  <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-3">Plan & Contrat</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-charcoal/3 rounded-2xl p-4">
                      <p className="font-dm text-xs text-charcoal/50 mb-1">Plan actuel</p>
                      <p className="font-syne font-bold text-charcoal text-lg">{driver?.plan || 'BASIC'}</p>
                      {driver?.commissionRate != null && (
                        <p className="font-dm text-xs text-charcoal/50 mt-0.5">
                          Commission : {Math.round(driver.commissionRate * 100)}%
                        </p>
                      )}
                    </div>
                    <div className="bg-charcoal/3 rounded-2xl p-4">
                      <p className="font-dm text-xs text-charcoal/50 mb-1">Contrat</p>
                      {driver?.contract ? (
                        <>
                          <p className={`font-syne font-bold text-sm ${driver.contract.status === 'SIGNED' ? 'text-green-600' : 'text-amber-600'}`}>
                            {driver.contract.status === 'SIGNED' ? '✓ Signé' : '⏳ En attente'}
                          </p>
                          {driver.contract.signedAt && (
                            <p className="font-dm text-[11px] text-charcoal/40">le {new Date(driver.contract.signedAt).toLocaleDateString('fr-FR')}</p>
                          )}
                        </>
                      ) : (
                        <p className="font-syne font-bold text-charcoal/40 text-sm">Aucun contrat</p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Performance */}
                <section>
                  <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-3">Performance</h3>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div className="bg-charcoal/3 rounded-2xl p-3 text-center">
                      <p className="font-syne text-xl font-bold text-charcoal">{driver?.totalDeliveries ?? 0}</p>
                      <p className="font-dm text-[10px] text-charcoal/50">Total livraisons</p>
                    </div>
                    <div className="bg-charcoal/3 rounded-2xl p-3 text-center">
                      <p className="font-syne text-xl font-bold text-charcoal">{driver?.rating?.toFixed(1) ?? '—'}</p>
                      <p className="font-dm text-[10px] text-charcoal/50">Note ★</p>
                    </div>
                    <div className="bg-charcoal/3 rounded-2xl p-3 text-center">
                      <p className="font-syne text-xl font-bold text-charcoal">{acceptRate}</p>
                      <p className="font-dm text-[10px] text-charcoal/50">Acceptation</p>
                    </div>
                    <div className="bg-charcoal/3 rounded-2xl p-3 text-center">
                      <p className="font-syne text-lg font-bold text-charcoal">{driver?.warningCount ?? 0}</p>
                      <p className="font-dm text-[10px] text-charcoal/50">Avertissements</p>
                    </div>
                  </div>

                  {/* Ce mois vs mois préc. */}
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-dm text-xs text-charcoal/50 mb-1">Ce mois-ci</p>
                      <p className="font-syne text-lg font-bold text-blue-700">{stats?.thisMonth?.deliveries ?? 0} livraisons</p>
                      <p className="font-dm text-xs text-charcoal/60">{fmt(stats?.thisMonth?.fees ?? 0)} FCFA frais collectés</p>
                      <div className="mt-1">
                        <Trend current={stats?.thisMonth?.deliveries ?? 0} prev={stats?.lastMonth?.deliveries ?? 0} />
                      </div>
                    </div>
                    <div>
                      <p className="font-dm text-xs text-charcoal/50 mb-1">Mois précédent</p>
                      <p className="font-syne text-lg font-bold text-charcoal/60">{stats?.lastMonth?.deliveries ?? 0} livraisons</p>
                      <p className="font-dm text-xs text-charcoal/50">{fmt(stats?.lastMonth?.fees ?? 0)} FCFA frais collectés</p>
                    </div>
                  </div>
                </section>

                {/* Actions */}
                <section>
                  <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-3">Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {driverPreview.status === 'PENDING' && (
                      <button onClick={approve} disabled={!!acting}
                        className="flex items-center gap-1.5 bg-green-600 text-white font-syne text-xs font-bold px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                        <CheckCircle size={14} /> {acting === 'approve' ? 'En cours…' : 'Approuver'}
                      </button>
                    )}
                    {driverPreview.status === 'ACTIVE' && driverPreview.plan !== 'PREMIUM' && (
                      <button onClick={premium} disabled={!!acting}
                        className="flex items-center gap-1.5 bg-purple-600 text-white font-syne text-xs font-bold px-4 py-2 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">
                        <TrendingUp size={14} /> {acting === 'premium' ? 'En cours…' : 'Passer PREMIUM'}
                      </button>
                    )}
                    {driverPreview.status === 'ACTIVE' && (
                      <button onClick={suspend} disabled={!!acting}
                        className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 font-syne text-xs font-bold px-4 py-2 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors">
                        <XCircle size={14} /> Suspendre
                      </button>
                    )}
                    <button onClick={regen} disabled={!!acting}
                      className="flex items-center gap-1.5 bg-charcoal/5 text-charcoal/70 border border-charcoal/15 font-syne text-xs font-bold px-4 py-2 rounded-xl hover:bg-charcoal/10 disabled:opacity-50 transition-colors">
                      <RefreshCw size={14} /> {acting === 'regen' ? 'En cours…' : 'Régénérer contrat'}
                    </button>
                    {driver?.contract?.status === 'PENDING_SIGNATURE' && (
                      <button onClick={remind} disabled={!!acting}
                        className="flex items-center gap-1.5 bg-blue-50 text-blue-600 border border-blue-200 font-syne text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-100 disabled:opacity-50 transition-colors">
                        <Bell size={14} /> {acting === 'remind' ? 'Envoi…' : 'Relancer signature'}
                      </button>
                    )}
                  </div>
                </section>
              </>
            )}

            {/* ══════ TAB ACTIVITÉ ══════ */}
            {!loading && tab === 'activite' && (
              <section>
                <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-4">
                  10 dernières livraisons effectuées
                </h3>
                {(driver?.recentDeliveries ?? []).length === 0 ? (
                  <div className="text-center py-10">
                    <Truck size={32} className="mx-auto mb-2 text-charcoal/20" />
                    <p className="font-dm text-sm text-charcoal/40">Aucune livraison encore</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {driver.recentDeliveries.map(o => (
                      <div key={o.id} className="flex items-center gap-3 bg-charcoal/3 rounded-xl px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-syne text-xs font-bold text-charcoal truncate">
                            {fmtOrderId(o.id, o.createdAt)} · {o.shop?.name || '—'}
                          </p>
                          <p className="font-dm text-xs text-charcoal/50">
                            {o.buyer?.name || 'Client'} · {fmtDate(o.updatedAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-syne text-sm font-bold text-charcoal">{fmt(o.deliveryFee ?? 0)} FCFA</p>
                          <p className="font-dm text-[10px] text-charcoal/40">frais livraison</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ══════ TAB NOTES ══════ */}
            {tab === 'notes' && (
              <CommercialNotes entityType="driver" entityId={driverPreview.id} />
            )}
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  )
}
