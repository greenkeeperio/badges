const envalid = require('envalid')
const {str, num, url} = envalid

module.exports = envalid.cleanEnv(process.env, {
  PORT: num({default: 8000}),
  NODE_ENV: str({choices: ['development', 'staging', 'production'], devDefault: 'development'}),
  ROLLBAR_TOKEN_BADGES: str({devDefault: ''}),
  STATSD_HOST: str({default: '172.17.0.1'}),
  COUCH_URL: url({devDefault: 'http://localhost:5984/'}),
  BADGES_SECRET: str({devDefault: 'badges-secret'})
})
