const crypto = require('crypto')

const _ = require('lodash')

const dbs = require('./dbs')
const env = require('./env')

// error second API like a pro
const ghBadgesCb = require('gh-badges')
const ghBadges = (data) => new Promise((resolve, reject) => {
  try {
    ghBadgesCb(data, (result, err) => {
      if (err) return reject(err)
      resolve(result)
    })
  } catch (err) {
    reject(err)
  }
})

module.exports = async function badges (server, options, next) {
  const enabled = await ghBadges({
    format: 'svg',
    template: 'flat',
    colorscheme: 'brightgreen',
    text: [
      'Greenkeeper',
      'enabled'
    ]
  })

  const disabled = await ghBadges({
    format: 'svg',
    template: 'flat',
    colorscheme: 'lightgray',
    text: [
      'Greenkeeper',
      'disabled'
    ]
  })

  const notfound = await ghBadges({
    format: 'svg',
    template: 'flat',
    colorscheme: 'lightgray',
    text: [
      'Greenkeeper',
      'not found'
    ]
  })

  const paymentRequired = await ghBadges({
    format: 'svg',
    template: 'flat',
    colorscheme: 'yellow',
    text: [
      'Greenkeeper',
      'payment required'
    ]
  })

  function createHash (bytes) {
    const hash = crypto.createHash('sha256')
    hash.update(bytes)
    return hash.digest('hex')
  }

  const etags = {
    notfound: createHash(notfound),
    enabled: createHash(enabled),
    disabled: createHash(disabled),
    paymentRequired: createHash(paymentRequired)
  }

  function getBadge (repoDoc, payDoc) {
    if (!repoDoc.enabled) return [disabled, etags['disabled']]
    if (!repoDoc.private) return [enabled, etags['enabled']]
    if (!payDoc) return [paymentRequired, etags['paymentRequired']]
    if (payDoc.plan === 'org' || payDoc.plan === 'personal') return [enabled, etags['enabled']]
    return [paymentRequired, etags['paymentRequired']]
  }

  function getToken (data) {
    return crypto.createHmac('sha256', env.BADGES_SECRET).update(data).digest('hex')
  }

  function replyNotFound (reply) {
    reply(notfound)
    .type('image/svg+xml')
    .etag(etags.notfound)
  }

  server.route({
    method: 'GET',
    path: '/{owner}/{repo}.svg',
    handler: handleBadges
  })

  async function handleBadges (request, reply) {
    const {repositories, payments} = await dbs()

    const key = request.paramsArray.join('/').toLowerCase()
    try {
      var repoDoc = _.get((await repositories.query('by_full_name', {
        key,
        include_docs: true
      })), 'rows[0].doc')
    } catch (err) {}

    if (!repoDoc) {
      return replyNotFound(reply)
    }

    if (repoDoc.private && request.query.token !== getToken(key) && request.query.token !== getToken(repoDoc._id)) return replyNotFound(reply)

    try {
      var payDoc = await payments.get(repoDoc.accountId)
    } catch (err) {}

    const bt = getBadge(repoDoc, payDoc)
    reply(bt[0])
    .type('image/svg+xml')
    .etag(bt[1])
  }
  next()
}

module.exports.attributes = {
  name: 'badges'
}
