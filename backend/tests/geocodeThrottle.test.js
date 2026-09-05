// LOT 18 (préparation production) : Nominatim (géocodage gratuit, sans clé)
// impose un maximum d'1 requête/seconde — sans limite interne, des commandes
// simultanées ayant chacune besoin d'un géocodage pouvaient dépasser ce
// seuil et risquer un blocage de l'IP du serveur, cassant le géocodage pour
// toute l'application (estimation ET suivi client, LOT8).
const https = require('https')

describe('LOT 18 — throttle du géocodage (politique d\'usage Nominatim)', () => {
  let getSpy

  beforeEach(() => {
    jest.resetModules()
    let call = 0
    getSpy = jest.spyOn(https, 'get').mockImplementation((options, cb) => {
      call += 1
      const res = {
        on: (event, handler) => {
          if (event === 'data') handler(JSON.stringify([{ lat: String(5.3 + call), lon: String(-4.0 - call) }]))
          if (event === 'end') handler()
        },
      }
      setImmediate(() => cb(res))
      return { on: () => {}, setTimeout: () => {}, destroy: () => {} }
    })
  })

  afterEach(() => {
    getSpy.mockRestore()
  })

  test('espace deux géocodages concurrents d\'au moins ~1 seconde', async () => {
    const { geocodeAddress } = require('../src/services/deliveryService')
    const start = Date.now()

    const [a, b] = await Promise.all([geocodeAddress('Cocody'), geocodeAddress('Plateau')])

    const elapsed = Date.now() - start
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(getSpy).toHaveBeenCalledTimes(2)
    // Le 2e appel doit avoir attendu la fenêtre minimale après le 1er.
    expect(elapsed).toBeGreaterThanOrEqual(1000)
  }, 10000)

  test('un appel isolé n\'est pas artificiellement ralenti', async () => {
    const { geocodeAddress } = require('../src/services/deliveryService')
    const start = Date.now()
    await geocodeAddress('Cocody')
    expect(Date.now() - start).toBeLessThan(500)
  })
})
