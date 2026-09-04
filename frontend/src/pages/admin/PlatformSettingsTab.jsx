import { useEffect, useState, useMemo } from 'react'
import { api } from '../../api/client'
import { Check, Truck, Calculator, Percent, DollarSign, Settings, ChevronRight, AlertCircle, Globe, Search, BarChart2, ExternalLink, Plus, X, Crown, Store, CheckCircle, Square } from 'lucide-react'

const fmt = n => Number(n || 0).toLocaleString('fr-FR')
const C = { forest: '#1B4332', forestLight: '#2D6A4F', safran: '#E8A217', terra: '#C4501A' }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Field({ label, description, children }) {
  return (
    <div>
      <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-1">{label}</label>
      {description && <p className="font-dm text-xs text-charcoal/40 mb-2">{description}</p>}
      {children}
    </div>
  )
}

function SectionCard({ title, icon, children, accent = false }) {
  return (
    <div className={`rounded-3xl p-6 space-y-5 ${accent ? 'bg-forest text-white' : 'bg-white shadow-card border border-gray-50'}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className={`font-playfair text-xl font-bold ${accent ? 'text-white' : 'text-charcoal'}`}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

const SECTION_TABS = [
  { id: 'finance',   label: 'Politique financière', icon: Percent },
  { id: 'delivery',  label: 'Livraison',            icon: Truck },
  { id: 'engine',    label: 'Moteur assignation',   icon: Settings },
  { id: 'penalties', label: 'Pénalités livreurs',   icon: AlertCircle },
  { id: 'plans',     label: 'Abonnements',          icon: DollarSign },
  { id: 'seo',       label: 'SEO & Analytics',      icon: Globe },
]

// ─── Section : Politique financière ──────────────────────────────────────────
function FinancePolicySection({ form, set }) {
  const driverPct   = Math.round((form.driverCommission ?? 0.15) * 100)
  const platformPct = 100 - driverPct

  // Simulation avec 1000 FCFA de frais de livraison
  const simFee = 1000
  const simDriverNet = Math.round(simFee * (form.driverCommission ?? 0.15))
  const simPlatNet   = simFee - simDriverNet

  // Simulation commande 10 000 FCFA
  const simOrder     = 10000
  const simCommission = Math.round(simOrder * (form.commissionRate ?? 0.05))
  const simVendorNet  = simOrder - simCommission

  return (
    <div className="space-y-6">
      {/* Bandeau d'information */}
      <div className="bg-safran/10 border border-safran/30 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-safran mt-0.5 shrink-0" />
        <p className="font-dm text-sm text-charcoal/70">
          Ces taux s'appliquent <strong>en temps réel</strong> à toutes les commandes et sont utilisés pour calculer les fiches de paie des livreurs. Toute modification est immédiatement répercutée.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Répartition frais de livraison ── */}
        <SectionCard title="Frais de livraison" icon={<Truck size={18} className="text-forest" />}>
          <Field label="Commission livreur BASIC (%)" description="% des frais de livraison reversé aux livreurs BASIC">
            <div className="flex items-center gap-4">
              <input
                type="range" min="5" max="95" step="5"
                value={driverPct}
                onChange={e => set('driverCommission', Number(e.target.value) / 100)}
                className="flex-1 accent-forest"
              />
              <div className="w-16 border-2 border-forest/20 rounded-xl px-2 py-1.5 text-center">
                <span className="font-playfair text-lg font-bold text-forest">{driverPct}%</span>
              </div>
            </div>
          </Field>

          {/* Barre de répartition */}
          <div>
            <div className="flex rounded-xl overflow-hidden h-8 mb-2">
              <div className="flex items-center justify-center font-syne text-xs font-bold text-white transition-all"
                style={{ width: `${driverPct}%`, backgroundColor: C.forest }}>
                {driverPct >= 20 && `Livreur ${driverPct}%`}
              </div>
              <div className="flex items-center justify-center font-syne text-xs font-bold text-white transition-all"
                style={{ width: `${platformPct}%`, backgroundColor: C.safran }}>
                {platformPct >= 20 && `Plateforme ${platformPct}%`}
              </div>
            </div>
            <div className="flex justify-between text-[11px] font-dm text-charcoal/50">
              <span>Livreur : <strong className="text-forest">{driverPct}%</strong></span>
              <span>Plateforme : <strong className="text-safran">{platformPct}%</strong></span>
            </div>
          </div>

          {/* Simulation livraison */}
          <div className="bg-charcoal/5 rounded-2xl p-4 space-y-2">
            <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40">Simulation — 1 livraison à {fmt(simFee)} FCFA</p>
            <div className="flex justify-between font-dm text-sm">
              <span className="text-charcoal/60">Livreur reçoit</span>
              <span className="font-bold text-forest">{fmt(simDriverNet)} FCFA</span>
            </div>
            <div className="flex justify-between font-dm text-sm">
              <span className="text-charcoal/60">Plateforme retient</span>
              <span className="font-bold text-safran">{fmt(simPlatNet)} FCFA</span>
            </div>
          </div>
        </SectionCard>

        {/* ── Commission vendeur ── */}
        <SectionCard title="Commission vendeurs" icon={<Percent size={18} className="text-safran" />}>
          <Field label="Taux de commission (%)" description="% prélevé sur chaque vente réussie">
            <div className="flex items-center gap-4">
              <input
                type="range" min="0" max="30" step="1"
                value={Math.round((form.commissionRate ?? 0.05) * 100)}
                onChange={e => set('commissionRate', Number(e.target.value) / 100)}
                className="flex-1 accent-safran"
              />
              <div className="w-16 border-2 border-safran/30 rounded-xl px-2 py-1.5 text-center">
                <span className="font-playfair text-lg font-bold text-safran">{Math.round((form.commissionRate ?? 0.05) * 100)}%</span>
              </div>
            </div>
          </Field>

          {/* Barre */}
          <div>
            <div className="flex rounded-xl overflow-hidden h-8 mb-2">
              <div className="flex items-center justify-center font-syne text-xs font-bold text-white transition-all"
                style={{ width: `${100 - Math.round((form.commissionRate ?? 0.05) * 100)}%`, backgroundColor: C.forestLight }}>
                {(100 - Math.round((form.commissionRate ?? 0.05) * 100)) >= 20 && `Vendeur ${100 - Math.round((form.commissionRate ?? 0.05) * 100)}%`}
              </div>
              <div className="flex items-center justify-center font-syne text-xs font-bold text-white transition-all"
                style={{ width: `${Math.round((form.commissionRate ?? 0.05) * 100)}%`, backgroundColor: C.terra }}>
                {Math.round((form.commissionRate ?? 0.05) * 100) >= 10 && `Comm. ${Math.round((form.commissionRate ?? 0.05) * 100)}%`}
              </div>
            </div>
            <div className="flex justify-between text-[11px] font-dm text-charcoal/50">
              <span>Vendeur : <strong className="text-forest-light">{100 - Math.round((form.commissionRate ?? 0.05) * 100)}%</strong></span>
              <span>Commission : <strong className="text-terra">{Math.round((form.commissionRate ?? 0.05) * 100)}%</strong></span>
            </div>
          </div>

          {/* Simulation commande */}
          <div className="bg-charcoal/5 rounded-2xl p-4 space-y-2">
            <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40">Simulation — commande à {fmt(simOrder)} FCFA</p>
            <div className="flex justify-between font-dm text-sm">
              <span className="text-charcoal/60">Vendeur reçoit</span>
              <span className="font-bold text-forest-light">{fmt(simVendorNet)} FCFA</span>
            </div>
            <div className="flex justify-between font-dm text-sm">
              <span className="text-charcoal/60">Commission plateforme</span>
              <span className="font-bold text-terra">{fmt(simCommission)} FCFA</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Saisie fine (valeurs exactes) ── */}
      <SectionCard title="Valeurs précises" icon={<Settings size={18} className="text-charcoal/50" />}>
        <div className="grid grid-cols-2 gap-6">
          <Field label="Commission livreur BASIC (décimal)" description="Ex: 0.15 = 15%. Modifié aussi par le curseur ci-dessus.">
            <div className="flex items-center gap-2">
              <input type="number" step="0.01" min="0.05" max="0.95" value={form.driverCommission ?? 0.15}
                onChange={e => set('driverCommission', Number(e.target.value))}
                className="w-32 border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
              <span className="font-syne text-sm text-charcoal/40">→ {Math.round((form.driverCommission ?? 0.15) * 100)}%</span>
            </div>
          </Field>
          <Field label="Commission vendeur (décimal)" description="Ex: 0.05 = 5%.">
            <div className="flex items-center gap-2">
              <input type="number" step="0.01" min="0" max="0.30" value={form.commissionRate ?? 0.05}
                onChange={e => set('commissionRate', Number(e.target.value))}
                className="w-32 border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-safran" />
              <span className="font-syne text-sm text-charcoal/40">→ {Math.round((form.commissionRate ?? 0.05) * 100)}%</span>
            </div>
          </Field>
        </div>
        <p className="font-dm text-xs text-charcoal/40 pt-1">
          Part plateforme sur livraison = <strong>{100 - Math.round((form.driverCommission ?? 0.15) * 100)}%</strong> des frais de livraison (automatique).
        </p>
      </SectionCard>
    </div>
  )
}

// ─── Section : Livraison ──────────────────────────────────────────────────────
function DeliverySection({ form, set, simResult, simWeight, setSimWeight, simDist, setSimDist, simExtraShops, setSimExtraShops }) {
  return (
    <div className="space-y-6">
      <SectionCard title="Politique de livraison" icon={<Truck size={18} className="text-forest" />}>
        <p className="font-dm text-xs text-charcoal/50 -mt-2">
          Frais calculés : <code className="bg-charcoal/5 px-1.5 py-0.5 rounded">base + kg × tarif/kg + km × tarif/km</code>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Base fixe (FCFA)" description="Forfait pour toute commande">
            <input type="number" min="0" value={form.deliveryBasePrice ?? 500}
              onChange={e => set('deliveryBasePrice', Number(e.target.value))}
              className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
          </Field>
          <Field label="Tarif / kg (FCFA)" description="Multiplié par le poids total">
            <input type="number" min="0" step="0.5" value={form.deliveryPricePerKg ?? 25}
              onChange={e => set('deliveryPricePerKg', Number(e.target.value))}
              className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
          </Field>
          <Field label="Tarif / km (FCFA)" description="Multiplié par la distance">
            <input type="number" min="0" step="5" value={form.deliveryPricePerKm ?? 100}
              onChange={e => set('deliveryPricePerKm', Number(e.target.value))}
              className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
          </Field>
          <Field label="Plafond frais (FCFA)" description="0 = sans plafond">
            <input type="number" min="0" step="100" value={form.deliveryMaxPrice ?? 8000}
              onChange={e => set('deliveryMaxPrice', Number(e.target.value))}
              className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
          </Field>
        </div>
        <Field label="Livraison gratuite si commande ≥ (FCFA)" description="0 = désactivé">
          <input type="number" min="0" step="1000" value={form.deliveryFreeAbove ?? 0}
            onChange={e => set('deliveryFreeAbove', Number(e.target.value))}
            className="w-48 border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
        </Field>
        <Field label="Frais de collecte additionnelle (FCFA)" description="Ajouté par boutique supplémentaire dans un panier multi-vendeurs">
          <input type="number" min="0" step="50" value={form.additionalPickupFee ?? 500}
            onChange={e => set('additionalPickupFee', Number(e.target.value))}
            className="w-48 border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
        </Field>
        <Field label="Délai affiché (jours)">
          <input type="number" min="1" max="30" value={form.deliveryLeadDays ?? 1}
            onChange={e => set('deliveryLeadDays', Number(e.target.value))}
            className="w-32 border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
        </Field>
      </SectionCard>

      {/* Simulateur */}
      <div className="bg-forest/5 border-2 border-forest/15 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator size={17} className="text-forest" />
          <h2 className="font-syne text-sm font-bold text-charcoal">Simulateur de frais</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-dm text-xs text-charcoal/50 block mb-1">Poids total : <strong>{simWeight} kg</strong></label>
            <input type="range" min="1" max="200" value={simWeight} onChange={e => setSimWeight(Number(e.target.value))} className="w-full accent-forest" />
          </div>
          <div>
            <label className="font-dm text-xs text-charcoal/50 block mb-1">Distance : <strong>{simDist} km</strong></label>
            <input type="range" min="1" max="60" value={simDist} onChange={e => setSimDist(Number(e.target.value))} className="w-full accent-forest" />
          </div>
          <div className="col-span-2">
            <label className="font-dm text-xs text-charcoal/50 block mb-1">Boutiques supplémentaires : <strong>{simExtraShops}</strong></label>
            <input type="range" min="0" max="4" value={simExtraShops} onChange={e => setSimExtraShops(Number(e.target.value))} className="w-full accent-safran" />
          </div>
        </div>
        {simResult && (
          <div className="bg-white rounded-2xl p-4 space-y-2">
            {[
              { label: 'Base fixe', value: simResult.base },
              { label: `Poids (${simWeight} kg × ${fmt(form.deliveryPricePerKg ?? 25)} FCFA)`, value: simResult.wCost },
              { label: `Distance (${simDist} km × ${fmt(form.deliveryPricePerKm ?? 100)} FCFA)`, value: simResult.dCost },
              ...(simExtraShops > 0 ? [{ label: `${simExtraShops} collecte${simExtraShops > 1 ? 's' : ''} additionnelle${simExtraShops > 1 ? 's' : ''} × ${fmt(form.additionalPickupFee ?? 500)} FCFA`, value: simResult.pCost }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm font-dm text-charcoal/60">
                <span>{label}</span><span>{fmt(value)} FCFA</span>
              </div>
            ))}
            {simResult.capped && <p className="font-dm text-xs text-safran">⚠ Plafonné à {fmt(form.deliveryMaxPrice)} FCFA</p>}
            <div className="border-t border-charcoal/8 pt-2 flex justify-between">
              <span className="font-syne text-sm font-bold text-charcoal">Frais de livraison</span>
              <span className="font-playfair text-xl font-bold text-forest">{fmt(simResult.fee)} FCFA</span>
            </div>
            <div className="flex justify-between text-xs font-dm text-charcoal/40">
              <span>dont livreur ({Math.round((form.driverCommission ?? 0.15) * 100)}%)</span>
              <span className="font-bold text-forest">{fmt(Math.round(simResult.fee * (form.driverCommission ?? 0.15)))} FCFA</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section : Moteur d'assignation ───────────────────────────────────────────
function EngineSection({ form, set }) {
  return (
    <SectionCard title="Moteur d'assignation automatique" icon={<Settings size={18} className="text-charcoal/50" />}>
      <div className="space-y-5">
        {[
          { key: 'offerExpiryMin',   label: 'Délai expiration offre (min)',  description: 'Avant réassignation automatique', min: 1, max: 60 },
          { key: 'maxOfferAttempts', label: 'Tentatives max par commande',   description: "Avant escalade à l'admin",        min: 1, max: 10 },
        ].map(({ key, label, description, min, max }) => (
          <Field key={key} label={label} description={description}>
            <input type="number" min={min} max={max} value={form[key]}
              onChange={e => set(key, Number(e.target.value))}
              className="w-32 border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
          </Field>
        ))}
        <Field label="Note minimale livreur" description="En-dessous, le livreur n'est pas éligible">
          <div className="flex items-center gap-3">
            <input type="range" min="1" max="5" step="0.5" value={form.minDriverRating ?? 3.5}
              onChange={e => set('minDriverRating', Number(e.target.value))}
              className="w-40 accent-safran" />
            <span className="font-playfair font-bold text-lg text-safran">★ {form.minDriverRating ?? 3.5}</span>
          </div>
        </Field>
      </div>
    </SectionCard>
  )
}

// ─── Feature List Editor ──────────────────────────────────────────────────────
function FeatureListEditor({ features, onChange }) {
  const [newLabel, setNewLabel] = useState('')

  const toggle  = i => onChange(features.map((f, idx) => idx === i ? { ...f, enabled: !f.enabled } : f))
  const remove  = i => onChange(features.filter((_, idx) => idx !== i))
  const add     = () => {
    const trimmed = newLabel.trim()
    if (!trimmed) return
    onChange([...features, { label: trimmed, enabled: true }])
    setNewLabel('')
  }

  return (
    <div className="space-y-2">
      {features.map((f, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <button type="button" onClick={() => toggle(i)} className="shrink-0 text-charcoal">
            {f.enabled
              ? <CheckCircle size={16} className="text-forest" />
              : <Square size={16} className="text-charcoal/25" />
            }
          </button>
          <span className={`font-dm text-sm flex-1 ${f.enabled ? 'text-charcoal/80' : 'text-charcoal/30 line-through'}`}>{f.label}</span>
          <button type="button" onClick={() => remove(i)}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-all">
            <X size={10} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-3">
        <input
          type="text"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Nouvelle fonctionnalité..."
          className="flex-1 border border-charcoal/15 rounded-xl px-3 py-2 font-dm text-sm focus:outline-none focus:border-forest"
        />
        <button type="button" onClick={add} disabled={!newLabel.trim()}
          className="w-8 h-8 rounded-xl bg-forest/10 text-forest hover:bg-forest/20 flex items-center justify-center disabled:opacity-30 transition-colors">
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Section : Abonnements + contact + maintenance ────────────────────────────
function PlansSection({ form, set }) {
  const parseFeats = (key, defaults) => {
    try { return JSON.parse(form[key] || 'null') || defaults } catch { return defaults }
  }

  const [shopBasic,     setShopBasic]     = useState(() => parseFeats('shopBasicFeatures',     [{ label: 'Présence sur la marketplace', enabled: true }, { label: 'Gestion des produits', enabled: true }, { label: 'Tableau de bord analytics', enabled: true }]))
  const [shopCertified, setShopCertified] = useState(() => parseFeats('shopCertifiedFeatures', [{ label: 'Tout le plan BASIC', enabled: true }, { label: 'Badge "Boutique certifiée"', enabled: true }, { label: 'Priorité dans la recherche', enabled: true }]))
  const [driverBasic,   setDriverBasic]   = useState(() => parseFeats('driverBasicFeatures',   [{ label: 'Accès aux offres', enabled: true }, { label: 'Sans frais d\'abonnement', enabled: true }]))
  const [driverPremium, setDriverPremium] = useState(() => parseFeats('driverPremiumFeatures', [{ label: 'Tout le plan BASIC', enabled: true }, { label: 'Commission majorée', enabled: true }, { label: 'Priorité d\'assignation', enabled: true }]))

  // Sync feature states → form whenever they change
  const sync = (key, val) => set(key, JSON.stringify(val))
  const onShopBasic     = v => { setShopBasic(v);     sync('shopBasicFeatures',     v) }
  const onShopCertified = v => { setShopCertified(v); sync('shopCertifiedFeatures', v) }
  const onDriverBasic   = v => { setDriverBasic(v);   sync('driverBasicFeatures',   v) }
  const onDriverPremium = v => { setDriverPremium(v); sync('driverPremiumFeatures', v) }

  return (
    <div className="space-y-6">
      {/* Plan cards 2×2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Shop BASIC */}
        <div className="bg-white rounded-3xl shadow-card border border-gray-50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-forest/10 flex items-center justify-center"><Store size={15} className="text-forest" /></div>
            <h3 className="font-playfair text-lg font-bold text-charcoal">Boutique BASIC</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix (FCFA/an)" description="0 = gratuit">
              <input type="number" min="0" value={form.basicPlanPrice ?? 0}
                onChange={e => set('basicPlanPrice', Number(e.target.value))}
                className="w-full border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm focus:outline-none focus:border-forest" />
            </Field>
            <Field label="Produits max" description="0 = illimité">
              <input type="number" min="0" value={form.basicMaxProducts ?? 0}
                onChange={e => set('basicMaxProducts', Number(e.target.value))}
                className="w-full border-2 border-charcoal/10 rounded-xl px-3 py-2 font-dm text-sm focus:outline-none focus:border-forest" />
            </Field>
          </div>

          {/* Restrictions fonctionnelles */}
          <div className="border border-charcoal/8 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-charcoal/4 border-b border-charcoal/8">
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-charcoal/40">Accès aux fonctionnalités</p>
            </div>
            {[
              { key: 'basicCanAnalytics', label: 'Analytiques', desc: 'Accès à l\'onglet statistiques détaillées' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between px-4 py-3 border-b border-charcoal/5 last:border-0">
                <div>
                  <p className="font-syne text-sm font-bold text-charcoal">{label}</p>
                  <p className="font-dm text-xs text-charcoal/40">{desc}</p>
                </div>
                <button type="button" onClick={() => set(key, !form[key])}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form[key] !== false ? 'bg-forest' : 'bg-charcoal/20'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[key] !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>

          <div>
            <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-2">Fonctionnalités incluses</label>
            <FeatureListEditor features={shopBasic} onChange={onShopBasic} />
          </div>
        </div>

        {/* Shop CERTIFIED */}
        <div className="bg-gradient-to-b from-charcoal to-charcoal/90 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-safran/20 flex items-center justify-center"><Crown size={15} className="text-safran" /></div>
            <h3 className="font-playfair text-lg font-bold text-white">Boutique CERTIFIÉE</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix mensuel (FCFA/mois)">
              <input type="number" min="0" value={form.certifiedMonthlyPrice ?? 1500}
                onChange={e => set('certifiedMonthlyPrice', Number(e.target.value))}
                className="w-full border-2 border-white/15 bg-white/8 text-white rounded-xl px-3 py-2 font-dm text-sm focus:outline-none focus:border-safran" />
            </Field>
            <Field label="Prix annuel (FCFA/an)">
              <input type="number" min="0" value={form.certifiedPlanPrice ?? 15000}
                onChange={e => set('certifiedPlanPrice', Number(e.target.value))}
                className="w-full border-2 border-white/15 bg-white/8 text-white rounded-xl px-3 py-2 font-dm text-sm focus:outline-none focus:border-safran" />
            </Field>
          </div>
          <div>
            <label className="font-syne text-xs font-bold tracking-wider uppercase text-white/40 block mb-2">Fonctionnalités incluses</label>
            <div className="[&_input]:bg-white/8 [&_input]:border-white/15 [&_input]:text-white [&_input:focus]:border-safran [&_span]:text-white/70 [&_button]:text-white/70">
              <FeatureListEditor features={shopCertified} onChange={onShopCertified} />
            </div>
          </div>
        </div>

        {/* Driver BASIC */}
        <div className="bg-white rounded-3xl shadow-card border border-gray-50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-forest/10 flex items-center justify-center"><Truck size={15} className="text-forest" /></div>
            <h3 className="font-playfair text-lg font-bold text-charcoal">Livreur BASIC</h3>
          </div>
          <Field label="Commission (%)" description="Taux reversé aux livreurs BASIC (défini dans Politique financière)">
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="50" step="1"
                value={Math.round((form.driverCommission ?? 0.15) * 100)}
                onChange={e => set('driverCommission', Number(e.target.value) / 100)}
                className="flex-1 accent-forest" />
              <span className="font-playfair font-bold text-lg text-forest w-12 text-right">
                {Math.round((form.driverCommission ?? 0.15) * 100)}%
              </span>
            </div>
          </Field>
          <div>
            <label className="font-syne text-xs font-bold tracking-wider uppercase text-charcoal/40 block mb-2">Fonctionnalités incluses</label>
            <FeatureListEditor features={driverBasic} onChange={onDriverBasic} />
          </div>
        </div>

        {/* Driver PREMIUM */}
        <div className="bg-gradient-to-b from-charcoal to-charcoal/90 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-safran/20 flex items-center justify-center"><Crown size={15} className="text-safran" /></div>
            <h3 className="font-playfair text-lg font-bold text-white">Livreur PREMIUM</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix mensuel (FCFA/mois)">
              <input type="number" min="0" value={form.driverSubPrice ?? 5000}
                onChange={e => set('driverSubPrice', Number(e.target.value))}
                className="w-full border-2 border-white/15 bg-white/8 text-white rounded-xl px-3 py-2 font-dm text-sm focus:outline-none focus:border-safran" />
            </Field>
            <Field label="Prix annuel (FCFA/an)">
              <input type="number" min="0" value={form.driverAnnualPrice ?? 48000}
                onChange={e => set('driverAnnualPrice', Number(e.target.value))}
                className="w-full border-2 border-white/15 bg-white/8 text-white rounded-xl px-3 py-2 font-dm text-sm focus:outline-none focus:border-safran" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Commission (%)">
              <div className="flex items-center gap-2">
                <input type="range" min="1" max="50" step="1"
                  value={Math.round((form.premiumDriverCommission ?? 0.20) * 100)}
                  onChange={e => set('premiumDriverCommission', Number(e.target.value) / 100)}
                  className="flex-1 accent-safran" />
                <span className="font-playfair font-bold text-safran w-10 text-right text-sm">
                  {Math.round((form.premiumDriverCommission ?? 0.20) * 100)}%
                </span>
              </div>
            </Field>
          </div>
          <div>
            <label className="font-syne text-xs font-bold tracking-wider uppercase text-white/40 block mb-2">Fonctionnalités incluses</label>
            <div className="[&_input]:bg-white/8 [&_input]:border-white/15 [&_input]:text-white [&_input:focus]:border-safran [&_span]:text-white/70 [&_button]:text-white/70">
              <FeatureListEditor features={driverPremium} onChange={onDriverPremium} />
            </div>
          </div>
        </div>
      </div>

      <SectionCard title="Support & Contact" icon={<Settings size={18} className="text-charcoal/50" />}>
        {[
          { key: 'supportEmail', label: 'Email support', type: 'email' },
          { key: 'supportPhone', label: 'Téléphone support' },
        ].map(({ key, label, type = 'text' }) => (
          <Field key={key} label={label}>
            <input type={type} value={form[key] || ''} onChange={e => set(key, e.target.value)}
              className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-3 font-dm text-sm focus:outline-none focus:border-forest" />
          </Field>
        ))}
      </SectionCard>

      {/* Mode maintenance */}
      <div className={`rounded-3xl p-6 border-2 ${form.maintenanceMode ? 'bg-red-50 border-red-200' : 'bg-white shadow-card border-transparent'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-playfair text-xl font-bold text-charcoal">Mode maintenance</h2>
            <p className="font-dm text-sm text-charcoal/50 mt-1">Désactive l'accès public à la plateforme.</p>
          </div>
          <button type="button" onClick={() => set('maintenanceMode', !form.maintenanceMode)}
            className={`w-14 h-7 rounded-full transition-colors relative ${form.maintenanceMode ? 'bg-red-500' : 'bg-charcoal/20'}`}>
            <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.maintenanceMode ? 'translate-x-7' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Section : SEO & Analytics ───────────────────────────────────────────────
function SEOSection({ form, set }) {
  const previewTitle = form.seoTitle || 'RizIvoirien'
  const previewDesc  = form.seoDescription || ''
  const previewDomain = (form.seoCanonicalDomain || 'https://rizivoirien.ci').replace(/^https?:\/\//, '')

  return (
    <div className="space-y-6">

      {/* Info banner */}
      <div className="bg-forest/8 border border-forest/20 rounded-2xl p-4 flex items-start gap-3">
        <Globe size={16} className="text-forest mt-0.5 shrink-0" />
        <p className="font-dm text-sm text-charcoal/70">
          Ces paramètres contrôlent comment votre marketplace apparaît dans les moteurs de recherche (Google, Bing) et lors du partage sur les réseaux sociaux.
        </p>
      </div>

      {/* Prévisualisation Google */}
      <SectionCard title="Prévisualisation Google" icon={<Search size={18} className="text-[#4285F4]" />}>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-1.5">
          <p className="font-dm text-[12px] text-[#006621] truncate">{previewDomain}</p>
          <p className="font-dm text-lg text-[#1a0dab] hover:underline cursor-pointer truncate">{previewTitle}</p>
          <p className="font-dm text-sm text-[#545454] line-clamp-2">{previewDesc || 'Aucune description définie.'}</p>
        </div>
        <p className="font-dm text-xs text-charcoal/40">Aperçu approximatif — Google peut adapter l'affichage</p>
      </SectionCard>

      {/* Meta tags principaux */}
      <SectionCard title="Balises méta principales" icon={<Globe size={18} className="text-forest" />}>
        <Field label="Titre SEO (title)" description="Affiché dans l'onglet navigateur et les résultats Google. Max 60 caractères.">
          <div className="relative">
            <input type="text" value={form.seoTitle || ''} maxLength={60}
              onChange={e => set('seoTitle', e.target.value)}
              className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest pr-16" />
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 font-syne text-xs font-bold ${(form.seoTitle || '').length > 55 ? 'text-amber-500' : 'text-charcoal/30'}`}>
              {(form.seoTitle || '').length}/60
            </span>
          </div>
        </Field>

        <Field label="Description meta" description="Résumé affiché sous le titre dans Google. Max 160 caractères.">
          <div className="relative">
            <textarea value={form.seoDescription || ''} maxLength={160} rows={3}
              onChange={e => set('seoDescription', e.target.value)}
              className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest resize-none pr-16" />
            <span className={`absolute right-3 top-3 font-syne text-xs font-bold ${(form.seoDescription || '').length > 150 ? 'text-amber-500' : 'text-charcoal/30'}`}>
              {(form.seoDescription || '').length}/160
            </span>
          </div>
        </Field>

        <Field label="Mots-clés (keywords)" description="Séparés par des virgules. Google les ignore mais utiles pour les autres moteurs.">
          <input type="text" value={form.seoKeywords || ''}
            onChange={e => set('seoKeywords', e.target.value)}
            placeholder="riz ivoirien, marketplace, livraison Abidjan…"
            className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
        </Field>

        <Field label="Domaine canonique" description="URL de base du site (sans slash final). Utilisée pour les liens canoniques.">
          <input type="url" value={form.seoCanonicalDomain || ''}
            onChange={e => set('seoCanonicalDomain', e.target.value)}
            placeholder="https://rizivoirien.ci"
            className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-forest" />
        </Field>
      </SectionCard>

      {/* Open Graph / Réseaux sociaux */}
      <SectionCard title="Open Graph — Partage réseaux sociaux" icon={<ExternalLink size={18} className="text-safran" />}>
        <Field label="Image de partage (OG Image)" description="URL d'une image 1200×630px. Affichée lors du partage sur Facebook, WhatsApp, Twitter…">
          <input type="url" value={form.seoOgImage || ''}
            onChange={e => set('seoOgImage', e.target.value)}
            placeholder="https://rizivoirien.ci/og-image.jpg"
            className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-safran" />
        </Field>
        {form.seoOgImage && (
          <div className="rounded-xl overflow-hidden border border-gray-200 max-w-xs">
            <img src={form.seoOgImage} alt="OG Preview" className="w-full h-36 object-cover" onError={e => e.target.style.display='none'} />
            <p className="px-3 py-2 font-dm text-xs text-charcoal/50 bg-gray-50">Aperçu image OG</p>
          </div>
        )}
      </SectionCard>

      {/* Analytics */}
      <SectionCard title="Analytics & Tracking" icon={<BarChart2 size={18} className="text-safran" />}>
        <div className="grid grid-cols-2 gap-6">
          <Field label="Google Analytics 4 — Measurement ID" description="Format: G-XXXXXXXXXX">
            <input type="text" value={form.seoGoogleId || ''}
              onChange={e => set('seoGoogleId', e.target.value)}
              placeholder="G-XXXXXXXXXX"
              className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-[#4285F4] font-mono" />
          </Field>
          <Field label="Facebook Pixel ID" description="Pixel pour le tracking des conversions Meta">
            <input type="text" value={form.seoFbPixelId || ''}
              onChange={e => set('seoFbPixelId', e.target.value)}
              placeholder="123456789012345"
              className="w-full border-2 border-charcoal/10 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-[#1877F2] font-mono" />
          </Field>
        </div>
      </SectionCard>

      {/* Indexation */}
      <SectionCard title="Indexation & Sitemap" icon={<Search size={18} className="text-charcoal/50" />}>
        <div className="space-y-5">
          {/* Robots index toggle */}
          <div className="flex items-center justify-between p-4 bg-charcoal/5 rounded-2xl">
            <div>
              <p className="font-syne text-sm font-bold text-charcoal">Autoriser l'indexation Google</p>
              <p className="font-dm text-xs text-charcoal/50 mt-0.5">Désactiver pendant le développement. Réactiver avant la mise en production.</p>
            </div>
            <button type="button" onClick={() => set('seoRobotsIndex', !form.seoRobotsIndex)}
              className={`w-14 h-7 rounded-full transition-colors relative shrink-0 ml-4 ${form.seoRobotsIndex ? 'bg-forest' : 'bg-charcoal/20'}`}>
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.seoRobotsIndex ? 'translate-x-7' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Sitemap toggle */}
          <div className="flex items-center justify-between p-4 bg-charcoal/5 rounded-2xl">
            <div>
              <p className="font-syne text-sm font-bold text-charcoal">Générer le sitemap XML</p>
              <p className="font-dm text-xs text-charcoal/50 mt-0.5">
                Accessible sur <code className="bg-white px-1 rounded text-[11px]">{(form.seoCanonicalDomain || 'https://rizivoirien.ci')}/sitemap.xml</code>
              </p>
            </div>
            <button type="button" onClick={() => set('seoSitemapEnabled', !form.seoSitemapEnabled)}
              className={`w-14 h-7 rounded-full transition-colors relative shrink-0 ml-4 ${form.seoSitemapEnabled ? 'bg-forest' : 'bg-charcoal/20'}`}>
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.seoSitemapEnabled ? 'translate-x-7' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Statut actuel */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100">
            <div className={`w-2.5 h-2.5 rounded-full ${form.seoRobotsIndex ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
            <p className="font-dm text-sm text-charcoal/70">
              Site actuellement {form.seoRobotsIndex ? <strong className="text-green-600">indexable</strong> : <strong className="text-red-500">non indexé</strong>} par les moteurs de recherche
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Section : Pénalités livreurs ─────────────────────────────────────────────
function PenaltiesSection({ form, set }) {
  const w1Pct  = Math.round((form.penaltyWarn1Rate   ?? 0.70) * 100)
  const w2Pct  = Math.round((form.penaltyWarn2Rate   ?? 0.50) * 100)
  const susPct = Math.round((form.penaltySuspendRate ?? 0.30) * 100)
  const invalid = !(susPct < w2Pct && w2Pct < w1Pct)

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="font-dm text-sm text-charcoal/70">
          Ces seuils déclenchent automatiquement des avertissements et la suspension d'un livreur
          lorsque son taux d'acceptation descend en dessous. La cascade doit respecter :
          <strong> Suspension &lt; Avert. 2 &lt; Avert. 1</strong>.
        </p>
      </div>

      <SectionCard title="Seuils d'avertissement" icon={<AlertCircle size={18} className="text-amber-500" />}>
        <Field label="Seuil avertissement 1 (%)" description="1er avertissement quand le taux passe sous ce seuil">
          <div className="flex items-center gap-4">
            <input type="range" min="10" max="90" step="5"
              value={w1Pct}
              onChange={e => set('penaltyWarn1Rate', Number(e.target.value) / 100)}
              className="flex-1 accent-amber-500"
            />
            <div className="w-20 border-2 border-amber-300 rounded-xl px-2 py-1.5 text-center shrink-0">
              <span className="font-playfair text-lg font-bold text-amber-600">{w1Pct}%</span>
            </div>
          </div>
        </Field>

        <Field label="Seuil avertissement 2 (%)" description="2e avertissement — doit être inférieur au seuil 1">
          <div className="flex items-center gap-4">
            <input type="range" min="5" max="85" step="5"
              value={w2Pct}
              onChange={e => set('penaltyWarn2Rate', Number(e.target.value) / 100)}
              className="flex-1 accent-orange-500"
            />
            <div className="w-20 border-2 border-orange-300 rounded-xl px-2 py-1.5 text-center shrink-0">
              <span className="font-playfair text-lg font-bold text-orange-600">{w2Pct}%</span>
            </div>
          </div>
        </Field>

        <Field label="Seuil suspension automatique (%)" description="Suspension immédiate — doit être inférieur au seuil 2">
          <div className="flex items-center gap-4">
            <input type="range" min="0" max="80" step="5"
              value={susPct}
              onChange={e => set('penaltySuspendRate', Number(e.target.value) / 100)}
              className="flex-1 accent-red-500"
            />
            <div className="w-20 border-2 border-red-300 rounded-xl px-2 py-1.5 text-center shrink-0">
              <span className="font-playfair text-lg font-bold text-red-600">{susPct}%</span>
            </div>
          </div>
        </Field>

        {invalid && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="font-dm text-sm text-red-600">
              Les seuils doivent respecter : suspension &lt; avert. 2 &lt; avert. 1
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Cascade des seuils" icon={<Settings size={18} className="text-charcoal/50" />}>
        <div className="space-y-3">
          {[
            { label: '100% → Aucune action', color: 'bg-green-500', width: 100 },
            { label: `≤ ${w1Pct}% → Avertissement 1`, color: 'bg-amber-400', width: w1Pct },
            { label: `≤ ${w2Pct}% → Avertissement 2`, color: 'bg-orange-500', width: w2Pct },
            { label: `≤ ${susPct}% → Suspension automatique`, color: 'bg-red-500', width: susPct },
          ].map(({ label, color, width }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${width}%` }} />
              </div>
              <span className="font-dm text-xs text-charcoal/60 w-56 shrink-0">{label}</span>
            </div>
          ))}
        </div>
        <p className="font-dm text-xs text-charcoal/40 mt-2">
          Les avertissements s'accumulent et ne sont jamais effacés automatiquement — seul l'admin peut les effacer.
        </p>
      </SectionCard>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PlatformSettingsTab() {
  const [form, setForm]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [section, setSection] = useState('finance')

  // Simulateur livraison
  const [simWeight,      setSimWeight]      = useState(25)
  const [simDist,        setSimDist]        = useState(8)
  const [simExtraShops,  setSimExtraShops]  = useState(0)

  useEffect(() => {
    api.get('/admin/settings').then(setForm).finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setSaveError(null)
    try {
      await api.put('/admin/settings', form)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) { setSaveError(err.message) }
    finally { setSaving(false) }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const simResult = useMemo(() => {
    if (!form) return null
    const base       = form.deliveryBasePrice    ?? 500
    const perKg      = form.deliveryPricePerKg   ?? 25
    const perKm      = form.deliveryPricePerKm   ?? 100
    const maxFee     = form.deliveryMaxPrice     ?? 8000
    const pickupFee  = form.additionalPickupFee  ?? 500
    const wCost      = Math.round(simWeight * perKg)
    const dCost      = Math.round(simDist   * perKm)
    const pCost      = Math.round(simExtraShops * pickupFee)
    let fee = base + wCost + dCost + pCost
    const capped = maxFee > 0 && fee > maxFee
    if (capped) fee = maxFee
    return { base, wCost, dCost, pCost, fee, capped }
  }, [form, simWeight, simDist, simExtraShops])

  if (loading || !form) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
    </div>
  )

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      <div>
        <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Administration</p>
        <h1 className="font-playfair text-4xl font-bold text-charcoal">Paramètres plateforme</h1>
        <p className="font-dm text-charcoal/50 mt-1">Tout est configurable sans toucher au code.</p>
      </div>

      {/* Tabs de section */}
      <div className="flex gap-2 flex-wrap bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
        {SECTION_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setSection(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne text-sm font-bold transition-all ${
              section === id
                ? 'bg-charcoal text-white shadow-sm'
                : 'text-charcoal/50 hover:text-charcoal hover:bg-gray-50'
            }`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenu de section */}
      {section === 'finance' && (
        <FinancePolicySection form={form} set={set} />
      )}
      {section === 'delivery' && (
        <DeliverySection
          form={form} set={set}
          simResult={simResult}
          simWeight={simWeight} setSimWeight={setSimWeight}
          simDist={simDist}           setSimDist={setSimDist}
          simExtraShops={simExtraShops} setSimExtraShops={setSimExtraShops}
        />
      )}
      {section === 'engine' && (
        <EngineSection form={form} set={set} />
      )}
      {section === 'penalties' && (
        <PenaltiesSection form={form} set={set} />
      )}
      {section === 'plans' && (
        <PlansSection form={form} set={set} />
      )}
      {section === 'seo' && (
        <SEOSection form={form} set={set} />
      )}

      {saveError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <span className="text-red-500 text-sm font-dm">{saveError}</span>
          <button type="button" onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      )}

      {/* Bouton save global */}
      <div className="sticky bottom-6">
        <button type="submit" disabled={saving}
          className={`flex items-center gap-2 font-syne font-bold text-sm px-8 py-4 rounded-2xl transition-all shadow-lg disabled:opacity-60 ${
            saved ? 'bg-green-500 text-white' : 'bg-charcoal text-white hover:bg-charcoal/80'
          }`}>
          {saving
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Check size={16} />
          }
          {saved ? '✓ Paramètres enregistrés !' : 'Enregistrer les paramètres'}
        </button>
      </div>
    </form>
  )
}
