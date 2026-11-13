import assert from 'node:assert/strict'
import test from 'node:test'
import { bookingEditPayload } from './bookingEdit.js'
const today = '2026-11-13'
const first = { id: 'come', type: 'come', at: '2026-11-13T07:00:37.000Z' }
const last = { id: 'go', type: 'go', at: '2026-11-13T16:00:23.000Z' }
const day = { date: today, revision: 7, events: [first, last] }
const values = { id: 'new', type: 'come', time: '09:00', reason: 'wrong_booking', note: 'Uhrzeit korrigiert' }
test('single edit preserves every other event and the day revision', () => {
  const payload = bookingEditPayload(day, first.id, values, { today })
  assert.deepEqual(payload.events[1], last)
  assert.equal(payload.events[0].id, first.id)
  assert.equal(payload.events[0].at, '2026-11-13T08:00:00.000Z')
  assert.equal(payload.expectedRevision, 7)
  assert.equal(payload.reason, values.reason)
  assert.equal(first.at, '2026-11-13T07:00:37.000Z')
})
test('unchanged clock minutes preserve original seconds; addition and deletion affect only one ID', () => {
  const unchanged = bookingEditPayload(day, first.id, { ...values, time: '08:00', type: 'pause_start' }, { today })
  assert.equal(unchanged.events[0].at, first.at)
  const added = bookingEditPayload(day, null, { ...values, type: 'pause_start', time: '12:00' }, { today })
  assert.deepEqual(added.events.slice(0, 2), [first, last])
  assert.equal(added.events[2].id, 'new')
  const deleted = bookingEditPayload(day, first.id, values, { deleting: true, today })
  assert.deepEqual(deleted.events, [last])
})
test('each edit needs a reason and a live event; editing window includes seven previous Berlin dates', () => {
  assert.throws(() => bookingEditPayload(day, first.id, { ...values, reason: '' }, { today }))
  assert.throws(() => bookingEditPayload(day, 'missing', values, { today }))
  assert.doesNotThrow(() => bookingEditPayload({ ...day, date: '2026-11-06' }, first.id, values, { deleting: true, today }))
  for (const date of ['2026-11-05', '2026-11-14']) assert.throws(() => bookingEditPayload({ ...day, date }, first.id, values, { today }))
})
