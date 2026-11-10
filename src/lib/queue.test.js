import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { queueStamp, listQueue, syncQueue, cacheProfile, cacheWorkspace, readSnapshot, clearSnapshot, deferredPayload, archiveStamp, listArchived } from './queue.js'
import { permitted } from './access.js'
import { dateKey } from './dates.js'

const profile = permission => ({ active: true, permissions: { timeTracking: permission } })
const accepted = (revision = 1) => ({ accepted: true, revision })
test('offline stamps survive reads, remain scoped to UID, and disappear only after server acknowledgement', async () => {
  const event = { eventId: 'a', type: 'come', at: '2026-11-10T07:00:00Z', offline: true }
  await queueStamp('anna', event)
  await queueStamp('bert', event)
  assert.equal((await listQueue('anna')).length, 1)
  assert.equal((await listQueue('bert')).length, 1)
  await syncQueue('anna', async () => { throw new Error('Konflikt') }, () => true)
  assert.equal((await listQueue('anna'))[0].error, 'Konflikt')
  const sent = []
  await syncQueue('anna', async value => { sent.push(value); return accepted() }, () => true)
  assert.equal(sent[0].eventId, 'a')
  assert.equal((await listQueue('anna')).length, 0)
  assert.equal((await listQueue('bert')).length, 1)
})
test('failure preserves later stamps and offline sync never attempts delivery', async () => {
  await queueStamp('ordered', { eventId: 'b', type: 'go', at: '2026-11-10T16:00:00Z', offline: true })
  await queueStamp('ordered', { eventId: 'a', type: 'come', at: '2026-11-10T07:00:00Z', offline: true })
  let attempts = 0
  await syncQueue('ordered', async () => { attempts++; throw new Error('Konflikt') }, () => true)
  assert.equal(attempts, 1)
  assert.equal((await listQueue('ordered')).length, 2)
  await syncQueue('ordered', async () => { attempts++ }, () => false)
  assert.equal(attempts, 1)
})
test('local snapshots are isolated and can be cleared without removing unsent stamps', async () => {
  await cacheProfile('bert', profile('edit'))
  await cacheWorkspace('bert', { days: [] })
  assert.equal((await readSnapshot('bert')).profile.active, true)
  assert.equal(await readSnapshot('other'), undefined)
  await clearSnapshot('bert')
  assert.equal(await readSnapshot('bert'), undefined)
  assert.equal((await listQueue('bert')).length, 1)
})
test('delayed workspace responses keep the latest offline rights and cannot restore cleared data', async () => {
  const uid = 'revoked'
  const workspace = { days: [{ date: '2026-11-10' }] }
  await cacheProfile(uid, profile('edit'))
  await cacheWorkspace(uid, workspace)

  await Promise.all([cacheProfile(uid, profile('view')), cacheWorkspace(uid, workspace)])
  let cached = await readSnapshot(uid)
  assert.equal(permitted(cached.profile, 'timeTracking', true), false)
  assert.deepEqual(cached.workspace, workspace)

  await Promise.all([cacheProfile(uid, profile('none')), cacheWorkspace(uid, workspace)])
  cached = await readSnapshot(uid)
  assert.equal(permitted(cached.profile, 'timeTracking'), false)
  assert.equal(cached.workspace, null)

  await Promise.all([clearSnapshot(uid), cacheWorkspace(uid, workspace)])
  assert.equal(await readSnapshot(uid), undefined)
})

test('concurrent sync and an interrupted acknowledgement retry the same stamp only', async () => {
  const uid = 'lost-acknowledgement'
  const record = { eventId: 'come-1', type: 'come', at: '2026-11-10T07:00:00Z', offline: true }
  await queueStamp(uid, record)
  const committed = new Map()
  let calls = 0
  const send = async stamp => {
    calls++
    committed.set(stamp.eventId, stamp)
    if (calls === 1) throw new Error('Verbindung nach der Annahme abgebrochen')
    return accepted()
  }

  const first = syncQueue(uid, send, () => true)
  const concurrent = syncQueue(uid, send, () => true)
  assert.equal(first, concurrent)
  assert.deepEqual(await first, [])
  assert.equal(calls, 1)
  assert.equal((await listQueue(uid))[0].eventId, record.eventId)
  assert.deepEqual(await syncQueue(uid, send, () => true), [record.eventId])
  assert.deepEqual([...committed.values()], [record])
  assert.deepEqual(await listQueue(uid), [])
})

test('confirmed stamp survives a disconnected overview refresh and is discarded once the server snapshot catches up', async () => {
  const uid = 'confirmed-without-refresh'
  const at = new Date().toISOString()
  const date = dateKey(at)
  const stamp = { eventId: 'come-1', type: 'come', at, offline: true }
  const staleDay = { date, revision: 1, events: [] }
  await cacheProfile(uid, profile('edit'))
  await cacheWorkspace(uid, { days: [staleDay] })
  await queueStamp(uid, stamp)
  assert.deepEqual(await syncQueue(uid, async () => accepted(2), () => true), [stamp.eventId])

  const [confirmed] = await listQueue(uid)
  assert.ok(confirmed.acknowledgedAt)
  assert.equal(confirmed.acknowledgedRevision, 2)
  assert.equal(confirmed.at, at)
  assert.deepEqual((await readSnapshot(uid)).workspace.days, [staleDay])

  let deliveries = 0
  await syncQueue(uid, async () => { deliveries++; return accepted(2) }, () => true)
  assert.equal(deliveries, 0)
  await cacheWorkspace(uid, { days: [staleDay] })
  assert.equal((await listQueue(uid)).length, 1)
  const correctedDay = { date, revision: 3, events: [] }
  await cacheWorkspace(uid, { days: [correctedDay] })
  assert.deepEqual((await readSnapshot(uid)).workspace.days, [correctedDay])
  assert.deepEqual(await listQueue(uid), [])
})

test('revoking time access discards confirmed offline data and preserves unsent stamps', async () => {
  const uid = 'confirmed-revoked'
  const at = new Date().toISOString()
  await cacheProfile(uid, profile('edit'))
  await queueStamp(uid, { eventId: 'confirmed', type: 'come', at, offline: true })
  await syncQueue(uid, async () => accepted(), () => true)
  await queueStamp(uid, { eventId: 'unsent', type: 'go', at, offline: true })
  assert.equal((await listQueue(uid)).length, 2)
  await cacheProfile(uid, profile('none'))
  assert.deepEqual((await listQueue(uid)).map(event => event.eventId), ['unsent'])
})
test('deferred originally-online stamps retry as offline capture with same ID and instant', () => {
  const record = { eventId: 'deferred', type: 'come', at: '2026-11-10T07:00:00Z', offline: false }
  assert.equal(deferredPayload(record, Date.parse('2026-11-10T07:00:20Z')).offline, false)
  assert.deepEqual(deferredPayload(record, Date.parse('2026-11-10T07:10:00Z')), { ...record, offline: true })
})
test('a conflict blocks only its own day; explicit resolution archives original proof', async () => {
  await queueStamp('conflict-days', { eventId: 'bad', type: 'come', at: '2026-11-09T07:00:00Z', offline: true })
  await queueStamp('conflict-days', { eventId: 'later', type: 'go', at: '2026-11-09T16:00:00Z', offline: true })
  await queueStamp('conflict-days', { eventId: 'next-day', type: 'come', at: '2026-11-10T07:00:00Z', offline: true })
  const sent = []
  await syncQueue('conflict-days', async event => { sent.push(event.eventId); if (event.eventId === 'bad') throw new Error('Konflikt'); return accepted() }, () => true)
  assert.deepEqual(sent, ['bad', 'next-day'])
  assert.equal((await listQueue('conflict-days')).length, 2)
  await archiveStamp('conflict-days', 'bad')
  assert.deepEqual((await listQueue('conflict-days')).map(item => item.eventId), ['later'])
  const proof = (await listArchived('conflict-days'))[0]
  assert.equal(proof.eventId, 'bad'); assert.equal(proof.at, '2026-11-09T07:00:00Z'); assert.equal(proof.resolution, 'confirmed_resolved_in_web')
})
