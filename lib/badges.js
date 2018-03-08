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
  const defaultOpts = (style, colorB, text) => ({
    format: 'svg',
    template: style,
    colorA: '#555',
    colorB,
    text: [
      'Greenkeeper',
      text
    ]
  })

  const getAllBadges = async (colorB, text) => ({
    flat: await ghBadges(defaultOpts('flat', colorB, text)),
    'flat-square': await ghBadges(defaultOpts('flat-square', colorB, text)),
    plastic: await ghBadges(defaultOpts('plastic', colorB, text))
  })

  const getEtags = state => ({
    flat: createHash(state['flat']),
    'flat-square': createHash(state['flat-square']),
    plastic: createHash(state['plastic'])
  })

  const enabled = await getAllBadges('#4c1', 'enabled')
  const disabled = await getAllBadges('#9f9f9f', 'disabled')
  const notfound = await getAllBadges('#9f9f9f', 'not found')
  const paymentRequired = await getAllBadges('#dfb317', 'payment required')

  function createHash (bytes) {
    const hash = crypto.createHash('sha256')
    hash.update(bytes)
    return hash.digest('hex')
  }

  const etags = {
    notfound: getEtags(notfound),
    enabled: getEtags(enabled),
    disabled: getEtags(disabled),
    paymentRequired: getEtags(paymentRequired)
  }

  function getBadge (repoDoc, payDoc) {
    if (!repoDoc.enabled) return [disabled, etags['disabled']]
    if (!repoDoc.private) return [enabled, etags['enabled']]
    if (!payDoc) return [paymentRequired, etags['paymentRequired']]
    if (['org', 'personal', 'team', 'business'].includes(payDoc.plan)) return [enabled, etags['enabled']]
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
