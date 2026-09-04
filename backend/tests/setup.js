const { DATABASE_URL, JWT_SECRET } = require('./testEnv')

process.env.DATABASE_URL = DATABASE_URL
process.env.JWT_SECRET = JWT_SECRET
process.env.NODE_ENV = 'test'
process.env.SMTP_HOST = '' // mailer bascule sur jsonTransport (pas d'envoi réel)
process.env.ALLOWED_ORIGINS = ''
