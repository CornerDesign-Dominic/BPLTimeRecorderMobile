import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateVacationYearBalance } from './vacationBalance.js'
test('approved change requests do not double count the already updated main vacation', () => {
  const original = { id: 'main', status: 'approved', vacationType: 'normal', startDate: '2026-11-10', endDate: '2026-11-13', days: 4 }
  const change = { ...original, id: 'change', originalRequestId: 'main', vacationId: 'main', changeRequest: { originalDays: 3 } }
  const balance = calculateVacationYearBalance({ annualVacationEntitlement: 30, vacationTrackingStartYear: 2026, entries: [original, change], year: 2026 })
  assert.equal(balance.takenDays, 4); assert.equal(balance.remainingDays, 26)
})
