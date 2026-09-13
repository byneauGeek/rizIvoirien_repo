import { useEffect, useState } from 'react'
import { Search, AlertCircle, Package, MessageCircle, Check, Flag, ShieldAlert } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useB2BReferenceData } from '../../hooks/useB2BReferenceData'
import { B2B_ROLE_META } from './roleMeta'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

function SellerBadge({ item }) {
  const name = item.producer ? `Producteur — ${item.producer.user?.name || ''}` : item.cooperative?.name
  return <p className="font-dm text-sm text-charcoal/50">{name} · {item.producer?.region || item.cooperative?.region}</p>
}
function BuyerBadge({ item }) {
  const actor = item.trader || item.processor || item.exporter
  return <p className="font-dm text-sm text-charcoal/50">{actor?.companyName}</p>
}

export default function MarketplaceTab() {
  const { user } = useAuth()
  const { regions: CI_REGIONS, products: RICE_PRODUCTS } = useB2BReferenceData()
  // Par défaut, on affiche le côté "opposé" du marché : un vendeur (offre)
  // veut d'abord voir les demandes, un acheteur veut voir les offres.
  // Visiteur non connecté (page publique) : on démarre sur les offres.
  const myKind = user && B2B_ROLE_META[user.role]?.kind
  const [view, setView] = useState(myKind === 'offer' ? 'requests' : 'offers')
  const [filters, setFilters] = useState({ product: '', region: '', search: '', minQuantity: '', availableBy: '', actorType: '' })
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [contactingId, setContactingId] = useState(null)
  const [contactedIds, setContactedIds] = useState(new Set())
  const [contactError, setContactError] = useState(null)
  const [reportedIds, setReportedIds] = useState(new Set())
  const [reportedProfileIds, setReportedProfileIds] = useState(new Set())

  const endpoint = view === 'offers' ? '/b2b/offers' : '/b2b/requests'
  const key = view === 'offers' ? 'offers' : 'requests'

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.product) params.set('product', filters.product)
      if (filters.region) params.set('region', filters.region)
      if (filters.search) params.set('search', filters.search)
      if (filters.minQuantity) params.set('minQuantity', filters.minQuantity)
      if (view === 'offers') {
        if (filters.availableBy) params.set('availableBy', filters.availableBy)
        if (filters.actorType) params.set('sellerType', filters.actorType)
      } else if (filters.actorType) {
        params.set('actorType', filters.actorType)
      }
      const data = await api.get(`${endpoint}?${params}`)
      setItems(data[key] || [])
      setTotal(data.total || 0)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => { e.preventDefault(); load() }

  const switchView = (v) => {
    // actorType et disponibilité n'ont pas le même sens (ni les mêmes options)
    // d'une offre à une demande — on repart propre pour éviter un filtre fantôme.
    setFilters(f => ({ ...f, actorType: '', availableBy: '' }))
    setView(v)
  }

  const ACTOR_OPTIONS = view === 'offers'
    ? [{ value: 'PRODUCER', label: 'Producteur' }, { value: 'COOPERATIVE', label: 'Coopérative' }]
    : [{ value: 'TRADER', label: 'Acheteur' }, { value: 'PROCESSOR', label: 'Transformateur' }, { value: 'EXPORTER', label: 'Exportateur' }]

  const handleContact = async (item) => {
    setContactError(null)
    setContactingId(item.id)
    try {
      await api.post('/b2b/contacts', view === 'offers' ? { offerId: item.id } : { requestId: item.id })
      setContactedIds(prev => new Set(prev).add(item.id))
    } catch (err) {
      setContactError(err.message)
    } finally {
      setContactingId(null)
    }
  }

  const handleReport = (item) => {
    const reason = window.prompt('Pourquoi signalez-vous cette annonce ?')
    if (!reason) return
    api.post('/b2b/reports', { targetType: view === 'offers' ? 'OFFER' : 'REQUEST', targetId: item.id, reason })
      .then(() => setReportedIds(prev => new Set(prev).add(item.id)))
      .catch((err) => setContactError(err.message))
  }

  // LOT B2B-SIGNALEMENT (phase 1 post-audit) : le backend acceptait déjà
  // targetType=PROFILE (aucun changement requis côté API), mais l'interface
  // ne l'envoyait jamais — impossible de signaler un producteur/coopérative/
  // acheteur douteux, seulement son annonce. targetId est l'id du profil
  // concerné (Producer/Cooperative/Trader/Processor/Exporter), pas celui de
  // l'annonce — un profil recevant plusieurs annonces signalées séparément
  // sinon n'aurait jamais permis de le signaler LUI, comme entité.
  const profileFor = (item) => {
    if (view === 'offers') {
      if (item.producer) return { id: item.producer.id, label: item.producer.user?.name || 'ce producteur' }
      if (item.cooperative) return { id: item.cooperative.id, label: item.cooperative.name || 'cette coopérative' }
    } else {
      if (item.trader) return { id: item.trader.id, label: item.trader.companyName || 'cet acheteur' }
      if (item.processor) return { id: item.processor.id, label: item.processor.companyName || 'ce transformateur' }
      if (item.exporter) return { id: item.exporter.id, label: item.exporter.companyName || 'cet exportateur' }
    }
    return null
  }

  const handleReportProfile = (item) => {
    const profile = profileFor(item)
    if (!profile) return
    const reason = window.prompt(`Pourquoi signalez-vous ${profile.label} ?`)
    if (!reason) return
    api.post('/b2b/reports', { targetType: 'PROFILE', targetId: profile.id, reason })
      .then(() => setReportedProfileIds(prev => new Set(prev).add(profile.id)))
      .catch((err) => setContactError(err.message))
  }

  return (
    <div className="space-y-6">
      <h1 className="font-playfair text-2xl font-bold text-charcoal">Rechercher sur la filière</h1>

      <div className="flex gap-2">
        <button onClick={() => switchView('offers')}
          className={`font-syne text-sm font-bold px-4 py-2 rounded-2xl transition-colors ${view === 'offers' ? 'bg-forest text-cream' : 'bg-white text-charcoal/50 border border-charcoal/10'}`}>
          Offres de riz
        </button>
        <button onClick={() => switchView('requests')}
          className={`font-syne text-sm font-bold px-4 py-2 rounded-2xl transition-colors ${view === 'requests' ? 'bg-forest text-cream' : 'bg-white text-charcoal/50 border border-charcoal/10'}`}>
          Demandes d'achat
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 bg-white border border-charcoal/10 rounded-2xl p-4">
        <select value={filters.product} onChange={e => setFilters(f => ({ ...f, product: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm">
          <option value="">Tous produits</option>
          {RICE_PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input list="regions" placeholder="Région" value={filters.region}
          onChange={e => setFilters(f => ({ ...f, region: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm flex-1 min-w-[140px]" />
        <datalist id="regions">{CI_REGIONS.map(r => <option key={r} value={r} />)}</datalist>
        <select value={filters.actorType} onChange={e => setFilters(f => ({ ...f, actorType: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm">
          <option value="">{view === 'offers' ? 'Tout type de vendeur' : "Tout type d'acheteur"}</option>
          {ACTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="number" min="0" placeholder="Quantité min." value={filters.minQuantity}
          onChange={e => setFilters(f => ({ ...f, minQuantity: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm w-32" />
        {view === 'offers' && (
          <div>
            <label className="font-syne text-[10px] font-bold uppercase text-charcoal/40 block mb-1">Disponible avant le</label>
            <input type="date" value={filters.availableBy}
              onChange={e => setFilters(f => ({ ...f, availableBy: e.target.value }))}
              className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm" />
          </div>
        )}
        <input placeholder="Recherche libre" value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          className="bg-cream border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm flex-1 min-w-[140px]" />
        <button type="submit" className="flex items-center gap-1.5 bg-charcoal text-cream font-syne text-sm font-bold px-4 py-2 rounded-xl self-end">
          <Search size={14} /> Filtrer
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{error}</p>
          <button onClick={load} className="text-red-600 font-bold text-xs underline">Réessayer</button>
        </div>
      )}

      {contactError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="font-dm text-sm text-red-600 flex-1">{contactError}</p>
          <button onClick={() => setContactError(null)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center font-dm text-charcoal/40">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-dashed border-charcoal/10 rounded-3xl">
          <Package className="mx-auto text-charcoal/20 mb-3" size={32} />
          <p className="font-dm text-charcoal/40">Aucun résultat pour ces critères.</p>
        </div>
      ) : (
        <>
          <p className="font-dm text-xs text-charcoal/40">{total} résultat{total > 1 ? 's' : ''}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map(item => (
              <div key={item.id} className="bg-white border border-charcoal/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-syne text-[10px] font-bold uppercase tracking-wider text-forest bg-forest/10 px-2 py-0.5 rounded-full">
                    {item.product}
                  </span>
                </div>
                <p className="font-playfair text-lg font-bold text-charcoal">
                  {fmt(item.quantity)} {item.unit}
                </p>
                {view === 'offers' ? <SellerBadge item={item} /> : <BuyerBadge item={item} />}
                {view === 'offers' && item.price != null && (
                  <p className="font-dm text-sm text-charcoal/60 mt-1">{fmt(item.price)} FCFA / {item.unit}</p>
                )}
                {view === 'offers' && item.minOrderQty != null && (
                  <p className="font-dm text-xs text-charcoal/40 mt-0.5">MOQ : {fmt(item.minOrderQty)} {item.unit}</p>
                )}
                {user && (
                  <div className="mt-3 flex items-center gap-4">
                    {contactedIds.has(item.id) ? (
                      <p className="flex items-center gap-1.5 font-syne text-xs font-bold text-green-600">
                        <Check size={12} /> Contact envoyé
                      </p>
                    ) : (
                      <button onClick={() => handleContact(item)} disabled={contactingId === item.id}
                        className="flex items-center gap-1.5 font-syne text-xs font-bold text-forest hover:text-forest-dark disabled:opacity-50">
                        <MessageCircle size={12} /> {contactingId === item.id ? 'Envoi…' : 'Contacter'}
                      </button>
                    )}
                    {reportedIds.has(item.id) ? (
                      <p className="font-dm text-xs text-charcoal/30">Annonce signalée</p>
                    ) : (
                      <button onClick={() => handleReport(item)}
                        className="flex items-center gap-1 font-dm text-xs text-charcoal/30 hover:text-red-500">
                        <Flag size={11} /> Signaler l'annonce
                      </button>
                    )}
                    {profileFor(item) && (
                      reportedProfileIds.has(profileFor(item).id) ? (
                        <p className="font-dm text-xs text-charcoal/30">Profil signalé</p>
                      ) : (
                        <button onClick={() => handleReportProfile(item)}
                          className="flex items-center gap-1 font-dm text-xs text-charcoal/30 hover:text-red-500">
                          <ShieldAlert size={11} /> Signaler le profil
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
