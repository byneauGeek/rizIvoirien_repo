require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding RizIvoirien...')

  // Nettoyer la base
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF')
  await prisma.orderStatusHistory.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.driverOffer.deleteMany()
  await prisma.driverMetric.deleteMany()
  await prisma.order.deleteMany()
  await prisma.product.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.shop.deleteMany()
  await prisma.driver.deleteMany()
  await prisma.address.deleteMany()
  await prisma.inviteCode.deleteMany()
  await prisma.carouselSlide.deleteMany()
  await prisma.platformSettings.deleteMany()
  await prisma.user.deleteMany()
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON')

  const hash = (pw) => bcrypt.hash(pw, 10)

  // ─── Paramètres plateforme ─────────────────────────────────────────────
  await prisma.platformSettings.create({
    data: {
      id: 1,
      commissionRate: 0.05,
      driverCommission: 0.15,
      basicPlanPrice: 0,
      certifiedPlanPrice: 15000,
      driverSubPrice: 5000,
      offerExpiryMin: 15,
      minDriverRating: 3.5,
      maxOfferAttempts: 3,
      maintenanceMode: false,
      supportEmail: 'support@rizivoirien.ci',
      supportPhone: '+225 07 00 00 00',
      updatedAt: new Date(),
    },
  })

  // ─── Admin ────────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      email: 'admin@rizivoirien.ci',
      password: await hash('admin123'),
      name: 'Administrateur',
      phone: '+225 07 00 00 01',
      role: 'ADMIN',
    },
  })

  // ─── Vendeur 1 — Coopérative Agri-Man ─────────────────────────────────
  const vendor1 = await prisma.user.create({
    data: {
      email: 'vendeur1@rizivoirien.ci',
      password: await hash('vendeur123'),
      name: 'Koné Aboubakar',
      phone: '+225 07 11 22 33',
      role: 'SELLER',
      shop: {
        create: {
          name: 'Coopérative Agri-Man',
          slug: 'cooperative-agri-man',
          description: 'Groupement de 47 agriculteurs des hautes terres de Man. Agriculture durable, circuits courts, riz parfumé d\'exception.',
          location: 'Man, Montagnes',
          speciality: 'Riz Parfumé & Jasmin',
          coverImage: 'https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=800&q=80',
          avatar: 'https://images.unsplash.com/photo-1589923188651-268a9765e432?auto=format&fit=crop&w=200&q=80',
          plan: 'CERTIFIED',
          certified: true,
          rating: 4.9,
          reviewCount: 428,
          since: '2019',
          subscription: {
            create: { plan: 'CERTIFIED', status: 'ACTIVE', amount: 15000, endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000) },
          },
        },
      },
    },
    include: { shop: true },
  })

  // ─── Vendeur 2 — Rizeries du Nord ─────────────────────────────────────
  const vendor2 = await prisma.user.create({
    data: {
      email: 'vendeur2@rizivoirien.ci',
      password: await hash('vendeur123'),
      name: 'Touré Mariama',
      phone: '+225 07 44 55 66',
      role: 'SELLER',
      shop: {
        create: {
          name: 'Rizeries du Nord',
          slug: 'rizeries-du-nord',
          description: 'Spécialiste du riz étuvé et bio du nord ivoirien. Méthodes ancestrales revalorisées.',
          location: 'Korhogo, Savanes',
          speciality: 'Riz Étuvé & Bio',
          coverImage: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80',
          avatar: 'https://images.unsplash.com/photo-1566843972142-a7fcb70de55a?auto=format&fit=crop&w=200&q=80',
          plan: 'CERTIFIED',
          certified: true,
          rating: 4.7,
          reviewCount: 312,
          since: '2021',
          subscription: {
            create: { plan: 'CERTIFIED', status: 'ACTIVE', amount: 15000, endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000) },
          },
        },
      },
    },
    include: { shop: true },
  })

  // ─── Acheteur ─────────────────────────────────────────────────────────
  const buyer = await prisma.user.create({
    data: {
      email: 'acheteur@rizivoirien.ci',
      password: await hash('acheteur123'),
      name: 'Diallo Fatou',
      phone: '+225 07 77 88 99',
      role: 'BUYER',
      addresses: {
        create: {
          label: 'Domicile',
          address: 'Rue des Jardins, Cocody',
          city: 'Abidjan',
          isDefault: true,
        },
      },
    },
  })

  // ─── Code d'invitation livreur ─────────────────────────────────────────
  await prisma.inviteCode.create({ data: { code: 'RIZ-DEMO01' } })
  // Codes supplémentaires
  for (let i = 2; i <= 5; i++) {
    await prisma.inviteCode.create({ data: { code: `RIZ-DEMO0${i}` } })
  }

  // ─── Livreur ──────────────────────────────────────────────────────────
  const driverUser = await prisma.user.create({
    data: {
      email: 'livreur@rizivoirien.ci',
      password: await hash('livreur123'),
      name: 'Ouédraogo Issiaka',
      phone: '+225 07 22 33 44',
      role: 'DRIVER',
      driver: {
        create: {
          inviteCode: 'DRV-DEMO01',
          online: true,
          available: true,
          rating: 4.8,
          totalDeliveries: 87,
          acceptanceRate: 0.92,
          monthlyEarnings: 45000,
          metrics: {
            createMany: {
              data: [
                { month: 11, year: 2025, deliveries: 18, earnings: 8100, rating: 4.7 },
                { month: 12, year: 2025, deliveries: 24, earnings: 10800, rating: 4.8 },
                { month: 1, year: 2026, deliveries: 21, earnings: 9450, rating: 4.9 },
                { month: 2, year: 2026, deliveries: 19, earnings: 8550, rating: 4.8 },
                { month: 3, year: 2026, deliveries: 26, earnings: 11700, rating: 4.8 },
                { month: 4, year: 2026, deliveries: 22, earnings: 9900, rating: 4.7 },
              ],
            },
          },
        },
      },
    },
    include: { driver: true },
  })

  // ─── Produits boutique 1 ──────────────────────────────────────────────
  const shop1Id = vendor1.shop.id

  await prisma.product.createMany({
    data: [
      {
        shopId: shop1Id,
        name: 'Riz Parfumé de Man',
        slug: 'riz-parfume-de-man',
        description: 'Cultivé dans les hautes terres de Man, ce riz long grain dégage un arôme subtil de jasmin. Récolte manuelle, séchage naturel.',
        category: 'parfume',
        price: 2500,
        unit: '5kg',
        pricePerKg: 500,
        stock: 84,
        images: JSON.stringify(['https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80']),
        badge: 'Best-seller',
        origin: 'Man, Montagnes',
        harvest: 'Octobre 2025',
      },
      {
        shopId: shop1Id,
        name: 'Riz Jasmin de l\'Ouest',
        slug: 'riz-jasmin-de-louest',
        description: 'Notre cuvée prestige. Arôme floral intense, grains nacrés. Cultivé en altitude à plus de 800m. Production limitée à 200 sacs par saison.',
        category: 'parfume',
        price: 3500,
        unit: '5kg',
        pricePerKg: 700,
        stock: 22,
        images: JSON.stringify(['https://images.unsplash.com/photo-1618897996318-5a901fa80dce?auto=format&fit=crop&w=800&q=80']),
        badge: 'Édition Limitée',
        origin: 'Man, Tonkpi',
        harvest: 'Décembre 2025',
      },
      {
        shopId: shop1Id,
        name: 'Riz Blanc Long Grain Premium',
        slug: 'riz-blanc-long-grain-premium',
        description: 'Riz blanc classique, grains longs et translucides. Parfait pour toutes occasions.',
        category: 'blanc',
        price: 2000,
        unit: '5kg',
        pricePerKg: 400,
        stock: 150,
        images: JSON.stringify(['https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80']),
        badge: null,
        origin: 'Man, Montagnes',
        harvest: 'Août 2025',
      },
    ],
  })

  // ─── Produits boutique 2 ──────────────────────────────────────────────
  const shop2Id = vendor2.shop.id

  await prisma.product.createMany({
    data: [
      {
        shopId: shop2Id,
        name: 'Riz Étuvé Premium Bouaké',
        slug: 'riz-etuive-premium-bouake',
        description: 'Processus d\'étuvage traditionnel qui conserve 80% des nutriments. Grains fermes, non-collants.',
        category: 'etuive',
        price: 2000,
        unit: '5kg',
        pricePerKg: 400,
        stock: 120,
        images: JSON.stringify(['https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80']),
        badge: 'Nouveau',
        origin: 'Bouaké, Vallée du Bandama',
        harvest: 'Septembre 2025',
      },
      {
        shopId: shop2Id,
        name: 'Riz Cargo Bio du Nord',
        slug: 'riz-cargo-bio-du-nord',
        description: 'Agriculture 100% biologique certifiée. Riche en fibres et en vitamines. Le riz complet idéal pour une alimentation saine.',
        category: 'bio',
        price: 3200,
        unit: '5kg',
        pricePerKg: 640,
        stock: 38,
        images: JSON.stringify(['https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&w=800&q=80']),
        badge: 'Bio',
        origin: 'Korhogo, Savanes',
        harvest: 'Novembre 2025',
      },
      {
        shopId: shop2Id,
        name: 'Riz Brisé Supérieur',
        slug: 'riz-brise-superieur',
        description: 'Le riz brisé préféré des restaurants et des grandes familles. Texture fondante, cuisson rapide.',
        category: 'brise',
        price: 1500,
        unit: '5kg',
        pricePerKg: 300,
        stock: 400,
        images: JSON.stringify(['https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80']),
        badge: 'Économique',
        origin: 'Korhogo, Savanes',
        harvest: 'Octobre 2025',
      },
    ],
  })

  // ─── Carousel ─────────────────────────────────────────────────────────
  await prisma.carouselSlide.createMany({
    data: [
      {
        type: 'promotion',
        title: 'Saison des Récoltes',
        subtitle: 'Riz parfumé de Man — Arrivage de novembre',
        badge: 'Nouveau stock',
        cta: 'Découvrir',
        ctaLink: '/shop',
        bg: '#1B4332',
        accent: '#E8A217',
        image: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=1400&q=80',
        active: true,
        position: 0,
      },
      {
        type: 'boutique',
        title: 'Coopérative Agri-Man',
        subtitle: '47 producteurs, une seule passion. Riz de montagne certifié.',
        badge: 'Boutique Certifiée',
        cta: 'Visiter la boutique',
        ctaLink: '/shop',
        bg: '#C4501A',
        accent: '#FDF6E3',
        image: 'https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=1400&q=80',
        active: true,
        position: 1,
      },
      {
        type: 'produit',
        title: 'Riz Jasmin — Édition Limitée',
        subtitle: 'Production limitée à 200 sacs. Réservez maintenant.',
        badge: '⚡ Stock limité',
        cta: 'Réserver',
        ctaLink: '/product/riz-jasmin-de-louest',
        bg: '#0D2B1E',
        accent: '#D4A853',
        image: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&w=1400&q=80',
        active: true,
        position: 2,
      },
    ],
  })

  // ─── Commandes demo ────────────────────────────────────────────────────
  const products = await prisma.product.findMany({ take: 3 })

  const order1 = await prisma.order.create({
    data: {
      buyerId: buyer.id,
      shopId: shop1Id,
      driverId: driverUser.driver.id,
      address: 'Rue des Jardins, Cocody, Abidjan',
      total: 5000,
      deliveryFee: 1500,
      status: 'DELIVERED',
      items: {
        create: [{ productId: products[0].id, quantity: 2, price: products[0].price, name: products[0].name }],
      },
      statusHistory: {
        createMany: {
          data: [
            { status: 'PENDING', note: 'Commande passée', actorId: buyer.id, createdAt: new Date(Date.now() - 3 * 3600000) },
            { status: 'CONFIRMED', note: 'Livreur assigné', actorId: admin.id, createdAt: new Date(Date.now() - 2.5 * 3600000) },
            { status: 'EN_PREPARATION', note: 'En préparation', actorId: vendor1.id, createdAt: new Date(Date.now() - 2 * 3600000) },
            { status: 'PRET', note: 'Prête à récupérer', actorId: vendor1.id, createdAt: new Date(Date.now() - 1.5 * 3600000) },
            { status: 'IN_TRANSIT', note: 'Récupérée par le livreur', actorId: driverUser.id, createdAt: new Date(Date.now() - 1 * 3600000) },
            { status: 'DELIVERED', note: 'Livrée', actorId: driverUser.id, createdAt: new Date(Date.now() - 0.5 * 3600000) },
          ],
        },
      },
    },
  })

  const order2 = await prisma.order.create({
    data: {
      buyerId: buyer.id,
      shopId: shop2Id,
      address: 'Rue des Jardins, Cocody, Abidjan',
      total: 3200,
      deliveryFee: 1500,
      status: 'EN_PREPARATION',
      items: {
        create: [{ productId: products[3]?.id || products[1].id, quantity: 1, price: products[1].price, name: products[1].name }],
      },
      statusHistory: {
        createMany: {
          data: [
            { status: 'PENDING', note: 'Commande passée', actorId: buyer.id },
            { status: 'CONFIRMED', note: 'Livreur assigné', actorId: admin.id },
            { status: 'EN_PREPARATION', note: 'En préparation', actorId: vendor2.id },
          ],
        },
      },
    },
  })

  console.log('\n✅ Seed terminé !\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📧 Comptes de démonstration :')
  console.log('  Admin    → admin@rizivoirien.ci     / admin123')
  console.log('  Vendeur1 → vendeur1@rizivoirien.ci  / vendeur123')
  console.log('  Vendeur2 → vendeur2@rizivoirien.ci  / vendeur123')
  console.log('  Acheteur → acheteur@rizivoirien.ci  / acheteur123')
  console.log('  Livreur  → livreur@rizivoirien.ci   / livreur123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎟️  Code invitation livreur : RIZ-DEMO01')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
