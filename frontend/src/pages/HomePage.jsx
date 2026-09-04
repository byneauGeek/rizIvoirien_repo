import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import Hero from '../components/home/Hero'
import StatsSection from '../components/home/StatsSection'
import HeroCarousel from '../components/home/HeroCarousel'
import CategorySection from '../components/home/CategorySection'
import FeaturedProducts from '../components/home/FeaturedProducts'
import FeaturedShops from '../components/home/FeaturedShops'
import HowItWorks from '../components/home/HowItWorks'
import SEOHead from '../components/SEOHead'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SEOHead />
      <Navbar />
      <Hero />
      <StatsSection />
      <HeroCarousel />
      <CategorySection />
      <FeaturedProducts />
      <FeaturedShops />
      <HowItWorks />
      <Footer />
    </div>
  )
}
