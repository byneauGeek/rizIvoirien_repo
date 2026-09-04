import { createContext, useContext, useEffect, useState } from 'react'
import { API_BASE } from '../config'

const SEOContext = createContext(null)

const DEFAULTS = {
  seoTitle:           'RizIvoirien — Marketplace de riz en Côte d\'Ivoire',
  seoDescription:     'Achetez du riz de qualité directement auprès de coopératives ivoiriennes. Livraison rapide à Abidjan et dans toute la Côte d\'Ivoire.',
  seoKeywords:        'riz ivoirien, achat riz, marketplace riz, Côte d\'Ivoire, livraison riz Abidjan',
  seoOgImage:         '',
  seoCanonicalDomain: 'https://rizivoirien.ci',
  seoGoogleId:        '',
  seoFbPixelId:       '',
  seoRobotsIndex:     true,
  seoSitemapEnabled:  true,
  maintenanceMode:    false,
  supportEmail:       'support@rizivoirien.ci',
  supportPhone:       '+225 07 00 00 00',
}

export function SEOProvider({ children }) {
  const [seo, setSeo] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/settings/public`)
      .then(r => r.json())
      .then(data => {
        if (data && Object.keys(data).length > 0) {
          setSeo({ ...DEFAULTS, ...data })
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  // Inject Google Analytics when ID is set
  useEffect(() => {
    if (!seo.seoGoogleId) return
    const script1 = document.createElement('script')
    script1.async = true
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${seo.seoGoogleId}`
    document.head.appendChild(script1)
    const script2 = document.createElement('script')
    // JSON.stringify échappe correctement la valeur (defense-in-depth : la
    // validation de format vit côté backend, PUT /admin/settings).
    script2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(seo.seoGoogleId)});`
    document.head.appendChild(script2)
    return () => {
      document.head.removeChild(script1)
      document.head.removeChild(script2)
    }
  }, [seo.seoGoogleId])

  // Inject Facebook Pixel when ID is set
  useEffect(() => {
    if (!seo.seoFbPixelId) return
    const script = document.createElement('script')
    script.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(seo.seoFbPixelId)});fbq('track','PageView');`
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [seo.seoFbPixelId])

  return (
    <SEOContext.Provider value={{ seo, setSeo, loaded }}>
      {children}
    </SEOContext.Provider>
  )
}

export const useSEO = () => useContext(SEOContext)
