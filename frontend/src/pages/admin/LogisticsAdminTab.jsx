import { useEffect, useState } from 'react'
import {
  AlertCircle, Activity, Package, MapPin, Warehouse, Truck, Percent, Route as RouteIcon,
  ShieldAlert, Plus, Trash2, X, Navigation,
} from 'lucide-react'
import { api } from '../../api/client'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

const SUB_TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: Activity },
  { id: 'shipments',  label: 'Livraisons',      icon: Package },
  { id: 'zones',      label: 'Zones',           icon: MapPin },
  { id: 'hubs',       label: 'Hubs',            icon: Warehouse },
  { id: 'vehicles',   label: 'Véhicules',       icon: Truck },
  { id: 'pricing',    label: 'Tarification',    icon: Percent },
  { id: 'routes',     label: 'Tournées',        icon: RouteIcon },
  { id: 'risk',       label: 'Signaux à risque', icon: ShieldAlert },
]

function ErrorBanner({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
      <AlertCircle size={14} className="text-red-500 shrink-0" />
      <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
      {onRetry && <button onClick={onRetry} className="text-red-600 font-bold text-xs underline">Réessayer</button>}
    </div>
  )
}

const STATUS_BADGE = {
  PENDING_PICKUP: 'bg-gray-100 text-gray-500', PICKED_UP: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-blue-100 text-blue-700', ARRIVED: 'bg-amber-100 text-amber-700',
  QR_SCANNED: 'bg-amber-100 text-amber-700', DELIVERED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700', CANCELLED: 'bg-gray-100 text-gray-400',
  PLANNED: 'bg-gray-100 text-gray-500', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
}
const StatusBadge = ({ status }) => (
  <span className={`font-syne text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[status] || 'bg-gray-100 text-gray-400'}`}>
    {status}
  </span>
)

// ─── Tableau de bord ────────────────────────────────────────────────────────
function DashboardPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = async () => {
    try { setData(await api.get('/admin/logistics/dashboard')); setError(null) }
    catch (err) { setError(err.message) }
  }
  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv) }, [])

  if (error) return <ErrorBanner error={error} onRetry={load} />
  if (!data) return <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>

  const cards = [
    { label: 'Livrées aujourd\'hui', value: data.deliveredToday },
    { label: 'Échecs aujourd\'hui', value: data.failedToday, warn: data.failedToday > 0 },
    { label: 'En attente de réaffectation', value: data.escalatedAwaitingReassignment, warn: data.escalatedAwaitingReassignment > 0 },
    { label: 'Durée moyenne de livraison', value: data.avgDeliveryMinutes != null ? `${data.avgDeliveryMinutes} min` : '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`bg-white border rounded-2xl p-4 ${c.warn ? 'border-red-200' : 'border-charcoal/10'}`}>
            <p className="font-dm text-xs text-charcoal/40 mb-1">{c.label}</p>
            <p className={`font-playfair text-2xl font-bold ${c.warn ? 'text-red-600' : 'text-charcoal'}`}>{c.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white border border-charcoal/10 rounded-2xl p-5">
        <h3 className="font-syne font-bold text-charcoal text-sm mb-3">Livraisons par statut</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(data.byStatus).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2 bg-cream rounded-xl px-3 py-2">
              <StatusBadge status={status} />
              <span className="font-syne font-bold text-charcoal text-sm">{count}</span>
            </div>
          ))}
          {Object.keys(data.byStatus).length === 0 && <p className="font-dm text-xs text-charcoal/30 italic">Aucune livraison</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Livraisons (Shipments) ─────────────────────────────────────────────────
function GpsTrailModal({ shipmentId, onClose }) {
  const [trail, setTrail] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get(`/admin/logistics/shipments/${shipmentId}/gps-trail`)
      .then(d => setTrail(d))
      .catch(e => setError(e.message))
  }, [shipmentId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-playfair text-lg font-bold text-charcoal">Trace GPS — Livraison #{shipmentId}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={14} /></button>
        </div>
        <ErrorBanner error={error} />
        {!trail && !error && <p className="font-dm text-sm text-charcoal/40">Chargement…</p>}
        {trail && (
          trail.trail.length === 0 ? (
            <p className="font-dm text-sm text-charcoal/40 italic">Aucun point GPS enregistré pour cette livraison (livreur non assigné, ou historique déjà purgé).</p>
          ) : (
            <div className="space-y-2">
              <p className="font-dm text-sm text-charcoal/70">
                <strong>{trail.trail.length}</strong> points enregistrés entre{' '}
                {new Date(trail.trail[0].createdAt).toLocaleTimeString('fr-FR')} et{' '}
                {new Date(trail.trail[trail.trail.length - 1].createdAt).toLocaleTimeString('fr-FR')}.
              </p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {trail.trail.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-cream rounded-lg px-3 py-1.5 font-dm text-xs text-charcoal/60">
                    <span>{new Date(p.createdAt).toLocaleTimeString('fr-FR')}</span>
                    <span>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
                    {p.accuracy != null && <span>±{Math.round(p.accuracy)}m</span>}
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

function ShipmentsPanel() {
  const [shipments, setShipments] = useState([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [gpsShipmentId, setGpsShipmentId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get(`/admin/logistics/shipments${status ? `?status=${status}` : ''}`)
      setShipments(data.shipments || []); setTotal(data.total || 0); setError(null)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const STATUSES = ['', 'PENDING_PICKUP', 'PICKED_UP', 'ARRIVED', 'QR_SCANNED', 'DELIVERED', 'FAILED']

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onRetry={load} />
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button key={s || 'all'} onClick={() => setStatus(s)}
            className={`font-syne text-xs font-bold px-3 py-1.5 rounded-xl ${status === s ? 'bg-[#1B4332] text-white' : 'bg-white border border-charcoal/10 text-charcoal/50'}`}>
            {s || 'Tous'}
          </button>
        ))}
      </div>
      {loading ? <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div> : (
        <div className="bg-white border border-charcoal/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream">
                <tr className="text-left font-syne text-xs font-bold text-charcoal/50">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Livreur</th>
                  <th className="px-4 py-3">Frais</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Mis à jour</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {shipments.map(s => (
                  <tr key={s.id} className="border-t border-charcoal/5">
                    <td className="px-4 py-3 font-dm text-charcoal/70">#{s.id}</td>
                    <td className="px-4 py-3 font-dm text-charcoal/70">{s.orderId ? `Commande #${s.orderId}` : `B2B #${s.b2bTransactionId}`}</td>
                    <td className="px-4 py-3 font-dm text-charcoal/70">{s.order?.buyer?.name || s.b2bTransaction?.buyer?.name || '—'}</td>
                    <td className="px-4 py-3 font-dm text-charcoal/70">{s.driver?.user?.name || '—'}</td>
                    <td className="px-4 py-3 font-dm text-charcoal/70">{fmt(s.order?.deliveryFee ?? s.b2bTransaction?.deliveryFee)} F</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 font-dm text-xs text-charcoal/40">{new Date(s.updatedAt).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setGpsShipmentId(s.id)} className="font-syne text-[10px] font-bold text-charcoal/50 hover:text-charcoal flex items-center gap-1">
                        <Navigation size={11} /> Trace
                      </button>
                    </td>
                  </tr>
                ))}
                {shipments.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center font-dm text-charcoal/30 italic">Aucune livraison</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-charcoal/5 font-dm text-xs text-charcoal/40">{total} livraison(s) au total</div>
        </div>
      )}
      {gpsShipmentId && <GpsTrailModal shipmentId={gpsShipmentId} onClose={() => setGpsShipmentId(null)} />}
    </div>
  )
}

// ─── Panneau CRUD générique (Zones / Hubs / Véhicules partagent la forme) ──
function useCrud(basePath, itemsKey) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get(basePath)
      setItems(data[itemsKey] || []); setError(null)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { items, loading, error, setError, load }
}

// ─── Zones ──────────────────────────────────────────────────────────────────
function ZonesPanel() {
  const { items: zones, loading, error, setError, load } = useCrud('/admin/logistics/zones', 'zones')
  const [form, setForm] = useState({ name: '', city: '' })
  const [busyId, setBusyId] = useState(null)

  const create = async () => {
    if (!form.name.trim()) return
    try { await api.post('/admin/logistics/zones', form); setForm({ name: '', city: '' }); load() }
    catch (err) { setError(err.message) }
  }
  const toggleActive = async (z) => {
    setBusyId(z.id)
    try { await api.put(`/admin/logistics/zones/${z.id}`, { active: !z.active }); load() }
    catch (err) { setError(err.message) } finally { setBusyId(null) }
  }
  const remove = async (z) => {
    setBusyId(z.id)
    try { await api.delete(`/admin/logistics/zones/${z.id}`); load() }
    catch (err) { setError(err.message) } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onRetry={load} />
      <div className="bg-white border border-charcoal/10 rounded-2xl p-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Nom de la zone</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm" />
        </div>
        <div>
          <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Ville</label>
          <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm" />
        </div>
        <button onClick={create} className="bg-forest text-cream rounded-xl px-3 py-1.5 flex items-center gap-1 font-syne text-xs font-bold"><Plus size={14} /> Ajouter</button>
      </div>
      {loading ? <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {zones.map(z => (
            <div key={z.id} className="bg-white border border-charcoal/10 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className={`font-syne font-bold text-sm ${z.active ? 'text-charcoal' : 'text-charcoal/30 line-through'}`}>{z.name}</p>
                <p className="font-dm text-xs text-charcoal/40">{z.city || '—'} · {z._count?.shops || 0} boutique(s) · {z._count?.hubs || 0} hub(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(z)} disabled={busyId === z.id} className="font-syne text-[10px] font-bold text-charcoal/40 hover:text-charcoal disabled:opacity-50">
                  {z.active ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => remove(z)} disabled={busyId === z.id} className="text-charcoal/30 hover:text-red-500 disabled:opacity-50"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          {zones.length === 0 && <p className="font-dm text-sm text-charcoal/30 italic">Aucune zone</p>}
        </div>
      )}
    </div>
  )
}

// ─── Hubs ───────────────────────────────────────────────────────────────────
function HubsPanel() {
  const { items: hubs, loading, error, setError, load } = useCrud('/admin/logistics/hubs', 'hubs')
  const { items: zones } = useCrud('/admin/logistics/zones', 'zones')
  const [form, setForm] = useState({ name: '', address: '', zoneId: '' })
  const [busyId, setBusyId] = useState(null)

  const create = async () => {
    if (!form.name.trim() || !form.address.trim()) return
    try {
      await api.post('/admin/logistics/hubs', { ...form, zoneId: form.zoneId || null })
      setForm({ name: '', address: '', zoneId: '' }); load()
    } catch (err) { setError(err.message) }
  }
  const toggleActive = async (h) => {
    setBusyId(h.id)
    try { await api.put(`/admin/logistics/hubs/${h.id}`, { active: !h.active }); load() }
    catch (err) { setError(err.message) } finally { setBusyId(null) }
  }
  const remove = async (h) => {
    setBusyId(h.id)
    try { await api.delete(`/admin/logistics/hubs/${h.id}`); load() }
    catch (err) { setError(err.message) } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onRetry={load} />
      <div className="bg-white border border-charcoal/10 rounded-2xl p-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Nom du hub</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm" />
        </div>
        <div>
          <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Adresse</label>
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm" />
        </div>
        <div>
          <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Zone</label>
          <select value={form.zoneId} onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))}
            className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm">
            <option value="">—</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        <button onClick={create} className="bg-forest text-cream rounded-xl px-3 py-1.5 flex items-center gap-1 font-syne text-xs font-bold"><Plus size={14} /> Ajouter</button>
      </div>
      {loading ? <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hubs.map(h => (
            <div key={h.id} className="bg-white border border-charcoal/10 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className={`font-syne font-bold text-sm ${h.active ? 'text-charcoal' : 'text-charcoal/30 line-through'}`}>{h.name}</p>
                <p className="font-dm text-xs text-charcoal/40">{h.address} · {h.zone?.name || 'sans zone'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(h)} disabled={busyId === h.id} className="font-syne text-[10px] font-bold text-charcoal/40 hover:text-charcoal disabled:opacity-50">
                  {h.active ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => remove(h)} disabled={busyId === h.id} className="text-charcoal/30 hover:text-red-500 disabled:opacity-50"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          {hubs.length === 0 && <p className="font-dm text-sm text-charcoal/30 italic">Aucun hub</p>}
        </div>
      )}
    </div>
  )
}

// ─── Véhicules ──────────────────────────────────────────────────────────────
function VehiclesPanel() {
  const { items: vehicles, loading, error, setError, load } = useCrud('/admin/logistics/vehicle-types', 'vehicleTypes')
  const [form, setForm] = useState({ code: '', label: '', capacityKg: '', maxDeliveryFee: '' })
  const [busyId, setBusyId] = useState(null)

  const create = async () => {
    if (!form.code.trim() || !form.label.trim() || !(Number(form.capacityKg) > 0)) return
    try {
      await api.post('/admin/logistics/vehicle-types', {
        code: form.code, label: form.label, capacityKg: Number(form.capacityKg),
        maxDeliveryFee: form.maxDeliveryFee ? Number(form.maxDeliveryFee) : null,
      })
      setForm({ code: '', label: '', capacityKg: '', maxDeliveryFee: '' }); load()
    } catch (err) { setError(err.message) }
  }
  const toggleActive = async (v) => {
    setBusyId(v.id)
    try { await api.put(`/admin/logistics/vehicle-types/${v.id}`, { active: !v.active }); load() }
    catch (err) { setError(err.message) } finally { setBusyId(null) }
  }
  const remove = async (v) => {
    setBusyId(v.id)
    try { await api.delete(`/admin/logistics/vehicle-types/${v.id}`); load() }
    catch (err) { setError(err.message) } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onRetry={load} />
      <div className="bg-white border border-charcoal/10 rounded-2xl p-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Code</label>
          <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="MOTO"
            className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-28" />
        </div>
        <div>
          <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Libellé</label>
          <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Moto"
            className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm" />
        </div>
        <div>
          <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Capacité (kg)</label>
          <input type="number" value={form.capacityKg} onChange={e => setForm(f => ({ ...f, capacityKg: e.target.value }))}
            className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-28" />
        </div>
        <div>
          <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Plafond frais (F)</label>
          <input type="number" value={form.maxDeliveryFee} onChange={e => setForm(f => ({ ...f, maxDeliveryFee: e.target.value }))}
            className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-32" />
        </div>
        <button onClick={create} className="bg-forest text-cream rounded-xl px-3 py-1.5 flex items-center gap-1 font-syne text-xs font-bold"><Plus size={14} /> Ajouter</button>
      </div>
      {loading ? <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {vehicles.map(v => (
            <div key={v.id} className="bg-white border border-charcoal/10 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className={`font-syne font-bold text-sm ${v.active ? 'text-charcoal' : 'text-charcoal/30 line-through'}`}>{v.label} <span className="text-charcoal/30">({v.code})</span></p>
                <p className="font-dm text-xs text-charcoal/40">Capacité {fmt(v.capacityKg)} kg · Plafond {v.maxDeliveryFee != null ? `${fmt(v.maxDeliveryFee)} F` : '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(v)} disabled={busyId === v.id} className="font-syne text-[10px] font-bold text-charcoal/40 hover:text-charcoal disabled:opacity-50">
                  {v.active ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => remove(v)} disabled={busyId === v.id} className="text-charcoal/30 hover:text-red-500 disabled:opacity-50"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          {vehicles.length === 0 && <p className="font-dm text-sm text-charcoal/30 italic">Aucun véhicule</p>}
        </div>
      )}
    </div>
  )
}

// ─── Tarification (PricingRule, LOT6) ───────────────────────────────────────
function PricingPanel() {
  const { items: rules, loading, error, setError, load } = useCrud('/admin/logistics/pricing-rules', 'pricingRules')
  const { items: zones } = useCrud('/admin/logistics/zones', 'zones')
  const [form, setForm] = useState({
    segment: 'SMALL_MEDIUM', serviceLevel: 'STANDARD', originZoneId: '', destinationZoneId: '',
    basePrice: '', pricePerKg: '', pricePerKm: '', marginPct: '0.20', maxDeliveryFee: '',
  })
  const [busyId, setBusyId] = useState(null)

  const create = async () => {
    if (!(Number(form.basePrice) >= 0)) return
    try {
      await api.post('/admin/logistics/pricing-rules', {
        ...form,
        originZoneId: form.originZoneId || null, destinationZoneId: form.destinationZoneId || null,
        basePrice: Number(form.basePrice), pricePerKg: Number(form.pricePerKg) || 0, pricePerKm: Number(form.pricePerKm) || 0,
        marginPct: Number(form.marginPct), maxDeliveryFee: form.maxDeliveryFee ? Number(form.maxDeliveryFee) : null,
      })
      setForm(f => ({ ...f, basePrice: '', pricePerKg: '', pricePerKm: '', maxDeliveryFee: '' })); load()
    } catch (err) { setError(err.message) }
  }
  const toggleActive = async (r) => {
    setBusyId(r.id)
    try { await api.put(`/admin/logistics/pricing-rules/${r.id}`, { active: !r.active }); load() }
    catch (err) { setError(err.message) } finally { setBusyId(null) }
  }
  const remove = async (r) => {
    setBusyId(r.id)
    try { await api.delete(`/admin/logistics/pricing-rules/${r.id}`); load() }
    catch (err) { setError(err.message) } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onRetry={load} />
      <div className="bg-white border border-charcoal/10 rounded-2xl p-4 space-y-3">
        <p className="font-dm text-xs text-charcoal/40">Origine/destination vides = règle par défaut (joker) pour ce segment/niveau de service. Prix client = coût interne × (1 + marge).</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Segment</label>
            <select value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
              className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm">
              <option value="SMALL_MEDIUM">SMALL_MEDIUM (B2C)</option>
              <option value="B2B_CARGO">B2B_CARGO</option>
            </select>
          </div>
          <div>
            <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Niveau de service</label>
            <select value={form.serviceLevel} onChange={e => setForm(f => ({ ...f, serviceLevel: e.target.value }))}
              className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm">
              <option value="ECONOMIC">ECONOMIC</option>
              <option value="STANDARD">STANDARD</option>
              <option value="EXPRESS">EXPRESS</option>
            </select>
          </div>
          <div>
            <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Zone origine</label>
            <select value={form.originZoneId} onChange={e => setForm(f => ({ ...f, originZoneId: e.target.value }))}
              className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm">
              <option value="">Joker</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div>
            <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Zone destination</label>
            <select value={form.destinationZoneId} onChange={e => setForm(f => ({ ...f, destinationZoneId: e.target.value }))}
              className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm">
              <option value="">Joker</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Base (F)</label>
            <input type="number" value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))}
              className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-24" />
          </div>
          <div>
            <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">F/kg</label>
            <input type="number" value={form.pricePerKg} onChange={e => setForm(f => ({ ...f, pricePerKg: e.target.value }))}
              className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-20" />
          </div>
          <div>
            <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">F/km</label>
            <input type="number" value={form.pricePerKm} onChange={e => setForm(f => ({ ...f, pricePerKm: e.target.value }))}
              className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-20" />
          </div>
          <div>
            <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Marge (0.20 = 20%)</label>
            <input type="number" step="0.01" value={form.marginPct} onChange={e => setForm(f => ({ ...f, marginPct: e.target.value }))}
              className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-24" />
          </div>
          <div>
            <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Plafond (F)</label>
            <input type="number" value={form.maxDeliveryFee} onChange={e => setForm(f => ({ ...f, maxDeliveryFee: e.target.value }))}
              className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-28" />
          </div>
          <button onClick={create} className="bg-forest text-cream rounded-xl px-3 py-1.5 flex items-center gap-1 font-syne text-xs font-bold"><Plus size={14} /> Ajouter</button>
        </div>
      </div>
      {loading ? <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div> : (
        <div className="bg-white border border-charcoal/10 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr className="text-left font-syne text-xs font-bold text-charcoal/50">
                <th className="px-4 py-3">Segment</th><th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Corridor</th><th className="px-4 py-3">Base</th>
                <th className="px-4 py-3">F/kg</th><th className="px-4 py-3">F/km</th>
                <th className="px-4 py-3">Marge</th><th className="px-4 py-3">Plafond</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className="border-t border-charcoal/5">
                  <td className="px-4 py-3 font-dm text-charcoal/70">{r.segment}</td>
                  <td className="px-4 py-3 font-dm text-charcoal/70">{r.serviceLevel}</td>
                  <td className="px-4 py-3 font-dm text-charcoal/70">{r.originZone?.name || 'Joker'} → {r.destinationZone?.name || 'Joker'}</td>
                  <td className="px-4 py-3 font-dm text-charcoal/70">{fmt(r.basePrice)} F</td>
                  <td className="px-4 py-3 font-dm text-charcoal/70">{fmt(r.pricePerKg)}</td>
                  <td className="px-4 py-3 font-dm text-charcoal/70">{fmt(r.pricePerKm)}</td>
                  <td className="px-4 py-3 font-dm text-charcoal/70">{Math.round(r.marginPct * 100)}%</td>
                  <td className="px-4 py-3 font-dm text-charcoal/70">{r.maxDeliveryFee != null ? `${fmt(r.maxDeliveryFee)} F` : '—'}</td>
                  <td className="px-4 py-3 flex items-center gap-2 whitespace-nowrap">
                    <button onClick={() => toggleActive(r)} disabled={busyId === r.id} className="font-syne text-[10px] font-bold text-charcoal/40 hover:text-charcoal disabled:opacity-50">
                      {r.active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button onClick={() => remove(r)} disabled={busyId === r.id} className="text-charcoal/30 hover:text-red-500 disabled:opacity-50"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center font-dm text-charcoal/30 italic">Aucune règle — la tarification retombe sur l'ancien forfait (véhicule/plateforme)</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tournées (Route/RouteStop, LOT7) ───────────────────────────────────────
function RouteDetailModal({ routeId, onClose, onChanged }) {
  const [route, setRoute] = useState(null)
  const [error, setError] = useState(null)
  const [stopForm, setStopForm] = useState({ shipmentId: '', order: '' })

  const load = async () => {
    try { setRoute((await api.get(`/admin/logistics/routes/${routeId}`)).route); setError(null) }
    catch (err) { setError(err.message) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addStop = async () => {
    if (!stopForm.shipmentId || !(Number(stopForm.order) > 0)) return
    try {
      await api.post(`/admin/logistics/routes/${routeId}/stops`, { shipmentId: Number(stopForm.shipmentId), order: Number(stopForm.order) })
      setStopForm({ shipmentId: '', order: '' }); load(); onChanged()
    } catch (err) { setError(err.message) }
  }
  const removeStop = async (stopId) => {
    try { await api.delete(`/admin/logistics/routes/${routeId}/stops/${stopId}`); load(); onChanged() }
    catch (err) { setError(err.message) }
  }
  const cancelRoute = async () => {
    try { await api.put(`/admin/logistics/routes/${routeId}/cancel`, {}); load(); onChanged() }
    catch (err) { setError(err.message) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-playfair text-lg font-bold text-charcoal">Tournée #{routeId}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={14} /></button>
        </div>
        <ErrorBanner error={error} />
        {!route ? <p className="font-dm text-sm text-charcoal/40">Chargement…</p> : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <StatusBadge status={route.status} />
              <span className="font-dm text-sm text-charcoal/60">Livreur : {route.driver?.user?.name}</span>
              {!['COMPLETED', 'CANCELLED'].includes(route.status) && (
                <button onClick={cancelRoute} className="ml-auto font-syne text-xs font-bold text-red-500 hover:text-red-700">Annuler la tournée</button>
              )}
            </div>
            <div className="space-y-2">
              {route.stops.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-cream rounded-xl px-3 py-2">
                  <span className="font-dm text-sm text-charcoal/70">#{s.order} — Livraison #{s.shipmentId} ({s.shipment?.orderId ? `Commande #${s.shipment.orderId}` : `B2B #${s.shipment?.b2bTransactionId}`})</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s.status} />
                    {s.status === 'PENDING' && (
                      <button onClick={() => removeStop(s.id)} className="text-charcoal/30 hover:text-red-500"><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
              ))}
              {route.stops.length === 0 && <p className="font-dm text-xs text-charcoal/30 italic">Aucun arrêt</p>}
            </div>
            {!['COMPLETED', 'CANCELLED'].includes(route.status) && (
              <div className="flex gap-2 items-end pt-2 border-t border-charcoal/10">
                <div>
                  <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">ID Livraison (Shipment)</label>
                  <input type="number" value={stopForm.shipmentId} onChange={e => setStopForm(f => ({ ...f, shipmentId: e.target.value }))}
                    className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-32" />
                </div>
                <div>
                  <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">Ordre</label>
                  <input type="number" value={stopForm.order} onChange={e => setStopForm(f => ({ ...f, order: e.target.value }))}
                    className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-20" />
                </div>
                <button onClick={addStop} className="bg-forest text-cream rounded-xl px-3 py-1.5 flex items-center gap-1 font-syne text-xs font-bold"><Plus size={14} /> Ajouter un arrêt</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function RoutesPanel() {
  const { items: routes, loading, error, setError, load } = useCrud('/admin/logistics/routes', 'routes')
  const [driverId, setDriverId] = useState('')
  const [detailId, setDetailId] = useState(null)

  const create = async () => {
    if (!driverId) return
    try { await api.post('/admin/logistics/routes', { driverId: Number(driverId) }); setDriverId(''); load() }
    catch (err) { setError(err.message) }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onRetry={load} />
      <div className="bg-white border border-charcoal/10 rounded-2xl p-4 flex gap-2 items-end">
        <div>
          <label className="font-syne text-[10px] font-bold text-charcoal/40 block mb-1">ID du livreur</label>
          <input type="number" value={driverId} onChange={e => setDriverId(e.target.value)}
            className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-1.5 font-dm text-sm w-32" />
        </div>
        <button onClick={create} className="bg-forest text-cream rounded-xl px-3 py-1.5 flex items-center gap-1 font-syne text-xs font-bold"><Plus size={14} /> Créer une tournée</button>
        <p className="font-dm text-xs text-charcoal/40 ml-2">Trouvez l'ID d'un livreur dans l'onglet Livreurs.</p>
      </div>
      {loading ? <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {routes.map(r => (
            <button key={r.id} onClick={() => setDetailId(r.id)}
              className="text-left bg-white border border-charcoal/10 rounded-2xl p-4 hover:border-charcoal/30 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <p className="font-syne font-bold text-sm text-charcoal">Tournée #{r.id} — {r.driver?.user?.name}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="font-dm text-xs text-charcoal/40">{r.stops.length} arrêt(s)</p>
            </button>
          ))}
          {routes.length === 0 && <p className="font-dm text-sm text-charcoal/30 italic">Aucune tournée</p>}
        </div>
      )}
      {detailId && <RouteDetailModal routeId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  )
}

// ─── Signaux à risque (LOT15) ───────────────────────────────────────────────
function RiskPanel() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    try { setDrivers((await api.get('/admin/logistics/risk-signals')).flaggedDrivers || []); setError(null) }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onRetry={load} />
      <p className="font-dm text-xs text-charcoal/40">Livreurs dont le taux d'échec sur les 30 derniers jours dépasse 30% (minimum 3 livraisons) — un simple signal à examiner, pas une décision automatique.</p>
      {loading ? <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div> : (
        drivers.length === 0 ? (
          <p className="font-dm text-sm text-charcoal/30 italic">Aucun signal — tous les livreurs actifs sont dans les clous.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {drivers.map(d => (
              <div key={d.driverId} className="bg-white border border-red-200 rounded-2xl p-4">
                <p className="font-syne font-bold text-sm text-charcoal">{d.driverName}</p>
                <p className="font-dm text-xs text-charcoal/50">{d.failedDeliveries30d}/{d.totalDeliveries30d} échecs (30j)</p>
                <p className="font-playfair text-lg font-bold text-red-600">{Math.round(d.failureRate * 100)}%</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

export default function LogisticsAdminTab() {
  const [sub, setSub] = useState('dashboard')

  return (
    <div className="space-y-6">
      <h1 className="font-playfair text-2xl font-bold text-charcoal">Logistique</h1>
      <div className="flex gap-2 flex-wrap">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSub(id)}
            className={`flex items-center gap-1.5 font-syne text-sm font-bold px-4 py-2 rounded-xl transition-colors ${
              sub === id ? 'bg-[#1B4332] text-white' : 'bg-white border border-charcoal/10 text-charcoal/50'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {sub === 'dashboard' && <DashboardPanel />}
      {sub === 'shipments' && <ShipmentsPanel />}
      {sub === 'zones' && <ZonesPanel />}
      {sub === 'hubs' && <HubsPanel />}
      {sub === 'vehicles' && <VehiclesPanel />}
      {sub === 'pricing' && <PricingPanel />}
      {sub === 'routes' && <RoutesPanel />}
      {sub === 'risk' && <RiskPanel />}
    </div>
  )
}
