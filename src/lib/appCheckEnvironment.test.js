import assert from 'node:assert/strict'
import test from 'node:test'
import { useLocalAppCheckDebug } from './appCheckEnvironment.js'

test('local development project permits debug attestation in dev and built previews', () => {
  for (const hostname of ['localhost', '127.0.0.1', '::1', '[::1]']) {
    assert.equal(useLocalAppCheckDebug('db-bpl-drehpunkt-dev', hostname), true)
  }
})

test('production projects and remote or lookalike hosts never enable debug attestation', () => {
  for (const projectId of ['db-bpl-drehpunkt', '', undefined, 'other-dev']) {
    assert.equal(useLocalAppCheckDebug(projectId, 'localhost'), false)
  }
  for (const hostname of ['', undefined, 'dev.drehpunktlogistik.de', 'localhost.example.com', '127.0.0.1.example.com', '192.168.1.2', '127.0.0.2']) {
    assert.equal(useLocalAppCheckDebug('db-bpl-drehpunkt-dev', hostname), false)
  }
})
