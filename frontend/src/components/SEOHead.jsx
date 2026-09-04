import { Helmet } from 'react-helmet-async'
import { useSEO } from '../context/SEOContext'

/**
 * SEOHead — composant à placer dans chaque page pour injecter les meta tags.
 * Les props surchargent les valeurs globales issues des paramètres admin.
 *
 * Usage :
 *   <SEOHead title="Boutiques — RizIvoirien" description="..." />
 *   <SEOHead /> — utilise les valeurs globales
 */
export default function SEOHead({
  title,
  description,
  keywords,
  ogImage,
  ogType = 'website',
  canonical,
  noIndex = false,
}) {
  const { seo } = useSEO() || {}

  const finalTitle       = title       || seo?.seoTitle       || 'RizIvoirien'
  const finalDescription = description || seo?.seoDescription || ''
  const finalKeywords    = keywords    || seo?.seoKeywords    || ''
  const finalOgImage     = ogImage     || seo?.seoOgImage     || ''
  const finalCanonical   = canonical   || (seo?.seoCanonicalDomain ? `${seo.seoCanonicalDomain}${window.location.pathname}` : window.location.href)
  const shouldIndex      = noIndex ? false : (seo?.seoRobotsIndex !== false)

  return (
    <Helmet>
      {/* Primaires */}
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      {finalKeywords && <meta name="keywords" content={finalKeywords} />}
      <meta name="robots" content={shouldIndex ? 'index, follow' : 'noindex, nofollow'} />
      <link rel="canonical" href={finalCanonical} />

      {/* Open Graph (Facebook, WhatsApp, LinkedIn…) */}
      <meta property="og:title"       content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:type"        content={ogType} />
      <meta property="og:url"         content={finalCanonical} />
      {finalOgImage && <meta property="og:image" content={finalOgImage} />}
      <meta property="og:locale"      content="fr_CI" />
      <meta property="og:site_name"   content="RizIvoirien" />

      {/* Twitter Card */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      {finalOgImage && <meta name="twitter:image" content={finalOgImage} />}

      {/* Langue */}
      <html lang="fr" />
    </Helmet>
  )
}
