const router = require('express').Router()
const prisma = require('../lib/prisma')
const { sendError } = require('../lib/sendError')

// GET /api/stats — stats publiques pour la homepage
router.get('/', async (req, res) => {
  try {
    const [products, shops, sellers, totalDeliveriesAgg] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.shop.count({ where: { active: true } }),
      prisma.user.count({ where: { role: 'SELLER' } }),
      prisma.driver.aggregate({ _sum: { totalDeliveries: true } }),
    ])

    res.json({
      products,
      shops,
      sellers,
      deliveries: totalDeliveriesAgg._sum.totalDeliveries || 0,
    })
  } catch (e) {
    sendError(res, e)
  }
})

module.exports = router
