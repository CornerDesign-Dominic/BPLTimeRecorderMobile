import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import TimeOverview from './TimeOverview.jsx'
import { Correction } from './Correction.jsx'
import { addDays, dateKey, formatTime } from '../lib/dates.js'
const today = dateKey()
const come = { id: 'come', type: 'come', at: `${today}T07:00:37.000Z` }
const go = { id: 'go', type: 'go', at: `${today}T16:00:23.000Z` }
const makeDay = date => ({ date, revision: 3, events: [{ ...come, at: `${date}T07:00:37.000Z` }, { ...go, at: `${date}T16:00:23.000Z` }], creditedMinutes: 480, targetMinutes: 480, bookedBreakMinutes: 30, balanceMinutes: 0 })
const day = makeDay(today)
const workspace = { days: [day], balanceMinutes: -95, loadedAt: 'snapshot-1' }
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const click = async node => { assert.ok(node, 'button exists'); await act(async () => { node.click() }) }
const byLabel = label => host.querySelector(`[aria-label="${label}"]`)
const byText = text => [...host.querySelectorAll('button')].find(button => button.textContent === text)
const render = async node => { await act(async () => root.render(node)) }
const submit = async () => { await act(async () => { host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
const select = async (node, value) => { await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new Event('change', { bubbles: true })) }) }
const chooseReason = () => select(host.querySelectorAll('select')[host.querySelectorAll('select').length - 1], 'wrong_booking')
let selected
let calls = []
globalThis.mobileUiApi = async (name, payload, uid) => { calls.push({ name, payload, uid }); return { days: [makeDay(payload.from)] } }
const overview = (extra = {}) => <TimeOverview uid="user-a" workspace={workspace} queue={[]} today={today} online editable onEdit={(d, e) => { selected = { day: d, event: e } }} {...extra}/>
await render(overview())
assert.equal(host.querySelectorAll('.compact-bookings li').length, 2)
assert.deepEqual([...host.querySelectorAll('.compact-bookings time')].map(time => time.textContent), [formatTime(come.at), formatTime(go.at)])
assert.equal(byLabel('Nächster Tag').disabled, true)
await click(host.querySelector('.compact-bookings button'))
assert.equal(selected.event.id, 'come')
await click(byText('+ Buchung hinzufügen'))
assert.equal(selected.event, null)
for (let i = 0; i < 7; i++) await click(byLabel('Vorheriger Tag'))
assert.equal(host.querySelectorAll('.compact-bookings button').length, 2, 'seventh prior day editable')
await click(byLabel('Vorheriger Tag'))
assert.ok(host.textContent.includes('Ältere Buchungen können nur angesehen werden.'))
assert.equal(host.querySelectorAll('.compact-bookings button').length, 0)
assert.equal(byText('+ Buchung hinzufügen'), undefined)
assert.ok(calls.every(call => call.name === 'listTimeWorkspace' && call.payload.ownOnly && call.uid === 'user-a'))
await click(byText('Heute'))
assert.equal(byLabel('Nächster Tag').disabled, true)
await click(byText('Woche'))
assert.equal(host.querySelectorAll('.chart-column').length, 7)
assert.ok(host.querySelector('.bar-break'))
assert.equal(host.querySelectorAll('.compact-bookings, table').length, 0)
await click(byText('Gesamt'))
assert.ok(host.textContent.includes('−01:35'))
assert.ok(host.textContent.includes('im Minus'))
assert.equal(host.querySelectorAll('.compact-bookings, table, .week-chart').length, 0)
await act(async () => { byText('Gesamt').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })) })
assert.equal(host.querySelector('[role=tab][aria-selected=true]').textContent, 'Heute')
await render(overview({ online: false }))
assert.equal(host.querySelectorAll('.compact-bookings button').length, 0)
assert.equal(byText('+ Buchung hinzufügen').disabled, true)
await click(byLabel('Vorheriger Tag'))
assert.ok(host.textContent.includes('Zum Laden brauchst du Internet.'))
await render(overview({ online: true, editable: false }))
assert.equal(host.querySelectorAll('.compact-bookings button').length, 0)
assert.equal(byText('+ Buchung hinzufügen'), undefined)

// Offline stamps remain visible when the cached workspace predates today.
await act(async () => root.render(null))
await render(overview({ online: false, workspace: { days: [], loadedAt: 'yesterday' }, queue: [{ eventId: 'local-come', type: 'come', at: come.at }] }))
assert.equal(host.querySelectorAll('.compact-bookings li').length, 1)
assert.ok(host.textContent.includes('Noch nicht übertragen'))
assert.equal(host.querySelectorAll('.compact-bookings button').length, 0)

// A late historical response must not replace a more recently selected day.
await act(async () => root.render(null))
const deferred = []
globalThis.mobileUiApi = (_name, payload) => new Promise(resolve => deferred.push({ date: payload.from, resolve }))
await render(overview())
await click(byLabel('Vorheriger Tag'))
await click(byLabel('Vorheriger Tag'))
await act(async () => { deferred[1].resolve({ days: [makeDay(deferred[1].date)] }) })
const secondDateHeading = host.querySelector('h2').textContent
await act(async () => { deferred[0].resolve({ days: [makeDay(deferred[0].date)] }) })
assert.equal(host.querySelector('h2').textContent, secondDateHeading)
await act(async () => root.render(null))

// Individual dialogs keep other events and enforce a separate reason per edit.
calls = []; let closed = 0
const correction = (extra = {}) => <Correction key={extra.testKey || 'edit'} day={day} event={come} uid="user-a" online onClose={() => { closed++ }} onSaved={async () => {}} {...extra}/>
globalThis.mobileUiApi = async (name, payload, uid) => { calls.push({ name, payload, uid }); return { accepted: true } }
await render(correction())
assert.equal(host.querySelectorAll('input[type=time]').length, 1)
assert.equal(host.querySelectorAll('select').length, 2)
await select(host.querySelector('select'), 'pause_start')
await chooseReason()
await submit()
assert.equal(calls.length, 1)
assert.equal(calls[0].name, 'correctTimeDay')
assert.deepEqual(calls[0].payload.events[1], go)
assert.equal(calls[0].payload.events[0].at, come.at)
assert.equal(calls[0].payload.expectedRevision, 3)
assert.equal(closed, 1)
await render(correction({ testKey: 'delete' }))
await click(byLabel('Buchung löschen'))
assert.equal(calls.length, 1, 'trash opens confirmation without deleting')
assert.ok(host.textContent.includes('wirklich löschen?'))
assert.equal(host.querySelector('select').value, '')
await chooseReason(); await submit()
assert.equal(calls.length, 2)
assert.deepEqual(calls[1].payload.events, [go])

// Revision conflicts require reload before another save, retaining concurrent edits.
let conflict = true
const concurrentGo = { ...go, at: `${today}T17:00:11.000Z` }
globalThis.mobileUiApi = async (name, payload) => {
  calls.push({ name, payload })
  if (name === 'listTimeWorkspace') return { days: [{ ...day, revision: 4, events: [come, concurrentGo] }] }
  if (conflict) { conflict = false; throw Object.assign(new Error('Zwischenzeitlich geändert'), { code: 'functions/aborted' }) }
  return { accepted: true }
}
await render(correction({ testKey: 'conflict' }))
await select(host.querySelector('select'), 'pause_start'); await chooseReason(); await submit()
assert.equal(byText('Speichern').disabled, true)
await click(byText('Aktuellen Stand laden'))
assert.equal(host.querySelectorAll('select')[1].value, '')
await select(host.querySelector('select'), 'pause_start'); await chooseReason(); await submit()
assert.equal(calls.at(-1).payload.expectedRevision, 4)
assert.deepEqual(calls.at(-1).payload.events[1], concurrentGo)

// A saved change whose refresh failed cannot accidentally be submitted again.
let writes = 0
globalThis.mobileUiApi = async () => { writes++; return { accepted: true } }
await render(correction({ testKey: 'refresh-error', onSaved: async () => { throw new Error('offline') } }))
await select(host.querySelector('select'), 'pause_start'); await chooseReason(); await submit()
assert.ok(host.textContent.includes('Die Buchung ist gespeichert.'))
assert.equal(byText('Speichern').disabled, true)
await submit(); assert.equal(writes, 1)
await render(correction({ testKey: 'old', day: makeDay(addDays(today, -8)) }))
assert.equal(byText('Speichern').disabled, true)
await render(correction({ testKey: 'offline', online: false }))
assert.equal(byText('Speichern').disabled, true)
await act(async () => root.unmount())
host.remove()
console.log('Mobile time UI: day navigation, 7-day permissions, history loading/races, compact tabs, individual edits, deletion confirmation and revision/refresh recovery verified.')

