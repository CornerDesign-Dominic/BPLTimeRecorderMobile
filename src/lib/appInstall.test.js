import assert from 'node:assert/strict'
import test from 'node:test'
import { installationPlatform, isStandalone, requestInstallation } from './appInstall.js'

test('installation guidance recognizes iPhone, iPad desktop mode and Android without mistaking touch PCs', () => {
  assert.equal(installationPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), 'ios')
  assert.equal(installationPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', maxTouchPoints: 5 }), 'ios')
  assert.equal(installationPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 15)' }), 'android')
  assert.equal(installationPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)', maxTouchPoints: 10 }), 'desktop')
  assert.equal(installationPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', maxTouchPoints: 0 }), 'desktop')
})

test('only browser standalone signals confirm installation', () => {
  assert.equal(isStandalone(false, false), false)
  assert.equal(isStandalone(true, false), true)
  assert.equal(isStandalone(false, true), true)
  assert.equal(isStandalone('true', undefined), false)
})

test('accepted install request does not claim installed; dismissed request remains dismissed', async () => {
  let prompts = 0
  const accepted = { prompt: async () => { prompts++ }, userChoice: Promise.resolve({ outcome: 'accepted' }) }
  assert.equal(await requestInstallation(accepted), 'requested')
  assert.equal(prompts, 1)
  assert.equal(await requestInstallation({ prompt: async () => ({ outcome: 'dismissed' }) }), 'dismissed')
  await assert.rejects(requestInstallation(null))
})
