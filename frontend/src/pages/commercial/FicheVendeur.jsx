import { useState, useEffect } from 'react'
import { X, Phone, Mail, MapPin, CheckCircle, Clock, XCircle, Star, RefreshCw, Bell, TrendingUp, TrendingDown, Package, ShoppingBag, Calendar, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../api/client'
import { fmt, fmtDate, fmtShopId, fmtOrderId, STATUS_LABELS, STATUS_COLORS } from '../../utils/status'
import CommercialNotes from './CommercialNotes'

const SHOP_STATUS = {
  PENDING:   { label: 'En attente', color: 'bg-amber-100 text-amber-800' },
  ACTIVE:    { label: 'Actif',      color: 'bg-green-100 text-green-800' },
  SUSPENDED: { label: 'Suspendu',   color: 'bg-red-100 text-red-800' },
  REJECTED:  { label: 'Rejeté',     color: 'bg-gray-100 text-gray-700' },
}

function subBadge(days) {
  if (days === null) return null
  if (days < 0)  return { label: `Expiré il y a ${Math.abs(days)}j`, cls: 'bg-red-100 text-red-700 border border-red-200' }
  if (days <= 7) return { label: `Expire dans ${days}j`, cls: 'bg-red-100 text-red-700 border border-red-200' }
  if (days <= 30) return { label: `Expire dans ${days}j`, cls: 'bg-amber-100 text-amber-700 border border-amber-200' }
  return { label: `${days}j restants`, cls: 'bg-green-100 text-green-700 border border-green-200' }
}

function Trend({ current, prev, suffix = '' }) {
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

export default function FicheVendeur({ shop: shopPreview, onClose, onRefresh }) {
  const [shop, setShop]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const [error, setError]   = useState(null)
  const [tab, setTab]       = useState('apercu') // 'apercu' | 'activite'

  useEffect(() => {
    if (!shopPreview?.id) return
    setLoading(true)
    api.get(`/commercial/shops/${shopPreview.id}`)
      .then(setShop)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [shopPreview?.id])

  if (!shopPreview) return null

  const statusInfo = SHOP_STATUS[shopPreview.status] || SHOP_STATUS.PENDING
  const sub        = shop?.subscription
  const badge      = subBadge(shop?.daysRemaining ?? null)
  const stats      = shop?.stats

  const doAction = async (label, fn) => {
    setActing(label); setError(null)
    try {
      await fn()
      // Refresh detail
      const updated = await api.get(`/commercial/shops/${shopPreview.id}`)
      setShop(updated)
      onRefresh?.()
    } catch (e) { setError(e.message) }
    finally { setActing(null) }
  }

  const approve = () => doAction('approve', () => api.put(`/admin/shops/${shopPreview.id}/status`, { status: 'ACTIVE' }))
  const certify = () => doAction('certify', () => api.put(`/admin/shops/${shopPreview.id}/certify`, { certified: true }))
  const suspend = () => {
    const note = prompt('Motif de suspension (requis)')
    if (!note?.trim()) return
    doAction('suspend', () => api.put(`/admin/shops/${shopPreview.id}/status`, { status: 'SUSPENDED', note }))
  }
  const regen  = () => doAction('regen',  () => api.post(`/admin/contracts/regenerate/shop/${shopPreview.id}`))
  const remind = () => doAction('remind', () => api.post(`/commercial/shops/${shopPreview.id}/remind-contract`))

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
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
              <span className="font-playfair font-bold text-indigo-600 text-xl">{shopPreview.name?.[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-playfair text-xl font-bold text-charcoal truncate">{shopPreview.name}</h2>
                <span className={`font-syne text-xs font-bold px-2.5 py-0.5 rounded-full ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                {shopPreview.certified && (
                  <span className="font-syne text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">★ Certifiée</span>
                )}
              </div>
              <p className="font-dm text-xs text-charcoal/50">{fmtShopId(shopPreview.id)} · {shopPreview.user?.name}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-charcoal/5 text-charcoal/50 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-charcoal/10 px-6">
            {[['apercu', 'Aperçu'], ['activite', 'Activité récente'], ['notes', 'Notes CRM']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`font-syne text-xs font-bold px-4 py-3 border-b-2 transition-colors ${
                  tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-charcoal/50 hover:text-charcoal'
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
                <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            )}

            {/* ══════ TAB APERÇU ══════ */}
            {!loading && tab === 'apercu' && (
              <>
                {/* Contact rapide */}
                <section className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                  <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3">Contact rapide</h3>
                  {shop?.user?.phone && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 font-dm text-sm text-charcoal flex-1">
                        <Phone size={14} className="text-indigo-400 shrink-0" />
                        <a href={`tel:${shop.user.phone}`} className="hover:text-indigo-600 font-bold transition-colors">{shop.user.phone}</a>
                      </div>
                      <a
                        href={`https://wa.me/${shop.user.phone.replace(/\D/g, '')}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 font-syne text-xs font-bold bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors"
                      >
                        WhatsApp
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 font-dm text-sm text-charcoal">
                    <Mail size={14} className="text-indigo-400 shrink-0" />
                    <a href={`mailto:${shop?.user?.email}`} className="hover:text-indigo-600 transition-colors">{shop?.user?.email}</a>
                  </div>
                  {shop?.location && (
                    <div className="flex items-center gap-1.5 font-dm text-sm text-charcoal">
                      <MapPin size={14} className="text-indigo-400 shrink-0" />
                      {shop.location}
                    </div>
                  )}
                </section>

                {/* Abonnement */}
                <section>
                  <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-3">Abonnement</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-charcoal/3 rounded-2xl p-4">
                      <p className="font-dm text-xs text-charcoal/50 mb-1">Plan</p>
                      <p className="font-syne font-bold text-charcoal text-lg">{shop?.plan || shopPreview.plan || 'BASIC'}</p>
                    </div>
                    <div className="bg-charcoal/3 rounded-2xl p-4">
                      <p className="font-dm text-xs text-charcoal/50 mb-1">Durée restante</p>
                      {badge ? (
                        <span className={`font-syne text-xs font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
                      ) : (
                        <p className="font-syne font-bold text-charcoal/40 text-sm">Pas d'abonnement</p>
                      )}
                      {sub?.endDate && (
                        <p className="font-dm text-[11px] text-charcoal/40 mt-1">
                          Expire le {new Date(sub.endDate).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                    <div className="bg-charcoal/3 rounded-2xl p-4">
                      <p className="font-dm text-xs text-charcoal/50 mb-1">Contrat</p>
                      {shop?.contract ? (
                        <>
                          <p className={`font-syne font-bold text-sm ${shop.contract.status === 'SIGNED' ? 'text-green-600' : 'text-amber-600'}`}>
                            {shop.contract.status === 'SIGNED' ? '✓ Signé' : '⏳ En attente'}
                          </p>
                          {shop.contract.signedAt && (
                            <p className="font-dm text-[11px] text-charcoal/40">le {new Date(shop.contract.signedAt).toLocaleDateString('fr-FR')}</p>
                          )}
                        </>
                      ) : (
                        <p className="font-syne font-bold text-charcoal/40 text-sm">Aucun contrat</p>
                      )}
                    </div>
                    <div className="bg-charcoal/3 rounded-2xl p-4">
                      <p className="font-dm text-xs text-charcoal/50 mb-1">Certification</p>
                      <p className={`font-syne font-bold text-sm ${shop?.certified ? 'text-amber-600' : 'text-charcoal/40'}`}>
                        {shop?.certified ? '★ Certifiée' : 'Non certifiée'}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Performance */}
                <section>
                  <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-3">Performance</h3>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-charcoal/3 rounded-2xl p-4">
                      <p className="font-syne text-xl font-bold text-charcoal">{stats?.total?.orders ?? 0}</p>
                      <p className="font-dm text-xs text-charcoal/50">Commandes totales</p>
                    </div>
                    <div className="bg-charcoal/3 rounded-2xl p-4">
                      <p className="font-syne text-xl font-bold text-charcoal">{fmt(stats?.total?.revenue ?? 0)}</p>
                      <p className="font-dm text-xs text-charcoal/50">CA total (FCFA)</p>
                    </div>
                    <div className="bg-charcoal/3 rounded-2xl p-4">
                      <p className="font-syne text-xl font-bold text-charcoal">{shop?._count?.products ?? shopPreview._count?.products ?? 0}</p>
                      <p className="font-dm text-xs text-charcoal/50">Produits</p>
                    </div>
                  </div>

                  {/* Ce mois vs mois préc. */}
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-dm text-xs text-charcoal/50 mb-1">Ce mois-ci</p>
                      <p className="font-syne text-lg font-bold text-indigo-700">{fmt(stats?.thisMonth?.revenue ?? 0)} FCFA</p>
                      <p className="font-dm text-xs text-charcoal/60">{stats?.thisMonth?.orders ?? 0} commandes livrées</p>
                      <div className="mt-1">
                        <Trend current={stats?.thisMonth?.revenue ?? 0} prev={stats?.lastMonth?.revenue ?? 0} />
                      </div>
                    </div>
                    <div>
                      <p className="font-dm text-xs text-charcoal/50 mb-1">Mois précédent</p>
                      <p className="font-syne text-lg font-bold text-charcoal/60">{fmt(stats?.lastMonth?.revenue ?? 0)} FCFA</p>
                      <p className="font-dm text-xs text-charcoal/50">{stats?.lastMonth?.orders ?? 0} commandes livrées</p>
                    </div>
                  </div>
                </section>

                {/* Actions */}
                <section>
                  <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/50 mb-3">Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {shopPreview.status === 'PENDING' && (
                      <button onClick={approve} disabled={!!acting}
                        className="flex items-center gap-1.5 bg-green-600 text-white font-syne text-xs font-bold px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                        <CheckCircle size={14} /> {acting === 'approve' ? 'En cours…' : 'Approuver'}
                      </button>
                    )}
                    {shopPreview.status === 'ACTIVE' && !shopPreview.certified && (
                      <button onClick={certify} disabled={!!acting}
                        className="flex items-center gap-1.5 bg-amber-500 text-white font-syne text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors">
                        <Star size={14} /> {acting === 'certify' ? 'En cours…' : 'Certifier'}
                      </button>
                    )}
                    {shopPreview.status === 'ACTIVE' && (
                      <button onClick={suspend} disabled={!!acting}
                        className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 font-syne text-xs font-bold px-4 py-2 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors">
                        <XCircle size={14} /> Suspendre
                      </button>
                    )}
                    <button onClick={regen} disabled={!!acting}
                      className="flex items-center gap-1.5 bg-charcoal/5 text-charcoal/70 border border-charcoal/15 font-syne text-xs font-bold px-4 py-2 rounded-xl hover:bg-charcoal/10 disabled:opacity-50 transition-colors">
                      <RefreshCw size={14} /> {acting === 'regen' ? 'En cours…' : 'Régénérer contrat'}
                    </button>
                    {shop?.contract?.status === 'PENDING_SIGNATURE' && (
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
                  10 dernières commandes
                </h3>
                {(shop?.recentOrders ?? []).length === 0 ? (
                  <div className="text-center py-10">
                    <ShoppingBag size={32} className="mx-auto mb-2 text-charcoal/20" />
                    <p className="font-dm text-sm text-charcoal/40">Aucune commande encore</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {shop.recentOrders.map(o => (
                      <div key={o.id} className="flex items-center gap-3 bg-charcoal/3 rounded-xl px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-syne text-xs font-bold text-charcoal truncate">
                              {fmtOrderId(o.id, o.createdAt)}
                            </p>
                            <span className={`font-syne text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_LABELS[o.status] || o.status}
                            </span>
                          </div>
                          <p className="font-dm text-xs text-charcoal/50">{o.buyer?.name || 'Client'} · {fmtDate(o.createdAt)}</p>
                        </div>
                        <p className="font-syne text-sm font-bold text-charcoal shrink-0">{fmt(o.total)} FCFA</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ══════ TAB NOTES ══════ */}
            {tab === 'notes' && (
              <CommercialNotes entityType="shop" entityId={shopPreview.id} />
            )}
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  )
}
