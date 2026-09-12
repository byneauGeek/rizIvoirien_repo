const crypto = require('crypto')
const prisma = require('../lib/prisma')

// LOT SIGNATURE (audit XXX RIZ) : jusqu'ici "signer" ne faisait que basculer
// Contract.status/signedAt, sans capturer d'identité ni figer le contenu
// réellement accepté — une régénération ultérieure écrase Contract.content
// en place et effacerait silencieusement toute preuve. Partagé entre
// shops.js et drivers.js : même geste de signature, juste un holder différent.
async function signContract({ contract, holderUpdate, signerUserId, signedByName, ipAddress, userAgent }) {
  const contentSnapshot = contract.content
  const contentHash = crypto.createHash('sha256').update(contentSnapshot).digest('hex')

  return prisma.$transaction(async (db) => {
    await db.contract.update({ where: { id: contract.id }, data: { status: 'SIGNED', signedAt: new Date() } })
    await holderUpdate(db)
    return db.contractSignature.create({
      data: { contractId: contract.id, signerUserId, signedByName, contentSnapshot, contentHash, ipAddress, userAgent },
    })
  })
}

module.exports = { signContract }
