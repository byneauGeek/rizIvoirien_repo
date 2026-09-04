import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import MarketplaceTab from './b2b/MarketplaceTab'

// Vitrine publique des offres/demandes B2B — pas besoin d'être connecté pour
// parcourir le marché, seulement pour publier ou contacter.
export default function B2BMarketplacePage() {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-12">
        <MarketplaceTab />
      </div>
      <Footer />
    </div>
  )
}
