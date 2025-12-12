'use strict'

const path = require('path')
const spawn = require('child_process').spawn
const { test } = require('node:test')
const os = require('os')
const fs = require('fs')
const pino = require('pino')
const { once } = require('events')

const join = path.join
const { promisify } = require('util')
const timeout = promisify(setTimeout)

const messages = require(path.join(__dirname, 'fixtures', 'messages'))
const psyslogPath = path.join(path.resolve(__dirname, '..', 'psyslog'))

function configPath () {
  return path.join.apply(null, [__dirname, 'fixtures', 'configs'].concat(Array.from(arguments)))
}

test('skips non-json input', async (t) => {
  const psyslog = spawn('node', [psyslogPath])

  psyslog.stdout.on('data', (data) => {
    t.assert.fail('should not receive any data')
  })

  const promise = new Promise((resolve) => {
    psyslog.on('close', (code) => {
      t.assert.strictEqual(code, 0)
      resolve()
    })
  })

  psyslog.stdin.end('this is not json\n')

  await promise
})

test('hello world', async (t) => {
  const header = '<134>1 2016-04-01T16:44:58Z MacBook-Pro-3 - 94473 - - '
  const psyslog = spawn('node', [psyslogPath])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, header + messages.helloWorld)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.helloWorld + '\n')

  await promise
})

test('formats to message only', async (t) => {
  const expected = '<134>1 2016-04-01T16:44:58Z MacBook-Pro-3 - 94473 - - hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('5424', 'messageOnly.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.helloWorld + '\n')

  await promise
})

test('sets application name', async (t) => {
  const expected = '<134>1 2016-04-01T16:44:58Z MacBook-Pro-3 test 94473 - - hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('5424', 'appname.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.helloWorld + '\n')

  await promise
})

test('sets facility', async (t) => {
  const expected = '<6>1 2016-04-01T16:44:58Z MacBook-Pro-3 - 94473 - - hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('5424', 'facility.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.helloWorld + '\n')

  await promise
})

test('sets timezone', async (t) => {
  const expected = '<134>1 2016-04-01T12:44:58-04:00 MacBook-Pro-3 - 94473 - - hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('5424', 'tz.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.helloWorld + '\n')

  await promise
})

test('prepends `@cee `', async (t) => {
  const header = '<134>1 2016-04-01T16:44:58Z MacBook-Pro-3 - 94473 - - @cee: '
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('5424', 'cee.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, header + messages.helloWorld)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.helloWorld + '\n')

  await promise
})

test('does not prepend `@cee ` for non-json messages', async (t) => {
  const expected = '<134>1 2016-04-01T16:44:58Z MacBook-Pro-3 - 94473 - - hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('5424', 'ceeMessageOnly.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.helloWorld + '\n')

  await promise
})

test('appends newline', async (t) => {
  const expected = '<134>1 2016-04-01T16:44:58Z MacBook-Pro-3 - 94473 - - ' + messages.helloWorld + '\n'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('5424', 'newline.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.helloWorld + '\n')

  await promise
})

test('write synchronously', async (t) => {
  const expected = '<134>1 2016-04-01T16:44:58Z MacBook-Pro-3 - 94473 - - ' + messages.helloWorld
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('5424', 'sync.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.helloWorld + '\n')

  await promise
})

test('uses structured data', async (t) => {
  const expected = '<134>1 2016-04-01T16:44:58Z MacBook-Pro-3 - 94473 - [a@b x="y"] ' + messages.helloWorld
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('5424', 'structuredData.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.helloWorld + '\n')

  await promise
})

test('sets customLevels', async (t) => {
  const expected = '<134>1 2016-04-01T16:44:58Z MacBook-Pro-3 test 94473 - - hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('5424', 'custom-level.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.helloWorld + '\n')

  await promise
})

function getConfigPath () {
  const cpath = join.apply(null, [__dirname, 'fixtures', 'configs'].concat(Array.from(arguments)))
  return require(cpath)
}

const pinoSyslog = join(__dirname, '..', 'lib', 'transport.js')

test('syslog pino transport test rfc5424', async t => {
  const destination = join(os.tmpdir(), 'pino-transport-test-5424.log')

  const fd = fs.openSync(destination, 'w+')
  const sysLogOptions = {
    destination: fd,
    enablePipelining: false,
    ...getConfigPath('5424', 'newline.json')
  }

  const transport = pino.transport({
    target: pinoSyslog,
    level: 'info',
    options: sysLogOptions
  })
  const log = pino(transport)
  // t.pass('built pino')
  await once(transport, 'ready')
  // t.pass('transport ready ' + destination)

  log.info(JSON.parse(messages.leadingDay))
  log.debug(JSON.parse(messages.helloWorld)) // it is skipped
  log.info(JSON.parse(messages.trailingDay))

  await timeout(1000)

  const data = fs.readFileSync(destination, 'utf8').trim().split('\n')
  t.assert.ok(data[0].startsWith('<134>1 2018-02-03T01:20:00Z MacBook-Pro-3 - 94473 - - '), 'first line leadingDay')
  t.assert.ok(data[1].startsWith('<134>1 2018-02-10T01:20:00Z MacBook-Pro-3 - 94473 - - '), 'first line trailingDay')
})
