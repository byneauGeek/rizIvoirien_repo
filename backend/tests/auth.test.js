const request = require('supertest')
const app = require('../src/index')

describe('Auth', () => {
  const email = 'test-auth@rizivoirien.test'
  const password = 'S3cretPass!'

  test('POST /api/auth/register crée un compte BUYER et renvoie un token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password, name: 'Test Buyer', phone: '0700000000' })

    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.role).toBe('BUYER')
    expect(res.body.user.password).toBeUndefined()
  })

  test('POST /api/auth/register refuse un email déjà utilisé', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password, name: 'Duplicate' })
    expect(res.status).toBe(409)
  })

  test('POST /api/auth/login réussit avec le bon mot de passe', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
  })

  test('POST /api/auth/login échoue avec un mauvais mot de passe', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' })
    expect(res.status).toBe(401)
  })

  test('GET /api/auth/me sans token → 401', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  test('GET /api/auth/me avec un token invalide → 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token')
    expect(res.status).toBe(401)
  })

  test('GET /api/auth/me avec un token valide → profil utilisateur', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password })
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`)
    expect(res.status).toBe(200)
    expect(res.body.email).toBe(email)
  })

  test('un token ne doit jamais être accepté en query string sur une route standard (fix sécurité)', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password })
    const res = await request(app).get(`/api/auth/me?token=${login.body.token}`)
    // authenticate() n'accepte plus le token que via le header Authorization
    expect(res.status).toBe(401)
  })
})
