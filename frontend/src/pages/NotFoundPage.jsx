import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Search, ArrowLeft } from 'lucide-react'
import Navbar from '../components/layout/Navbar'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-lg"
        >
          {/* Illustration */}
          <div className="relative mb-8">
            <p className="font-playfair text-[120px] font-bold text-charcoal/6 leading-none select-none">404</p>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl">🌾</span>
            </div>
          </div>

          <h1 className="font-playfair text-3xl font-bold text-charcoal mb-3">Page introuvable</h1>
          <p className="font-dm text-charcoal/50 mb-10 leading-relaxed">
            Cette page n'existe pas ou a été déplacée. Pas de panique — notre marché est toujours ouvert !
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 bg-forest text-cream font-syne font-bold px-6 py-3.5 rounded-2xl hover:bg-forest/90 transition-colors"
            >
              <Home size={16} /> Accueil
            </Link>
            <Link
              to="/shop"
              className="flex items-center gap-2 bg-white border-2 border-charcoal/10 text-charcoal font-syne font-bold px-6 py-3.5 rounded-2xl hover:border-charcoal/30 transition-colors"
            >
              <Search size={16} /> Parcourir le marché
            </Link>
          </div>

          <button
            onClick={() => window.history.back()}
            className="mt-6 inline-flex items-center gap-1.5 font-dm text-sm text-charcoal/40 hover:text-charcoal/70 transition-colors"
          >
            <ArrowLeft size={14} /> Page précédente
          </button>
        </motion.div>
      </div>
    </div>
  )
}
