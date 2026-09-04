// Détection de tendance : compare moyenne de la 2e moitié vs 1ère moitié d'un tableau de valeurs
export const detectTrend = (values) => {
  if (!values || values.length < 4) return { direction: 'stable', pct: 0 }
  const mid = Math.floor(values.length / 2)
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
  const first = avg(values.slice(0, mid))
  const second = avg(values.slice(mid))
  if (first === 0) return { direction: second > 0 ? 'up' : 'stable', pct: 0 }
  const pct = Math.round((second - first) / first * 100)
  return { direction: pct > 5 ? 'up' : pct < -5 ? 'down' : 'stable', pct }
}

// Prévision fin de mois : extrapolation linéaire
export const forecastMonth = (currentValue, dayOfMonth) => {
  if (!dayOfMonth || dayOfMonth === 0) return 0
  return Math.round((currentValue / dayOfMonth) * 30)
}

// Score de santé plateforme (0-100)
export const platformHealthScore = ({ deliveryRate, cancellationRate, avgRating, repeatBuyerRate }) => {
  const delivery = Math.min((deliveryRate || 0), 100) * 0.35
  const cancel   = Math.max(0, 100 - (cancellationRate || 0)) * 0.25
  const rating   = ((avgRating || 0) / 5) * 100 * 0.25
  const repeat   = (repeatBuyerRate || 0) * 0.15
  return Math.round(delivery + cancel + rating + repeat)
}

export const trendColor = (direction) =>
  direction === 'up' ? 'text-green-600' : direction === 'down' ? 'text-red-500' : 'text-charcoal/40'

export const trendBg = (direction) =>
  direction === 'up' ? 'bg-green-50 text-green-700' : direction === 'down' ? 'bg-red-50 text-red-600' : 'bg-charcoal/5 text-charcoal/40'

export const trendArrow = (direction) =>
  direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'

export const fmtFCFA = (n) => `${Math.round(n || 0).toLocaleString('fr-FR')} FCFA`

// Génère les insights admin depuis les métriques brutes
export const buildAdminInsights = ({ kpis, topShops, repeatBuyerRate }) => {
  const insights = []
  const { growthRate, totalRevenue, monthRevenue, cancellationRate, commission } = kpis || {}

  if ((cancellationRate || 0) > 15)
    insights.push({ icon: '⚠️', type: 'warning', title: `Taux d'annulation élevé (${cancellationRate}%)`, body: 'Plus de 15% des commandes sont annulées. Vérifiez la disponibilité des produits et les délais de livraison.' })

  if ((growthRate || 0) > 10)
    insights.push({ icon: '🚀', type: 'success', title: `Croissance soutenue +${Math.round(growthRate)}% ce mois`, body: 'Le volume de commandes est en forte hausse. Assurez-vous que la capacité de livraison suit.' })
  else if ((growthRate || 0) < -10)
    insights.push({ icon: '📉', type: 'warning', title: `Baisse du volume ${Math.round(growthRate)}% ce mois`, body: 'Le nombre de commandes recule. Analysez les catégories concernées et envisagez des promotions.' })

  if ((repeatBuyerRate || 0) > 40)
    insights.push({ icon: '❤️', type: 'success', title: `Fidélisation forte : ${repeatBuyerRate}% d'acheteurs récurrents`, body: 'Plus de 40% des clients commandent régulièrement. La plateforme génère de la rétention.' })
  else if ((repeatBuyerRate || 0) < 20)
    insights.push({ icon: '💡', type: 'info', title: `Rétention faible (${repeatBuyerRate}%)`, body: 'La majorité des acheteurs ne revient pas. Envisagez un programme de fidélité ou des offres de retour.' })

  if (topShops?.length > 0 && totalRevenue > 0) {
    const topShare = Math.round(((topShops[0]?._sum?.total || 0) / totalRevenue) * 100)
    if (topShare > 30)
      insights.push({ icon: '⚖️', type: 'info', title: `Concentration : ${topShops[0]?.shop?.name} génère ${topShare}% du CA`, body: 'Une boutique représente plus du tiers du CA total. Diversifiez en onboardant de nouveaux partenaires.' })
  }

  if (commission > 0 && monthRevenue > 0) {
    const commRate = Math.round((commission / (totalRevenue || 1)) * 100)
    insights.push({ icon: '💰', type: 'info', title: `Commission : ${fmtFCFA(commission)} perçue`, body: `Taux effectif de ${commRate}% sur le CA total de la plateforme.` })
  }

  return insights
}

// Génère les insights vendeur depuis les métriques de la boutique
export const buildVendorInsights = ({ revenueByProduct, stockVelocity, dailyStats, caMonth, caLastMonth }) => {
  const insights = []

  // Produit gagnant
  if (revenueByProduct?.length > 0) {
    const top = revenueByProduct[0]
    const topPct = caMonth > 0 ? Math.round((top.revenue / caMonth) * 100) : 0
    insights.push({ icon: '⭐', type: 'success', title: `${top.name} est votre top produit`, body: `Il représente ${topPct}% de votre CA ce mois avec ${top.quantity} unité${top.quantity > 1 ? 's' : ''} vendues.` })
  }

  // Produits stagnants (vendu dans revenueByProduct mais quantité = 0 sur 14j)
  // On identifie le produit avec la plus faible quantité parmi les actifs dans stockVelocity
  if (stockVelocity?.length > 0) {
    const stagnant = stockVelocity.filter(p => p.soldLast30 === 0 && p.stock > 0)
    if (stagnant.length > 0)
      insights.push({ icon: '😴', type: 'warning', title: `${stagnant.length} produit${stagnant.length > 1 ? 's' : ''} sans vente depuis 30 jours`, body: `Ex : "${stagnant[0].name}" (${stagnant[0].stock} en stock). Pensez à baisser le prix ou faire une promotion.` })

    // Alerte stock critique
    const critical = stockVelocity.filter(p => p.daysLeft !== null && p.daysLeft <= 7 && p.daysLeft > 0)
    if (critical.length > 0)
      insights.push({ icon: '📦', type: 'warning', title: `Stock critique : "${critical[0].name}"`, body: `Épuisement estimé dans ${critical[0].daysLeft} jour${critical[0].daysLeft > 1 ? 's' : ''} au rythme actuel. Réapprovisionnez rapidement.` })
  }

  // Meilleur jour de la semaine
  if (dailyStats?.length >= 7) {
    const dowMap = {}
    const DOW_FR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
    for (const d of dailyStats) {
      const day = new Date(d.date).getDay()
      if (!dowMap[day]) dowMap[day] = { orders: 0, revenue: 0, count: 0 }
      dowMap[day].orders += d.orders
      dowMap[day].revenue += d.revenue
      dowMap[day].count++
    }
    const dowArr = Object.entries(dowMap).map(([day, v]) => ({ day: parseInt(day), avgOrders: v.count > 0 ? v.orders / v.count : 0 }))
    if (dowArr.length > 0) {
      const best = dowArr.reduce((a, b) => b.avgOrders > a.avgOrders ? b : a)
      const worst = dowArr.reduce((a, b) => b.avgOrders < a.avgOrders ? b : a)
      if (best.avgOrders > 0 && best.avgOrders > worst.avgOrders * 1.5)
        insights.push({ icon: '📅', type: 'info', title: `Meilleur jour : ${DOW_FR[best.day]}`, body: `Vous vendez ${Math.round(best.avgOrders / (worst.avgOrders || 0.1))}× plus le ${DOW_FR[best.day]} que le jour le plus calme. Publiez vos offres ce jour-là.` })
    }
  }

  // CA en baisse
  if (caLastMonth > 0 && caMonth < caLastMonth * 0.85)
    insights.push({ icon: '📉', type: 'warning', title: `CA en baisse vs mois dernier (${Math.round(((caMonth - caLastMonth) / caLastMonth) * 100)}%)`, body: 'Votre chiffre d\'affaires recule. Analysez vos produits et envisagez des promotions.' })

  return insights
}

// Génère les tips personnalisés pour un livreur
export const buildDriverTips = ({ stats, platformAvg, nextBadge }) => {
  const tips = []
  const { rating = 0, acceptanceRate = 100, totalDeliveries = 0, monthlyEarnings = 0 } = stats || {}
  const platformRating = platformAvg?.rating || 4.2
  const platformAcceptance = platformAvg?.acceptanceRate || 75

  if (rating < 4.0)
    tips.push({ icon: '⭐', type: 'warning', title: `Note (${rating}★) en dessous de la moyenne plateforme (${platformRating}★)`, body: 'Soignez votre ponctualité, communication client et état du colis. Une meilleure note = plus d\'offres.' })
  else if (rating >= 4.5)
    tips.push({ icon: '🏆', type: 'success', title: `Excellente note (${rating}★) !`, body: `Vous êtes au-dessus de la moyenne plateforme (${platformRating}★). Continuez comme ça !` })

  if (acceptanceRate < 70)
    tips.push({ icon: '📱', type: 'warning', title: `Taux d'acceptation faible (${acceptanceRate}%)`, body: `La plateforme attend un minimum de 70%. En dessous de ${platformAcceptance}% de moyenne, les avertissements s'accumulent.` })

  if (nextBadge && totalDeliveries < nextBadge.minDeliveries) {
    const remaining = nextBadge.minDeliveries - totalDeliveries
    tips.push({ icon: nextBadge.icon, type: 'info', title: `${remaining} livraison${remaining > 1 ? 's' : ''} pour obtenir "${nextBadge.label}"`, body: `Badge suivant à ${nextBadge.minDeliveries} livraisons. Continuez à votre rythme !` })
  }

  if (tips.length === 0)
    tips.push({ icon: '✨', type: 'success', title: 'Profil exemplaire !', body: 'Toutes vos métriques sont au vert. Vous faites partie des meilleurs livreurs de la plateforme.' })

  return tips
}
