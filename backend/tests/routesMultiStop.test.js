const request = require('supertest')
const app = require('../src/index')
const { prisma, createUser, createShopUser, createDriverUser, signToken } = require('./helpers')

async function createAssignedShipment({ driver }) {
  const buyer = await createUser('BUYER')
  const { shop } = await createShopUser()
  const order = await prisma.order.create({ data: { buyerId: buyer.id, shopId: shop.id, status: 'PRET', total: 5000, deliveryFee: 1000, address: 'x' } })
  const offer = await prisma.driverOffer.create({ data: { orderId: order.id, driverId: driver.id, status: 'PENDING', expiresAt: new Date(Date.now() + 60000) } })
  await request(app).post(`/api/drivers/offers/${offer.id}/accept`).set('Authorization', `Bearer ${signToken(await prisma.user.findUnique({ where: { id: driver.userId } }))}`)
  const shipment = await prisma.shipment.findUnique({ where: { orderId: order.id } })
  return { buyer, order, shipment }
}

describe('LOT 7 — administration des tournées (routes admin)', () => {
  test('un admin crée une tournée, y ajoute des arrêts ordonnés, et peut les réordonner/retirer', async () => {
    const admin = await createUser('ADMIN')
    const { driver } = await createDriverUser()
    const { shipment: shipment1 } = await createAssignedShipment({ driver })
    const { shipment: shipment2 } = await createAssignedShipment({ driver })

    const createRes = await request(app).post('/api/admin/logistics/routes')
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })
    expect(createRes.status).toBe(201)
    const routeId = createRes.body.route.id
    expect(createRes.body.route.status).toBe('PLANNED')

    const addStop1 = await request(app).post(`/api/admin/logistics/routes/${routeId}/stops`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ shipmentId: shipment1.id, order: 1 })
    expect(addStop1.status).toBe(201)
    const addStop2 = await request(app).post(`/api/admin/logistics/routes/${routeId}/stops`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ shipmentId: shipment2.id, order: 2 })
    expect(addStop2.status).toBe(201)

    const detail = await request(app).get(`/api/admin/logistics/routes/${routeId}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(detail.body.route.stops.map(s => s.order)).toEqual([1, 2])

    // Réordonner
    const reorderRes = await request(app).put(`/api/admin/logistics/routes/${routeId}/stops/${addStop2.body.stop.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ order: 5 })
    expect(reorderRes.status).toBe(200)
    expect(reorderRes.body.stop.order).toBe(5)

    // Retirer un arrêt encore PENDING
    const removeRes = await request(app).delete(`/api/admin/logistics/routes/${routeId}/stops/${addStop1.body.stop.id}`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
    expect(removeRes.status).toBe(204)
  })

  test('impossible d\'ajouter un Shipment déjà assigné à un AUTRE livreur', async () => {
    const admin = await createUser('ADMIN')
    const { driver: driverA } = await createDriverUser()
    const { driver: driverB } = await createDriverUser()
    const { shipment } = await createAssignedShipment({ driver: driverA })

    const routeRes = await request(app).post('/api/admin/logistics/routes')
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driverB.id })
    const routeId = routeRes.body.route.id

    const res = await request(app).post(`/api/admin/logistics/routes/${routeId}/stops`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ shipmentId: shipment.id, order: 1 })
    expect(res.status).toBe(400)
  })

  test('impossible d\'ajouter le même Shipment à deux tournées (unicité)', async () => {
    const admin = await createUser('ADMIN')
    const { driver } = await createDriverUser()
    const { shipment } = await createAssignedShipment({ driver })

    const route1 = await request(app).post('/api/admin/logistics/routes')
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })
    const route2 = await request(app).post('/api/admin/logistics/routes')
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })

    const first = await request(app).post(`/api/admin/logistics/routes/${route1.body.route.id}/stops`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ shipmentId: shipment.id, order: 1 })
    expect(first.status).toBe(201)

    const second = await request(app).post(`/api/admin/logistics/routes/${route2.body.route.id}/stops`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ shipmentId: shipment.id, order: 1 })
    expect(second.status).toBe(409)
  })

  test('un non-admin ne peut pas administrer les tournées', async () => {
    const buyer = await createUser('BUYER')
    const res = await request(app).get('/api/admin/logistics/routes').set('Authorization', `Bearer ${signToken(buyer)}`)
    expect(res.status).toBe(403)
  })
})

describe('LOT 7 — progression du livreur sur une tournée (arrive/complete)', () => {
  test('cycle complet à 2 arrêts : PLANNED -> IN_PROGRESS -> COMPLETED, chaque jalon une seule fois', async () => {
    const admin = await createUser('ADMIN')
    const { user: driverUser, driver } = await createDriverUser()
    const { shipment: shipment1, order: order1 } = await createAssignedShipment({ driver })
    const { shipment: shipment2, order: order2 } = await createAssignedShipment({ driver })

    const routeRes = await request(app).post('/api/admin/logistics/routes')
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driver.id })
    const routeId = routeRes.body.route.id
    const stop1 = await request(app).post(`/api/admin/logistics/routes/${routeId}/stops`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ shipmentId: shipment1.id, order: 1 })
    const stop2 = await request(app).post(`/api/admin/logistics/routes/${routeId}/stops`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ shipmentId: shipment2.id, order: 2 })

    // GET active renvoie la tournée PLANNED avec ses 2 arrêts ordonnés.
    const active = await request(app).get('/api/drivers/routes/active').set('Authorization', `Bearer ${signToken(driverUser)}`)
    expect(active.body.route.id).toBe(routeId)
    expect(active.body.route.stops).toHaveLength(2)

    // Impossible de clôturer l'arrêt avant que la livraison réelle soit terminée.
    const tooEarly = await request(app).put(`/api/drivers/routes/${routeId}/stops/${stop1.body.stop.id}/complete`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`)
    expect(tooEarly.status).toBe(400)

    // Arrivée au 1er arrêt : la tournée passe IN_PROGRESS.
    const arrive1 = await request(app).put(`/api/drivers/routes/${routeId}/stops/${stop1.body.stop.id}/arrive`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`)
    expect(arrive1.status).toBe(200)
    expect(arrive1.body.stop.status).toBe('ARRIVED')
    const afterArrive = await prisma.route.findUnique({ where: { id: routeId } })
    expect(afterArrive.status).toBe('IN_PROGRESS')
    expect(afterArrive.startedAt).toBeTruthy()

    // Livraison réelle du 1er arrêt (OTP, pipeline existant, inchangé).
    await request(app).put(`/api/drivers/delivery/${order1.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    await request(app).put(`/api/drivers/delivery/${order1.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'ARRIVED' })
    const shipmentAfter = await prisma.shipment.findUnique({ where: { orderId: order1.id } })
    await request(app).put(`/api/drivers/delivery/${order1.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'DELIVERED', otp: shipmentAfter.deliveryCode })

    const complete1 = await request(app).put(`/api/drivers/routes/${routeId}/stops/${stop1.body.stop.id}/complete`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`)
    expect(complete1.status).toBe(200)
    expect(complete1.body.stop.status).toBe('COMPLETED')
    expect(complete1.body.routeCompleted).toBe(false) // le 2e arrêt n'est pas encore terminé

    // 2e arrêt : livraison échouée -> le stop reflète FAILED, pas COMPLETED.
    await request(app).put(`/api/drivers/routes/${routeId}/stops/${stop2.body.stop.id}/arrive`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`)
    await request(app).put(`/api/drivers/delivery/${order2.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'IN_TRANSIT' })
    await request(app).put(`/api/drivers/delivery/${order2.id}/status`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`).send({ status: 'FAILED', failureReason: 'Client injoignable' })

    const complete2 = await request(app).put(`/api/drivers/routes/${routeId}/stops/${stop2.body.stop.id}/complete`)
      .set('Authorization', `Bearer ${signToken(driverUser)}`)
    expect(complete2.status).toBe(200)
    expect(complete2.body.stop.status).toBe('FAILED')
    expect(complete2.body.stop.failureReason).toBe('Client injoignable')
    expect(complete2.body.routeCompleted).toBe(true) // les 2 arrêts sont maintenant terminaux

    const routeAfter = await prisma.route.findUnique({ where: { id: routeId } })
    expect(routeAfter.status).toBe('COMPLETED')
    expect(routeAfter.completedAt).toBeTruthy()
  })

  test('un livreur ne peut pas agir sur la tournée d\'un autre livreur', async () => {
    const admin = await createUser('ADMIN')
    const { driver: driverA } = await createDriverUser()
    const { user: driverUserB } = await createDriverUser()
    const { shipment } = await createAssignedShipment({ driver: driverA })

    const routeRes = await request(app).post('/api/admin/logistics/routes')
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ driverId: driverA.id })
    const stopRes = await request(app).post(`/api/admin/logistics/routes/${routeRes.body.route.id}/stops`)
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ shipmentId: shipment.id, order: 1 })

    const res = await request(app).put(`/api/drivers/routes/${routeRes.body.route.id}/stops/${stopRes.body.stop.id}/arrive`)
      .set('Authorization', `Bearer ${signToken(driverUserB)}`)
    expect(res.status).toBe(404)
  })
})
