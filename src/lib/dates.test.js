import test from 'node:test'
import assert from 'node:assert/strict'
import { dateKey, weekStart, canCorrectDate, berlinInstant, minutes } from './dates.js'
test('Berlin dates and correction window include midnight and seven prior calendar days', () => {
  assert.equal(dateKey('2026-11-09T23:15:00Z'), '2026-11-10')
  assert.equal(weekStart('2026-11-15'), '2026-11-09')
  assert.equal(canCorrectDate('2026-11-03', '2026-11-10'), true)
  assert.equal(canCorrectDate('2026-11-02', '2026-11-10'), false)
  assert.equal(canCorrectDate('2026-11-11', '2026-11-10'), false)
})
test('corrections use Berlin timezone and reject ambiguous or nonexistent DST clock times', () => {
  assert.equal(berlinInstant('2026-11-10', '08:00'), '2026-11-10T07:00:00.000Z')
  assert.throws(() => berlinInstant('2026-03-29', '02:30'))
  assert.throws(() => berlinInstant('2026-10-25', '02:30'))
  assert.equal(minutes(-95, true), '−01:35')
})
