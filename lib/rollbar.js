const {resolve} = require('path')

const rollbar = require('rollbar')

const env = require('./env')
const pkg = require('../package.json')

const enabled = env.NODE_ENV !== 'development'

module.exports = rollbar

rollbar.init(env.ROLLBAR_TOKEN_BADGES, {
  branch: 'master',
  codeVersion: `v${pkg.version}`,
  environment: env.NODE_ENV,
  root: resolve(__dirname, '../'),
  enabled
})

if (enabled) {
  rollbar.handleUncaughtExceptions(env.ROLLBAR_TOKEN_BADGES, {
    exitOnUncaughtException: true
  })

  rollbar.handleUnhandledRejections(env.ROLLBAR_TOKEN_BADGES)
}
