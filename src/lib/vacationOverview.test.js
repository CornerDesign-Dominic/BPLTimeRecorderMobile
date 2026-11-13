import test from 'node:test'
import assert from 'node:assert/strict'
import { vacationOverview } from './vacationBalance.js'
import { filterVacationRequests } from './vacationFilters.js'
const today = '2026-11-13'
const normal = (id, startDate, endDate, days, extra = {}) => ({ id, startDate, endDate, days, vacationType: 'normal', status: 'approved', ...extra })
const entries = [
  normal('past', '2026-01-05', '2026-01-09', 5),
  normal('future', '2026-12-01', '2026-12-03', 3),
  normal('running', '2026-11-12', '2026-11-16', 2),
  normal('pending', '2026-12-10', '2026-12-11', 2, { status: 'pending' }),
  normal('manual', '2026-02-01', '2026-02-01', 1, { status: 'manual', hrManualEntry: true }),
  normal('overtime', '2026-12-14', '2026-12-14', 1, { vacationType: 'overtime' }),
  normal('rejected', '2026-12-15', '2026-12-15', 1, { status: 'rejected' }),
  normal('child', '2026-12-01', '2026-12-04', 4, { vacationId: 'future', originalRequestId: 'future', changeRequest: {}, status: 'change_requested', requestStatus: 'pending' }),
]
test('four current-year values reconcile and exclude pending, rejected, overtime and child requests', () => {
  const overview = vacationOverview({ annualVacationEntitlement: 30, vacationTrackingStartYear: 2026, entries, year: 2026, today })
  assert.deepEqual(overview, { budgetDays: 30, completedDays: 6, plannedDays: 5, remainingDays: 19 })
  const adjusted = vacationOverview({ annualVacationEntitlement: 30, vacationTrackingStartYear: 2026, entries: [...entries, { isManual: true, status: 'manual', startDate: today, endDate: today, days: 2 }], year: 2026, today })
  assert.equal(adjusted.budgetDays, 32)
  assert.equal(adjusted.remainingDays, 21)
  const unknown = vacationOverview({ entries, year: 2026, today })
  assert.equal(unknown.budgetDays, null)
  assert.equal(unknown.remainingDays, null)
})
test('list filters retain open follow-up requests, completed and planned records without duplicate children', () => {
  const ids = filter => filterVacationRequests(entries, { year: 2026, filter, today }).map(item => item.id)
  assert.deepEqual(ids('pending'), ['pending', 'future'])
  assert.deepEqual(ids('past'), ['manual', 'past'])
  assert.deepEqual(ids('upcoming'), ['overtime', 'future', 'running'])
  assert.deepEqual(ids('closed'), ['rejected'])
  assert.ok(!ids('all').includes('child'))
})
test('year filter includes overlapping periods and excludes all other years', () => {
  const requests = [...entries, normal('previous', '2025-07-01', '2025-07-03', 3), normal('overlap', '2025-12-30', '2026-01-02', 2)]
  assert.deepEqual(filterVacationRequests(requests, { year: 2025, today }).map(item => item.id), ['overlap', 'previous'])
  assert.equal(filterVacationRequests(requests, { year: 2027, today }).length, 0)
})
