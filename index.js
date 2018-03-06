global.Promise = require('bluebird')
Promise.config({
  longStackTraces: true
})

const hapi = require('hapi')
const StatsD = require('hot-shots')

const env = require('./lib/env')
require('./lib/rollbar')

;(async () => {
  const statsdClient = new StatsD({
    host: env.STATSD_HOST,
    prefix: 'badges.',
    globalTags: [env.NODE_ENV]
  })

  const server = new hapi.Server()
  server.connection({
    port: env.PORT
  })

  server.route({
    method: 'GET',
    path: '/',
    handler: (request, reply) => reply({ok: true})
  })

  await server.register([{
    register: require('./lib/badges')
  }, {
    register: require('good'),
    options: {
      reporters: {
        myConsoleReporter: [{
          module: 'good-squeeze',
          name: 'Squeeze',
          args: [{
            log: '*',
            response: '*'
          }]
        }, {
          module: 'good-console'
        },
        'stdout']
      }
    }
  }])

  server.on('response', (request, reply) => {
    statsdClient.increment(`status_code.${request.response.statusCode}`)
    statsdClient.timing('response_time', Date.now() - request.info.received)
  })

  await server.start()
  console.log('server running')
})()
