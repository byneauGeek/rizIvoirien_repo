import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/client'
import { Shield, RefreshCw, User, Store, Truck, Settings, AlertTriangle, Ban } from 'lucide-react'
import { motion } from 'framer-motion'

const ACTION_UI = {
  DRIVER_STATUS:    { label: 'Statut livreur',   icon: Truck,         color: 'text-blue-600',   bg: 'bg-blue-50' },
  SHOP_STATUS:      { label: 'Statut boutique',   icon: Store,         color: 'text-forest',     bg: 'bg-forest/5' },
  USER_BAN:         { label: 'Suspension',         icon: Ban,           color: 'text-red-600',    bg: 'bg-red-50' },
  USER_UNBAN:       { label: 'Réactivation',       icon: User,          color: 'text-green-600',  bg: 'bg-green-50' },
  SETTINGS_UPDATE:  { label: 'Paramètres',         icon: Settings,      color: 'text-amber-600',  bg: 'bg-amber-50' },
  DISPUTE_RESOLVE:  { label: 'Litige résolu',      icon: AlertTriangle, color: 'text-purple-600', bg: 'bg-purple-50' },
}

const fmtDate = (d) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function parseDetails(raw) {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function DetailBadge({ details, action }) {
  const d = parseDetails(details)
  if (action === 'DRIVER_STATUS')   return <span className="font-dm text-xs text-charcoal/50">→ <strong>{d.status}</strong>{d.driverName ? ` · ${d.driverName}` : ''}</span>
  if (action === 'SHOP_STATUS')     return <span className="font-dm text-xs text-charcoal/50">→ <strong>{d.status}</strong>{d.shopName ? ` · ${d.shopName}` : ''}</span>
  if (action === 'USER_BAN' || action === 'USER_UNBAN') return <span className="font-dm text-xs text-charcoal/50">{d.userName}</span>
  if (action === 'DISPUTE_RESOLVE') return <span className="font-dm text-xs text-charcoal/50">→ <strong>{d.status}</strong>{d.refundAmount > 0 ? ` · ${Number(d.refundAmount).toLocaleString('fr-FR')} FCFA` : ''}</span>
  if (action === 'SETTINGS_UPDATE') {
    const keys = Object.keys(d).filter(k => !['id','updatedAt'].includes(k))
    return <span className="font-dm text-xs text-charcoal/50">{keys.slice(0, 3).join(', ')}{keys.length > 3 ? ` +${keys.length - 3}` : ''}</span>
  }
  return null
}

export default function AuditLogTab() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    try { setLogs(await api.get('/admin/audit-logs')) }
    catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const actions = ['ALL', ...Object.keys(ACTION_UI)]
  const filtered = filter === 'ALL' ? logs : logs.filter(l => l.action === filter)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Administration</p>
          <h1 className="font-playfair text-3xl font-bold text-charcoal">Journal d'audit</h1>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-charcoal/10 rounded-2xl font-syne text-sm font-bold text-charcoal/60 hover:text-charcoal transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {actions.map(a => {
          const ui = ACTION_UI[a]
          return (
            <button key={a} onClick={() => setFilter(a)}
              className={`px-3 py-1.5 rounded-xl font-syne text-xs font-bold transition-colors ${filter === a ? 'bg-charcoal text-cream' : 'bg-white border border-charcoal/10 text-charcoal/50 hover:text-charcoal'}`}>
              {ui?.label || 'Tous'}
            </button>
          )
        })}
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(ACTION_UI).map(([action, ui]) => {
          const count = logs.filter(l => l.action === action).length
          const Icon = ui.icon
          return (
            <div key={action} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-50 text-center">
              <div className={`w-8 h-8 rounded-xl ${ui.bg} flex items-center justify-center mx-auto mb-1`}>
                <Icon size={14} className={ui.color} />
              </div>
              <p className="font-playfair text-xl font-bold text-charcoal">{count}</p>
              <p className="font-dm text-[10px] text-charcoal/40">{ui.label}</p>
            </div>
          )
        })}
      </div>

      {/* Liste */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Shield size={14} className="text-forest" />
          <p className="font-syne text-xs font-bold uppercase tracking-wider text-charcoal/40">
            {filtered.length} action{filtered.length !== 1 ? 's' : ''} enregistrée{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Shield size={36} className="mx-auto text-charcoal/20 mb-3" />
            <p className="font-dm text-charcoal/40">Aucune action enregistrée</p>
          </div>
        ) : (
          <div className="divide-y divide-charcoal/5">
            {filtered.map((log, i) => {
              const ui = ACTION_UI[log.action] || { label: log.action, icon: Shield, color: 'text-charcoal', bg: 'bg-gray-50' }
              const Icon = ui.icon
              return (
                <motion.div key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-4 px-6 py-4"
                >
                  <div className={`w-9 h-9 rounded-xl ${ui.bg} flex items-center justify-center shrink-0`}>
                    <Icon size={15} className={ui.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-syne text-sm font-bold text-charcoal">{ui.label}</p>
                      <DetailBadge details={log.details} action={log.action} />
                    </div>
                    <p className="font-dm text-xs text-charcoal/40 mt-0.5">par <strong>{log.adminName}</strong></p>
                  </div>
                  <p className="font-dm text-xs text-charcoal/30 shrink-0">{fmtDate(log.createdAt)}</p>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
