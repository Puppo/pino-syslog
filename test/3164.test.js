'use strict'

const path = require('node:path')
const spawn = require('node:child_process').spawn
const { test } = require('node:test')
const { join } = path
const os = require('node:os')
const fs = require('node:fs')
const pino = require('pino')
const { once } = require('node:events')

const { promisify } = require('node:util')
const timeout = promisify(setTimeout)

const messages = require(path.join(__dirname, 'fixtures', 'messages'))
const psyslogPath = path.join(path.resolve(__dirname, '..', 'psyslog'))

function configPath () {
  return path.join.apply(null, [__dirname, 'fixtures', 'configs'].concat(Array.from(arguments)))
}

test('skips non-json input', async (t) => {
  t.plan(1)
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

test('returns error for overly long rfc3164 messages', async (t) => {
  t.plan(1)
  const expected = '<134>Apr  1 16:44:58 MacBook-Pro-3 none[94473]: @cee: {"level":30,"time":1459529098958,"msg":"message exceeded syslog 1024 byte limit","originalSize":1110}'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'cee.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.stupidLong + '\n')

  await promise
})

test('formats to message only', async (t) => {
  t.plan(1)
  const expected = '<134>Apr  1 16:44:58 MacBook-Pro-3 none[94473]: hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'messageOnly.json')])

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
  t.plan(1)
  const expected = '<134>Apr  1 16:44:58 MacBook-Pro-3 test[94473]: hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'appname.json')])

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
  t.plan(1)
  const expected = '<6>Apr  1 16:44:58 MacBook-Pro-3 none[94473]: hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'facility.json')])

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

test('format timestamp with leading zero in days', async (t) => {
  t.plan(1)
  const expected = '<134>Feb  3 02:20:00 MacBook-Pro-3 none[94473]: hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'date.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.leadingDay + '\n')

  await promise
})

test('format timestamp with trailing zero in days', async (t) => {
  t.plan(1)
  const expected = '<134>Feb 10 02:20:00 MacBook-Pro-3 none[94473]: hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'date.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.trailingDay + '\n')

  await promise
})

test('sets timezone', async (t) => {
  t.plan(1)
  const expected = '<134>Apr  1 12:44:58 MacBook-Pro-3 none[94473]: hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'tz.json')])

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
  t.plan(1)
  const header = '<134>Apr  1 16:44:58 MacBook-Pro-3 none[94473]: @cee: '
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'cee.json')])

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
  t.plan(1)
  const expected = '<134>Apr  1 16:44:58 MacBook-Pro-3 none[94473]: hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'ceeMessageOnly.json')])

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

test('truncates overly long message only log', async (t) => {
  t.plan(1)
  const expected = '<134>Apr  1 16:44:58 MacBook-Pro-3 none[94473]: ' + JSON.parse(messages.stupidLong).msg.substr(0, 976)
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'messageOnly.json')])

  const promise = new Promise((resolve) => {
    psyslog.stdout.on('data', (data) => {
      const msg = data.toString()
      t.assert.strictEqual(msg, expected)
      psyslog.kill()
      resolve()
    })
  })

  psyslog.stdin.write(messages.stupidLong + '\n')

  await promise
})

test('appends newline', async (t) => {
  t.plan(1)
  const expected = '<134>Apr  1 16:44:58 MacBook-Pro-3 none[94473]: ' + messages.helloWorld + '\n'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'newline.json')])

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
  t.plan(1)
  const expected = '<134>Apr  1 16:44:58 MacBook-Pro-3 none[94473]: ' + messages.helloWorld
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'sync.json')])

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
  t.plan(1)
  const expected = '<134>Apr  1 16:44:58 MacBook-Pro-3 test[94473]: hello world'
  const psyslog = spawn('node', [psyslogPath, '-c', configPath('3164', 'appname.json')])

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

test('syslog pino transport test rfc3164', { only: true }, async t => {
  const destination = join(os.tmpdir(), 'pino-transport-test-3164.log')

  const fd = fs.openSync(destination, 'w+')
  const sysLogOptions = {
    destination: fd,
    enablePipelining: false,
    ...getConfigPath('3164', 'newline.json')
  }

  const transport = pino.transport({
    target: pinoSyslog,
    level: 'info',
    options: sysLogOptions
  })
  const log = pino(transport)
  t.assert.ok('built pino')
  await once(transport, 'ready')
  t.assert.ok('transport ready ' + destination)

  log.info(JSON.parse(messages.leadingDay))
  log.debug(JSON.parse(messages.helloWorld)) // it is skipped
  log.info(JSON.parse(messages.trailingDay))

  await timeout(1000)

  const data = fs.readFileSync(destination, 'utf8').trim().split('\n')
  t.assert.ok(data[0].startsWith('<134>Feb  3 01:20:00 MacBook-Pro-3 none[94473]: '), true, 'first line leadingDay')
  t.assert.ok(data[1].startsWith('<134>Feb 10 01:20:00 MacBook-Pro-3 none[94473]: '), true, 'first line trailingDay')
})
