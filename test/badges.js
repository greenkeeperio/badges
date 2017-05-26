const crypto = require('crypto')

const hapi = require('hapi')
const tap = require('tap')

const register = require('../lib/badges')
const dbs = require('../lib/dbs')

;(async () => {
  let server
  tap.beforeEach(async () => {
    server = new hapi.Server()
    server.connection()
    await server.register({register})
  })

  tap.test('returns not found for repo not in db', async (t) => {
    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/not/synced.svg'
    })

    t.is(statusCode, 200, 'statusCode')
    t.ok(payload.includes('not found'))
    t.ok(payload.includes('Greenkeeper'))
    t.ok(payload.includes('#555'))

    t.end()
  })

  tap.test('returns not found for private repo', async (t) => {
    const {repositories, payments} = await dbs()

    await repositories.post({
      type: 'repository',
      fullName: 'repo/private',
      private: true,
      accountId: '4242'
    })

    await payments.put({
      _id: '4242',
      plan: 'org'
    })

    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/repo/private.svg'
    })

    t.is(statusCode, 200, 'statusCode')
    t.ok(payload.includes('not found'))
    t.ok(payload.includes('Greenkeeper'))
    t.ok(payload.includes('#555'))

    t.end()
  })

  tap.test('returns disabled for private repo with token', async (t) => {
    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/repo/private.svg?token=' + crypto.createHmac('sha256', 'badges-secret').update('repo/private').digest('hex')
    })

    t.is(statusCode, 200, 'statusCode')
    t.ok(payload.includes('disabled'))
    t.ok(payload.includes('Greenkeeper'))
    t.ok(payload.includes('#555'))

    t.end()
  })

  tap.test('returns disabled for disabled public repo', async (t) => {
    const {repositories} = await dbs()

    await repositories.post({
      type: 'repository',
      fullName: 'repo/public_disabled'
    })

    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/repo/public_disabled.svg'
    })

    t.is(statusCode, 200, 'statusCode')
    t.ok(payload.includes('disabled'))
    t.ok(payload.includes('Greenkeeper'))
    t.ok(payload.includes('#555'))

    t.end()
  })

  tap.test('returns enabled for enabled public repo', async (t) => {
    const {repositories} = await dbs()

    await repositories.post({
      type: 'repository',
      fullName: 'Repo/public_enabled',
      enabled: true
    })

    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/repo/public_enabled.svg'
    })

    t.is(statusCode, 200, 'statusCode')
    t.ok(payload.includes('enabled'))
    t.ok(payload.includes('Greenkeeper'))
    t.ok(payload.includes('#4c1'))

    t.end()
  })

  tap.test('returns payment required for private repo with token', async (t) => {
    const {repositories} = await dbs()

    await repositories.post({
      type: 'repository',
      fullName: 'repo/payprivate',
      private: true,
      enabled: true,
      accountId: '123123'
    })

    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/repo/payprivate.svg?token=' + crypto.createHmac('sha256', 'badges-secret').update('repo/payprivate').digest('hex')
    })

    t.is(statusCode, 200, 'statusCode')
    t.ok(payload.includes('payment required'))
    t.ok(payload.includes('Greenkeeper'))
    t.ok(payload.includes('#555'))

    t.end()
  })

  tap.test('returns enabled for paid private repo with token', async (t) => {
    const {repositories, payments} = await dbs()

    await repositories.post({
      _id: '123',
      type: 'repository',
      fullName: 'repo/payprivate2',
      private: true,
      enabled: true,
      accountId: '431413'
    })

    await payments.put({
      _id: '431413',
      plan: 'org'
    })

    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/repo/payprivate2.svg?token=' + crypto.createHmac('sha256', 'badges-secret').update('123').digest('hex')
    })

    t.is(statusCode, 200, 'statusCode')
    t.ok(payload.includes('enabled'))
    t.ok(payload.includes('Greenkeeper'))
    t.ok(payload.includes('#555'))

    t.end()
  })
})()
