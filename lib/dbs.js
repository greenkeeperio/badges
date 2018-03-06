const {resolve} = require('url')

global.Promise = require('bluebird')

const _ = require('lodash')
const bootstrap = require('couchdb-bootstrap')
const PouchDB = require('pouchdb-http').plugin(require('pouchdb-mapreduce'))
const {promisify} = require('bluebird')

const env = require('./env')

module.exports = _.memoize(async function () {
  const result = await promisify(bootstrap)(env.COUCH_URL, 'couchdb', {
    mapDbName: dbname => dbname + (env.isProduction ? '' : '-staging')
  })
  return _(result.push)
    .mapValues((v, name) => new PouchDB(resolve(env.COUCH_URL, name)))
    .mapKeys((v, name) => name.replace('-staging', ''))
    .value()
})
