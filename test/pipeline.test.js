'use strict'

const os = require('node:os')
const { join } = require('node:path')
const { once } = require('node:events')
const { test } = require('node:test')
const { createTcpListener } = require('pino-socket/test/utils')
const pino = require('pino')

const pinoSyslog = join(__dirname, '..', 'lib', 'transport.js')

const messages = require(join(__dirname, 'fixtures', 'messages'))

function getConfigPath () {
  const cpath = join.apply(null, [__dirname, 'fixtures', 'configs'].concat(Array.from(arguments)))
  return require(cpath)
}

test('pino pipeline', async (t) => {
  const destination = join(os.tmpdir(), 'pino-transport-test-pipeline.log')

  const expected = [
    '<134>1 2018-02-03T01:20:00Z MacBook-Pro-3 - 94473 - - ',
    '<134>1 2018-02-10T01:20:00Z MacBook-Pro-3 - 94473 - - '
  ]

  let resolveTest
  let rejectTest
  const testPromise = new Promise((resolve, reject) => {
    resolveTest = resolve
    rejectTest = reject
  })

  const serverSocket = await createTcpListener(msg => {
    try {
      msg.split('\n')
        .filter(line => line) // skip empty lines
        .forEach(line => {
          const exp = expected.shift()
          t.assert.ok(line.startsWith(exp))
        })

      if (expected.length === 0) {
        resolveTest()
      }
    } catch (err) {
      rejectTest(err)
    }
  })

  const address = serverSocket.address().address
  const port = serverSocket.address().port

  const transport = pino.transport({
    pipeline: [
      {
        target: pinoSyslog,
        level: 'info',
        options: {
          ...getConfigPath('5424', 'newline.json')
        }
      },
      {
        target: 'pino-socket',
        options: {
          mode: 'tcp',
          address,
          port
        }
      }
    ]
  })

  t.after(() => {
    serverSocket.close()
    serverSocket.unref()
    transport.end()
  })

  const log = pino(transport)
  t.assert.ok(true, 'built pino')

  await once(transport, 'ready')
  t.assert.ok(true, 'transport ready ' + destination)

  log.info(JSON.parse(messages.leadingDay))
  log.debug(JSON.parse(messages.helloWorld)) // it is skipped
  log.info(JSON.parse(messages.trailingDay))

  await testPromise
})
