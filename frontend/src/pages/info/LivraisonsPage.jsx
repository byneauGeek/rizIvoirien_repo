import { Link } from 'react-router-dom'
import { Truck, Clock, MapPin, Weight, Calculator, ShieldCheck } from 'lucide-react'

const ZONES = [
  { zone: 'Abidjan Plateau / Cocody',   delay: '2–4h', base: '500 F' },
  { zone: 'Abidjan autres communes',    delay: '4–8h', base: '700 F' },
  { zone: 'Région Abidjan (0–30km)',    delay: '1 jour', base: '1 200 F' },
  { zone: "Intérieur Côte d'Ivoire",    delay: '2–3 jours', base: 'Calculé au poids+distance' },
]

export default function LivraisonsPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      {/* Header */}
      <div className="bg-[#1B4332] text-white py-20 px-6 text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-8 opacity-60 hover:opacity-100 transition-opacity">
          <span className="text-xl">🌾</span>
          <span className="font-playfair text-lg font-bold">Riz<span className="text-[#E8A217]">Ivoirien</span></span>
        </Link>
        <h1 className="font-playfair text-4xl md:text-5xl font-bold mb-4">Politique de livraison</h1>
        <p className="font-dm text-lg text-white/60 max-w-xl mx-auto">
          Des frais transparents, calculés selon le poids et la distance réelle.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">

        {/* How it works */}
        <Section title="Comment sont calculés les frais ?">
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Weight, label: 'Poids de la commande', desc: 'Le riz est pesé. Chaque kilogramme génère un coût fixe par kg.' },
              { icon: MapPin, label: 'Distance parcourue', desc: 'Nous calculons la distance entre la boutique et votre adresse (Haversine × 1.4 pour estimer la route).' },
              { icon: Calculator, label: 'Formule', desc: 'Frais = Base + (kg × tarif/kg) + (km × tarif/km), plafonné à un maximum.' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-[#1B4332]/10 flex items-center justify-center mb-3">
                  <Icon size={16} className="text-[#1B4332]" />
                </div>
                <p className="font-syne font-bold text-[#0F1923] text-sm mb-1.5">{label}</p>
                <p className="font-dm text-sm text-[#0F1923]/55 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Zones */}
        <Section title="Zones et délais estimés">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3 text-left font-syne text-[10px] font-bold uppercase tracking-wider text-[#0F1923]/40">Zone</th>
                  <th className="px-5 py-3 text-left font-syne text-[10px] font-bold uppercase tracking-wider text-[#0F1923]/40">Délai</th>
                  <th className="px-5 py-3 text-left font-syne text-[10px] font-bold uppercase tracking-wider text-[#0F1923]/40">Tarif indicatif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ZONES.map(z => (
                  <tr key={z.zone}>
                    <td className="px-5 py-3.5 font-dm text-sm text-[#0F1923]">{z.zone}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-syne text-xs font-bold text-[#52B788] bg-[#52B788]/10 px-2.5 py-1 rounded-full">
                        {z.delay}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-dm text-sm text-[#0F1923]/70">{z.base}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Other info */}
        <Section title="Informations importantes">
          <div className="space-y-4">
            {[
              { icon: Clock, text: "Les délais sont donnés à titre indicatif et peuvent varier selon les conditions de la boutique et les aléas de la route." },
              { icon: ShieldCheck, text: "Chaque commande est suivie en temps réel. Vous pouvez voir l'avancement dans votre espace \"Mes commandes\"." },
              { icon: Truck, text: "Nos livreurs sont des partenaires vérifiés par l'administration de RizIvoirien. Leur dossier (CNI, permis, véhicule) est contrôlé." },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-4 bg-white rounded-2xl p-5 border border-gray-100">
                <div className="w-9 h-9 rounded-xl bg-[#1B4332]/10 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-[#1B4332]" />
                </div>
                <p className="font-dm text-sm text-[#0F1923]/70 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </Section>

        <div className="text-center">
          <Link to="/contact" className="inline-flex items-center gap-2 bg-[#1B4332] text-white font-syne font-bold px-6 py-3 rounded-xl hover:bg-[#246043] transition-colors">
            Une question ? Contactez-nous
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-playfair text-2xl font-bold text-[#0F1923] mb-5">{title}</h2>
      {children}
    </section>
  )
}
