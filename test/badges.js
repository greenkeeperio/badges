const crypto = require('crypto')
const hapi = require('hapi')

const register = require('../lib/badges')
const dbs = require('../lib/dbs')

describe('badges', async () => {
  let server

  beforeEach(async () => {
    server = new hapi.Server()
    server.connection()
    await server.register({register})
  })

  test('returns not found for repo not in db', async () => {
    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/not/synced.svg'
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/not found/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
  })

  test('returns not found for private repo', async () => {
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

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/not found/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
  })

  test('returns disabled for private repo with token', async () => {
    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/repo/private.svg?token=' + crypto.createHmac('sha256', 'badges-secret').update('repo/private').digest('hex')
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/disabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
  })

  test('returns disabled for disabled public repo', async () => {
    const {repositories} = await dbs()

    await repositories.post({
      type: 'repository',
      fullName: 'repo/public_disabled'
    })

    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/repo/public_disabled.svg'
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/disabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
  })

  test('returns enabled for enabled public repo', async () => {
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

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#4c1/)
  })

  test('returns payment required for private repo with token', async () => {
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

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/payment required/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
  })

  test('returns enabled for paid private repo with token', async () => {
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

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
  })

  test('returns enabled for paid private repo with token on Gihub Marketplace Team Plan', async () => {
    const {repositories, payments} = await dbs()

    await repositories.post({
      _id: '1234',
      type: 'repository',
      fullName: 'repo/payprivate3',
      private: true,
      enabled: true,
      accountId: '431413431'
    })

    await payments.put({
      _id: '431413431',
      plan: 'team'
    })

    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/repo/payprivate3.svg?token=' + crypto.createHmac('sha256', 'badges-secret').update('1234').digest('hex')
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
  })

  test('returns enabled for paid private repo with token on Gihub Marketplace Business plan', async () => {
    const {repositories, payments} = await dbs()

    await repositories.post({
      _id: '12345',
      type: 'repository',
      fullName: 'repo/payprivate4',
      private: true,
      enabled: true,
      accountId: '431413432'
    })

    await payments.put({
      _id: '431413432',
      plan: 'business'
    })

    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: '/repo/payprivate4.svg?token=' + crypto.createHmac('sha256', 'badges-secret').update('12345').digest('hex')
    })
    console.log('payload', payload)

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
  })

  test('returns flat style as default style', async () => {
    const { repositories } = await dbs()

    await repositories.post({
      type: 'repository',
      fullName: 'Repo/public_enabled',
      enabled: true
    })

    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: '/repo/public_enabled.svg'
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
    expect(payload).toMatch(/#4c1/)
  })

  test('returns flat style if defined', async () => {
    const { repositories } = await dbs()

    await repositories.post({
      type: 'repository',
      fullName: 'Repo/public_enabled?style=flat',
      enabled: true
    })

    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: '/repo/public_enabled.svg'
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
    expect(payload).toMatch(/#4c1/)
  })

  test('returns flat style if style not supported', async () => {
    const { repositories } = await dbs()

    await repositories.post({
      type: 'repository',
      fullName: 'Repo/public_enabled?style=circle',
      enabled: true
    })

    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: '/repo/public_enabled.svg'
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
    expect(payload).toMatch(/#4c1/)
  })

  test('returns flat-square style', async () => {
    const { repositories } = await dbs()

    await repositories.post({
      type: 'repository',
      fullName: 'Repo/public_enabled',
      enabled: true
    })

    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: '/repo/public_enabled.svg?style=flat-square'
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
    expect(payload).toMatch(/#4c1/)
  })

  test('returns plastic style', async () => {
    const { repositories } = await dbs()

    await repositories.post({
      type: 'repository',
      fullName: 'Repo/public_enabled',
      enabled: true
    })

    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: '/repo/public_enabled.svg?style=plastic'
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
    expect(payload).toMatch(/#4c1/)
  })

  test('returns for-the-badge style', async () => {
    const { repositories } = await dbs()

    await repositories.post({
      type: 'repository',
      fullName: 'Repo/public_enabled',
      enabled: true
    })

    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: '/repo/public_enabled.svg?style=for-the-badge'
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
    expect(payload).toMatch(/#4c1/)
  })

  test('returns correct flat-square style even if used with other query', async () => {
    const { repositories, payments } = await dbs()

    await repositories.post({
      _id: '124',
      type: 'repository',
      fullName: 'repo/payprivate5',
      private: true,
      enabled: true,
      accountId: '431414'
    })

    await payments.put({
      _id: '431414',
      plan: 'team'
    })

    const {payload, statusCode} = await server.inject({
      method: 'GET',
      url: `/repo/payprivate5.svg?token=${crypto.createHmac('sha256', 'badges-secret').update('124').digest('hex')}&style=flat-square`
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/crispEdges/)
    expect(payload).toMatch(/#555/)
    expect(payload).toMatch(/#4c1/)
  })

  test('returns correct plastic style even if used with other query', async () => {
    const { repositories, payments } = await dbs()

    await repositories.post({
      _id: '1234567',
      type: 'repository',
      fullName: 'repo/payprivate6',
      private: true,
      enabled: true,
      accountId: '431413434'
    })

    await payments.put({
      _id: '431413434',
      plan: 'business'
    })

    const { payload, statusCode } = await server.inject({
      method: 'GET',
      url: `/repo/payprivate6.svg?token=${crypto.createHmac('sha256', 'badges-secret').update('1234567').digest('hex')}&style=plastic`
    })

    expect(statusCode).toBe(200)
    expect(payload).toMatch(/enabled/)
    expect(payload).toMatch(/Greenkeeper/)
    expect(payload).toMatch(/#555/)
    expect(payload).toMatch(/#4c1/)
  })
})
