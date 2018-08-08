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
  const defaultOpts = (style, scheme, text) => ({
    format: 'svg',
    template: style,
    colorscheme: scheme,
    text: [
      'Greenkeeper',
      text
    ]
  })

  const getAllBadges = async (scheme, text) => ({
    flat: await ghBadges(defaultOpts('flat', scheme, text)),
    'flat-square': await ghBadges(defaultOpts('flat-square', scheme, text)),
    plastic: await ghBadges(defaultOpts('plastic', scheme, text))
  })

  const getEtags = state => ({
    flat: createHash(state['flat']),
    'flat-square': createHash(state['flat-square']),
    plastic: createHash(state['plastic'])
  })

  const enabled = await getAllBadges('brightgreen', 'enabled')
  const disabled = await getAllBadges('lightgray', 'disabled')
  const notfound = await getAllBadges('lightgray', 'not found')
  const paymentRequired = await getAllBadges('yellow', 'payment required')

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

  function getBadge (repoDoc, payDoc, style) {
    if (!repoDoc.enabled) return [disabled[style], etags['disabled'][style]]
    if (!repoDoc.private) return [enabled[style], etags['enabled'][style]]
    if (!payDoc) return [paymentRequired[style], etags['paymentRequired'][style]]
    if ([
      'org', 'org_year', 'org_eur', 'org_year_eur',
      'personal', 'personal_year', 'personal_eur', 'personal_year_eur',
      'team', 'business'
    ].includes(payDoc.plan)) return [enabled[style], etags['enabled'][style]]
    return [paymentRequired[style], etags['paymentRequired'][style]]
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

    const style = ['flat', 'flat-square', 'plastic'].includes(request.query.style) ? request.query.style : 'flat'
    const bt = getBadge(repoDoc, payDoc, style)
    reply(bt[0])
      .type('image/svg+xml')
      .etag(bt[1])
  }
  next()
}

module.exports.attributes = {
  name: 'badges'
}
