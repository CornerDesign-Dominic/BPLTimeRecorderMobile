import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import Vacation from './Vacation.jsx'
import { addDays, dateKey } from '../lib/dates.js'
const today = dateKey(), year = Number(today.slice(0, 4))
const request = (id, startDate, endDate, days, extra = {}) => ({ id, startDate, endDate, days, vacationType: 'normal', status: 'approved', userId: 'user-a', ...extra })
const entries = [
  request('past', `${year}-01-05`, `${year}-01-09`, 5),
  request('future', `${year}-12-01`, `${year}-12-03`, 3),
  request('pending', `${year}-12-10`, `${year}-12-11`, 2, { status: 'pending' }),
  request('previous', `${year - 1}-07-01`, `${year - 1}-07-03`, 3),
  request('child', `${year}-12-01`, `${year}-12-04`, 4, { status: 'change_requested', requestStatus: 'pending', vacationId: 'future', originalRequestId: 'future', changeRequest: {} }),
  request('foreign', `${year}-12-01`, `${year}-12-31`, 30, { userId: 'other' }),
]
const response = { profile: { annualVacationEntitlement: 30, vacationTrackingStartYear: year }, requests: entries, history: [], holidays: [{ id: 'holiday', name: 'Testfeiertag', date: addDays(today, 1) }], blocks: [{ id: 'block', label: 'Inventur', startDate: addDays(today, 2), endDate: addDays(today, 3) }] }
let saved
let calls = []
globalThis.mobileUiApi = async (name, payload, uid) => { calls.push({ name, payload, uid }); return response }
globalThis.mobileUiVacationSave = async (...args) => { saved = args }
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const click = async node => { assert.ok(node); await act(async () => node.click()) }
const byText = text => [...host.querySelectorAll('button')].find(button => button.textContent === text)
const change = async (node, value) => { await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new Event('change', { bubbles: true })) }) }
await act(async () => root.render(<Vacation uid="user-a" online editable/>))
assert.equal(host.querySelectorAll('.vacation-summary-tile').length, 4)
assert.equal(host.querySelector('.vacation-summary select'), null)
assert.deepEqual([...host.querySelectorAll('.vacation-summary-tile strong')].map(node => node.textContent), ['30 Tage', '5 Tage', '3 Tage', '22 Tage'])
assert.equal(host.querySelectorAll('.request-list>button').length, 3)
assert.equal(host.querySelector('.vacation-calendar-list'), null)
const yearSelect = host.querySelectorAll('.vacation-list-filters select')[0]
const filterSelect = host.querySelectorAll('.vacation-list-filters select')[1]
await change(filterSelect, 'pending')
assert.equal(host.querySelectorAll('.request-list>button').length, 2)
assert.ok(host.querySelector('.request-list').textContent.includes('Folgeantrag offen'))
await change(filterSelect, 'past')
assert.equal(host.querySelectorAll('.request-list>button').length, 1)
await change(filterSelect, 'all')
await change(yearSelect, String(year - 1))
assert.equal(host.querySelectorAll('.request-list>button').length, 1)
assert.ok(host.querySelector('.request-list').textContent.includes(`${year - 1}`))
assert.equal(host.querySelector('.vacation-summary-tile strong').textContent, '30 Tage', 'list year must not change current-year totals')
await change(yearSelect, String(year + 1))
assert.ok(host.textContent.includes('Keine Anträge für diese Auswahl.'))
await click(byText(' Feiertage & Urlaubssperren'))
assert.equal(host.querySelectorAll('.vacation-calendar-list li').length, 2)
const calendarRow = host.querySelector('.vacation-calendar-list li')
assert.ok(calendarRow.querySelector('div').textContent.includes('TestfeiertagFeiertag'))
assert.equal(calendarRow.querySelector('small'), null)
await click(host.querySelector('[aria-label="Schließen"]'))
assert.equal(host.querySelector('[role=dialog]'), null)
await click(byText('Urlaub beantragen'))
assert.equal(host.querySelector('[role=dialog]').getAttribute('aria-label'), 'Urlaub beantragen')
assert.equal(host.querySelectorAll('input[type=date]').length, 2)
await act(async () => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
assert.equal(saved[0], 'user-a')
assert.equal(saved[3], 'new')
assert.equal(host.querySelector('[role=dialog]'), null)
assert.ok(calls.every(call => call.name === 'getOwnMobileVacation' && call.uid === 'user-a'))
await act(async () => root.render(<Vacation uid="user-a" online editable={false}/>))
assert.equal(byText('Urlaub beantragen'), undefined)
await act(async () => root.render(<Vacation uid="user-a" online={false} editable/>))
assert.ok(host.textContent.includes('nur mit Internet'))
assert.equal(host.querySelector('.vacation-summary'), null)
await act(async () => root.unmount()); host.remove()
console.log('Mobile vacation UI: four current-year metrics, separate list year/filters, pending follow-ups, compact calendar modal, existing request form and own-user scope verified.')
