import assert from 'node:assert/strict'
import test from 'node:test'
import { firebaseProdTarget } from './firebase-prod-target.js'

const production = {
  VITE_FIREBASE_API_KEY: 'production-fixture',
  VITE_FIREBASE_AUTH_DOMAIN: 'db-bpl-drehpunkt.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'db-bpl-drehpunkt',
  VITE_FIREBASE_STORAGE_BUCKET: 'db-bpl-drehpunkt.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '878536841109',
  VITE_FIREBASE_APP_ID: '1:878536841109:web:1234abcd',
  VITE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: 'production-app-check-fixture',
}

test('production build is tied to the production Firebase project and App Check', () => {
  assert.deepEqual(firebaseProdTarget(production, { GCLOUD_PROJECT: 'db-bpl-drehpunkt' }), {
    projectId: 'db-bpl-drehpunkt',
    appId: production.VITE_FIREBASE_APP_ID,
  })
  assert.throws(() => firebaseProdTarget(production, { GCLOUD_PROJECT: 'db-bpl-drehpunkt-dev' }), /Firebase-Deployziel/)
  assert.throws(() => firebaseProdTarget(production, { VITE_FIREBASE_PROJECT_ID: 'db-bpl-drehpunkt-dev' }), /Firebase-Webkonfiguration/)
  assert.throws(() => firebaseProdTarget({ ...production, VITE_FIREBASE_APP_ID: '1:333005945148:web:1234abcd' }), /Firebase-Webkonfiguration/)
  assert.throws(() => firebaseProdTarget(production, { VITE_FIREBASE_AUTH_DOMAIN: 'db-bpl-drehpunkt-dev.firebaseapp.com' }), /Firebase-Webkonfiguration/)
  assert.throws(() => firebaseProdTarget(production, { VITE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: '' }), /APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY fehlt/)
})
