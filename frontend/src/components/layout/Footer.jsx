import { Link } from 'react-router-dom'

const NAV = [
  {
    title: 'Marketplace',
    links: [
      { label: 'Tous les produits',     to: '/shop' },
      { label: 'Boutiques certifiées',  to: '/shop?certified=true' },
      { label: 'Nouveautés',            to: '/shop?sort=new' },
      { label: 'Promotions',            to: '/shop?promos=true' },
    ],
  },
  {
    title: 'Vendeurs',
    links: [
      { label: 'Ouvrir ma boutique',    to: '/register/seller' },
      { label: 'Plans & tarifs',        to: '/tarifs' },
      { label: 'Guide vendeur',         to: '/guide' },
      { label: 'Espace vendeur',        to: '/vendor' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: "Centre d'aide",               to: '/aide' },
      { label: 'Nous contacter',              to: '/contact' },
      { label: 'Politique de livraison',      to: '/livraisons' },
      { label: 'Retours & remboursements',    to: '/retours' },
    ],
  },
]

const SOCIALS = [
  { label: 'FB',  href: 'https://facebook.com' },
  { label: 'IG',  href: 'https://instagram.com' },
  { label: 'WA',  href: 'https://wa.me' },
]

const BOTTOM = [
  { label: 'Confidentialité', to: '/confidentialite' },
  { label: 'CGU',             to: '/cgu' },
  { label: 'Cookies',         to: '/cookies' },
]

export default function Footer() {
  return (
    <footer className="bg-charcoal text-cream/80">
      {/* Top wave */}
      <div className="h-16 bg-cream" style={{ clipPath: 'ellipse(55% 100% at 50% 0%)' }} />

      <div className="max-w-7xl mx-auto px-6 pt-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🌾</span>
              <span className="font-playfair text-xl font-bold text-cream">
                Riz<span className="text-safran">Ivoirien</span>
              </span>
            </div>
            <p className="font-dm text-sm text-cream/60 leading-relaxed">
              La marketplace du riz ivoirien. Directement des producteurs locaux à votre table.
            </p>
            <div className="flex gap-3 mt-6">
              {SOCIALS.map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
                  className="w-9 h-9 rounded-full border border-cream/20 flex items-center justify-center font-syne text-xs font-bold text-cream/60 hover:border-safran hover:text-safran transition-colors">
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {NAV.map(({ title, links }) => (
            <div key={title}>
              <h4 className="font-syne font-bold text-xs tracking-widest uppercase text-cream/40 mb-4">{title}</h4>
              <ul className="space-y-3">
                {links.map(link => (
                  <li key={link.label}>
                    <Link to={link.to}
                      className="font-dm text-sm text-cream/70 hover:text-safran transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-cream/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-dm text-xs text-cream/40">
            © {new Date().getFullYear()} RizIvoirien. Fait avec ❤️ en Côte d'Ivoire.
          </p>
          <div className="flex gap-6">
            {BOTTOM.map(l => (
              <Link key={l.label} to={l.to}
                className="font-dm text-xs text-cream/40 hover:text-cream/70 transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
