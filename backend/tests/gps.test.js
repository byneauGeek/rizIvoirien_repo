const { isFreshLocation, haversineKm } = require('../src/lib/gps')

describe('LOT 5 — lib/gps (utilitaires partagés suivi + affectation)', () => {
  test('isFreshLocation : vrai pour une position récente, faux au-delà de 10 min', () => {
    expect(isFreshLocation(new Date())).toBe(true)
    expect(isFreshLocation(new Date(Date.now() - 5 * 60 * 1000))).toBe(true)
    expect(isFreshLocation(new Date(Date.now() - 11 * 60 * 1000))).toBe(false)
  })

  test('isFreshLocation : faux si absente', () => {
    expect(isFreshLocation(null)).toBe(false)
    expect(isFreshLocation(undefined)).toBe(false)
  })

  test('haversineKm : distance nulle pour un même point', () => {
    expect(haversineKm(5.36, -4.0, 5.36, -4.0)).toBeCloseTo(0, 5)
  })

  test('haversineKm : distance cohérente entre deux points connus (~111km par degré de latitude)', () => {
    const d = haversineKm(5.0, -4.0, 6.0, -4.0)
    expect(d).toBeGreaterThan(105)
    expect(d).toBeLessThan(115)
  })
})
