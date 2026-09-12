import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LifeBuoy } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import SupportPanel from '../components/support/SupportPanel'

export default function SupportPage() {
  usePageTitle('Support')
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) navigate('/auth')
  }, [user, navigate])

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-8 h-screen flex flex-col">
        <div className="mb-4">
          <p className="font-syne text-xs font-bold tracking-widest uppercase text-charcoal/40">Mon espace</p>
          <h1 className="font-playfair text-3xl font-bold text-charcoal flex items-center gap-2">
            <LifeBuoy size={26} /> Support
          </h1>
        </div>
        <SupportPanel className="flex-1 min-h-0" />
      </div>
    </div>
  )
}
