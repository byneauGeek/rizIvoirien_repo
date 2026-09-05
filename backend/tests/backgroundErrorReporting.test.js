const logger = require('../src/lib/logger')

describe('LOT 16 — reportBackgroundError (observabilité des tâches fire-and-forget)', () => {
  test('logge l\'erreur avec son contexte plutôt que de l\'avaler silencieusement', () => {
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const err = new Error('boom')

    logger.reportBackgroundError(err, { task: 'test-task', shipmentId: 42 })

    expect(spy).toHaveBeenCalledTimes(1)
    const [payload, message] = spy.mock.calls[0]
    expect(payload.err).toBe(err)
    expect(payload.task).toBe('test-task')
    expect(payload.shipmentId).toBe(42)
    expect(message).toMatch(/arrière-plan/)

    spy.mockRestore()
  })

  test('ne fait jamais throw, même sans SENTRY_DSN configuré', () => {
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {})
    delete process.env.SENTRY_DSN
    expect(() => logger.reportBackgroundError(new Error('x'), {})).not.toThrow()
    spy.mockRestore()
  })
})
