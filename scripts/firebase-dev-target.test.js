import assert from 'node:assert/strict'
import test from 'node:test'
import { firebaseDevTarget } from './firebase-dev-target.js'

const dev = { VITE_FIREBASE_PROJECT_ID: 'db-bpl-drehpunkt-dev', VITE_FIREBASE_APP_ID: 'dev-app' }
test('Dev build uses the same environment precedence as Vite', () => {
  assert.deepEqual(firebaseDevTarget(dev), { projectId: 'db-bpl-drehpunkt-dev', appId: 'dev-app' })
  assert.deepEqual(firebaseDevTarget({ VITE_FIREBASE_PROJECT_ID: 'db-bpl-drehpunkt', VITE_FIREBASE_APP_ID: 'old-app' }, dev), { projectId: 'db-bpl-drehpunkt-dev', appId: 'dev-app' })
})
test('Dev build refuses production, missing, unknown and process-overridden targets', () => {
  for (const projectId of ['db-bpl-drehpunkt', '', undefined, 'another-project']) {
    assert.throws(() => firebaseDevTarget({ ...dev, VITE_FIREBASE_PROJECT_ID: projectId }), /Dev-Build abgebrochen/)
  }
  assert.throws(() => firebaseDevTarget(dev, { VITE_FIREBASE_PROJECT_ID: 'db-bpl-drehpunkt' }), /Dev-Build abgebrochen/)
  assert.throws(() => firebaseDevTarget(dev, { VITE_FIREBASE_PROJECT_ID: '' }), /Dev-Build abgebrochen/)
  assert.throws(() => firebaseDevTarget({ ...dev, VITE_FIREBASE_APP_ID: '' }), /APP_ID fehlt/)
})
