'use strict'

const { join } = require('path')
const { spawnSync } = require('child_process')
const { test } = require('node:test')

test('syslog pino transport test stdout', t => {
  const result = spawnSync('node', ['--no-warnings', join(__dirname, 'fixtures', 'log-stdout.js'), '1'], {
    cwd: process.cwd()
  })
  t.assert.strictEqual(result.stdout.toString().trim(), '<134>1 2016-04-01T16:44:58Z MacBook-Pro-3 - 94473 - - hello world')
  t.assert.strictEqual(result.status, 0)
})

test('syslog pino transport test stderr', t => {
  const result = spawnSync('node', ['--no-warnings', join(__dirname, 'fixtures', 'log-stdout.js'), '2'], {
    cwd: process.cwd()
  })
  t.assert.strictEqual(result.stderr.toString().trim(), '<134>1 2016-04-01T16:44:58Z MacBook-Pro-3 - 94473 - - hello world')
  t.assert.strictEqual(result.status, 0)
})
