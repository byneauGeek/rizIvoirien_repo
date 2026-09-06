// Correction structurelle des messages d'erreur : ~90% des routes renvoyaient
// jusqu'ici e.message brut au client (fuite de texte Prisma technique,
// "Cannot read properties of undefined", etc.). sendError()/classifyError()
// centralisent la traduction — sans jamais casser les erreurs métier
// délibérées (`throw new Error('texte déjà écrit pour l'utilisateur')`),
// qui continuent de s'afficher telles quelles.
const { Prisma } = require('@prisma/client')
const { classifyError, sendError } = require('../src/lib/sendError')

function makePrismaKnownError(code) {
  return Object.create(Prisma.PrismaClientKnownRequestError.prototype, {
    code: { value: code },
    message: { value: `raw prisma message for ${code}` },
  })
}

describe('classifyError — traduction Prisma → message humain', () => {
  test('P2002 (contrainte unique) → 409, message générique traduit', () => {
    const { status, body } = classifyError(makePrismaKnownError('P2002'))
    expect(status).toBe(409)
    expect(body.error).toBe('Cette valeur existe déjà.')
  })

  test('P2025 (enregistrement introuvable) → 404', () => {
    const { status, body } = classifyError(makePrismaKnownError('P2025'))
    expect(status).toBe(404)
    expect(body.error).toBe('Ressource introuvable.')
  })

  test('P2003 (contrainte de clé étrangère) → 400', () => {
    const { status, body } = classifyError(makePrismaKnownError('P2003'))
    expect(status).toBe(400)
    expect(body.error).toBe('Référence invalide.')
  })

  test('un code Prisma non mappé (ex. P2014) retombe sur le message brut, pas une erreur interne', () => {
    const { status, body } = classifyError(makePrismaKnownError('P2014'))
    expect(status).toBe(500)
    expect(body.error).toContain('P2014')
  })
})

describe('classifyError — erreurs inattendues (bugs) jamais exposées brutes', () => {
  test('TypeError → message générique sûr, jamais le texte technique', () => {
    const err = new TypeError("Cannot read properties of undefined (reading 'foo')")
    const { status, body, unexpected } = classifyError(err)
    expect(status).toBe(500)
    expect(body.error).not.toContain('undefined')
    expect(body.error).toBe('Erreur serveur interne. Veuillez réessayer.')
    expect(unexpected).toBe(true)
  })

  test('SyntaxError (ex. JSON malformé) → message générique sûr', () => {
    const err = new SyntaxError('Unexpected token u in JSON at position 0')
    const { body } = classifyError(err)
    expect(body.error).toBe('Erreur serveur interne. Veuillez réessayer.')
  })

  test('ReferenceError et RangeError → même traitement que TypeError', () => {
    expect(classifyError(new ReferenceError('x is not defined')).body.error).toBe('Erreur serveur interne. Veuillez réessayer.')
    expect(classifyError(new RangeError('Invalid array length')).body.error).toBe('Erreur serveur interne. Veuillez réessayer.')
  })
})

describe('classifyError — erreurs métier délibérées : jamais remplacées', () => {
  test('un Error métier avec message déjà écrit pour l\'utilisateur est affiché tel quel', () => {
    const err = new Error('Un motif est requis pour signaler un échec de livraison')
    const { status, body } = classifyError(err)
    expect(status).toBe(500)
    expect(body.error).toBe('Un motif est requis pour signaler un échec de livraison')
  })

  test('un message interpolant un état réel reste intact', () => {
    const err = new Error('Cette livraison est déjà à un statut final (DELIVERED) — aucune transition possible')
    const { body } = classifyError(err)
    expect(body.error).toContain('DELIVERED')
  })
})

describe('sendError — écrit la bonne réponse HTTP', () => {
  function makeRes() {
    const res = { statusCode: null, jsonBody: null }
    res.status = (code) => { res.statusCode = code; return res }
    res.json = (body) => { res.jsonBody = body; return res }
    return res
  }

  test('Prisma P2002 → 409 sur la réponse réelle', () => {
    const res = makeRes()
    sendError(res, makePrismaKnownError('P2002'))
    expect(res.statusCode).toBe(409)
    expect(res.jsonBody.error).toBe('Cette valeur existe déjà.')
  })

  test('erreur métier → 500 avec le message original intact', () => {
    const res = makeRes()
    sendError(res, new Error('Stock insuffisant pour Riz Parfumé'))
    expect(res.statusCode).toBe(500)
    expect(res.jsonBody.error).toBe('Stock insuffisant pour Riz Parfumé')
  })

  test('TypeError → 500 avec message générique, jamais le détail technique', () => {
    const res = makeRes()
    sendError(res, new TypeError("Cannot read properties of null (reading 'id')"))
    expect(res.statusCode).toBe(500)
    expect(res.jsonBody.error).not.toContain('null')
  })
})
