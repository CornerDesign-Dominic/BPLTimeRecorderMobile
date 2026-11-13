import { dateKey } from './dates.js'
import { permitted } from './access.js'
const DB_NAME = 'drehpunkt-time-device'
let opening
const operations = new Map()
function withUserLock(uid, work) {
  if (globalThis.navigator?.locks) return navigator.locks.request(`drehpunkt-time-sync:${uid}`, work)
  const previous = operations.get(uid) || Promise.resolve()
  const next = previous.catch(() => {}).then(work)
  operations.set(uid, next)
  return next.finally(() => { if (operations.get(uid) === next) operations.delete(uid) })
}
function open() {
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => { const db = request.result; db.createObjectStore('queue', { keyPath: 'key' }); db.createObjectStore('snapshots', { keyPath: 'uid' }) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { opening = null; reject(new Error('Lokale Speicherung nicht möglich. Bitte Browser-Speicher prüfen.')) }
  })
  return opening
}
async function transaction(store, mode, action, otherStore) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(otherStore ? [store, otherStore] : store, mode)
    let result
    const request = action(tx.objectStore(store), value => { result = value }, tx)
    if (request) request.onsuccess = () => { result = request.result }
    tx.oncomplete = () => resolve(result)
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Die Buchung konnte nicht auf dem Gerät gespeichert werden.'))
  })
}
export async function queueStamp(uid, event) {
  if (!uid || !event.eventId) throw new Error('Kein angemeldeter Nutzer oder keine Buchungsnummer.')
  const record = { ...event, uid, key: `${uid}:${event.eventId}`, savedAt: new Date().toISOString(), error: '' }
  await transaction('queue', 'readwrite', store => store.add(record))
  return record
}
export async function listQueue(uid) { return (await transaction('queue', 'readonly', store => store.getAll())).filter(event => event.uid === uid && !event.resolvedAt).sort((a, b) => a.at.localeCompare(b.at) || a.savedAt.localeCompare(b.savedAt)) }
export async function listArchived(uid) { return (await transaction('queue', 'readonly', store => store.getAll())).filter(event => event.uid === uid && event.resolvedAt) }
export async function archiveStamp(uid, eventId) {
  return withUserLock(uid, async () => {
    const record = await transaction('queue', 'readonly', store => store.get(`${uid}:${eventId}`))
    // An in-flight sync may have acknowledged it before this operation took
    // the shared lock. Never resurrect an already transmitted record.
    if (!record || record.acknowledgedAt) return
    if (record.uid !== uid) throw new Error('Buchung nicht gefunden.')
    await transaction('queue', 'readwrite', store => store.put({ ...record, resolvedAt: new Date().toISOString(), resolution: 'confirmed_resolved_in_web' }))
  })
}
export function queueFailure(error) {
  const retryable = ['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal', 'auth/network-request-failed'].includes(error?.code) || /failed to fetch|fetch failed|network request failed|networkerror|internetverbindung/i.test(error?.message || '')
  return { retryable, error: retryable ? 'Die Verbindung zum Server ist unterbrochen. Deine Buchung bleibt auf diesem Gerät gespeichert.' : error?.message || 'Übertragung fehlgeschlagen.' }
}

export function deferredPayload(record, now = Date.now()) {
  return { eventId: record.eventId, type: record.type, at: record.at, offline: record.offline || now - Date.parse(record.at) > 60000 }
}
function updateSnapshot(uid, update, discardAcknowledged) {
  return transaction('snapshots', 'readwrite', (store, capture, tx) => {
    const request = store.get(uid)
    request.onsuccess = () => {
      const snapshot = update(request.result)
      if (!snapshot) return
      const value = { ...snapshot, uid, cachedAt: new Date().toISOString() }
      store.put(value)
      capture(value)
      if (discardAcknowledged) removeAcknowledged(tx.objectStore('queue'), uid, discardAcknowledged)
    }
  }, discardAcknowledged ? 'queue' : undefined)
}
export function cacheProfile(uid, profile) {
  const allowed = permitted(profile, 'timeTracking')
  return updateSnapshot(uid, snapshot => ({
    profile,
    workspace: allowed ? snapshot?.workspace ?? null : null,
  }), allowed ? undefined : () => true)
}
export function cacheWorkspace(uid, workspace) {
  const days = new Map((workspace.days || []).map(day => [day.date, day]))
  const today = dateKey()
  // A delayed workspace response can never restore revoked offline rights.
  return updateSnapshot(uid, snapshot => permitted(snapshot?.profile, 'timeTracking')
    ? { profile: snapshot.profile, workspace }
    : undefined, record => {
    const date = dateKey(record.at)
    return date < today || workspaceCoversStamp(record, days.get(date))
  })
}
export async function readSnapshot(uid) { return transaction('snapshots', 'readonly', store => store.get(uid)) }
export function clearSnapshot(uid) {
  return transaction('snapshots', 'readwrite', (store, _capture, tx) => {
    removeAcknowledged(tx.objectStore('queue'), uid, () => true)
    return store.delete(uid)
  }, 'queue')
}

function removeAcknowledged(store, uid, shouldRemove) {
  const request = store.openCursor()
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return
    if (cursor.value.uid === uid && cursor.value.acknowledgedAt && shouldRemove(cursor.value)) cursor.delete()
    cursor.continue()
  }
}

export function workspaceCoversStamp(record, day) {
  return day?.events?.some(event => event.id === record.eventId)
    || (record.acknowledgedRevision > 0 && day?.revision >= record.acknowledgedRevision)
}

function acknowledgeStamp(record, result) {
  return transaction('queue', 'readwrite', (store, _capture, tx) => {
    const request = tx.objectStore('snapshots').get(record.uid)
    request.onsuccess = () => {
      const snapshot = request.result
      const date = dateKey(record.at)
      const confirmed = { ...record, acknowledgedAt: new Date().toISOString(), acknowledgedRevision: result.revision, error: '' }
      const day = snapshot?.workspace?.days?.find(day => day.date === date)
      if (date < dateKey() || !permitted(snapshot?.profile, 'timeTracking') || workspaceCoversStamp(confirmed, day)) {
        store.delete(record.key)
      } else {
        // The last overview may still be offline. Keep the confirmed event
        // until the matching or a newer server snapshot has been saved.
        store.put(confirmed)
      }
    }
  }, 'snapshots')
}
const running = new Map()
export function syncQueue(uid, send, online = () => navigator.onLine) {
  if (running.has(uid)) return running.get(uid)
  const run = async () => {
    const accepted = []
    const blockedDays = new Set()
    for (const record of await listQueue(uid)) {
      if (!online()) break
      if (record.acknowledgedAt) continue
      const day = dateKey(record.at)
      if (blockedDays.has(day)) continue
      try {
        const result = await send(deferredPayload(record))
        if (!result?.accepted) throw new Error('Die Übertragung wurde nicht bestätigt.')
        await acknowledgeStamp(record, result)
        accepted.push(record.eventId)
      } catch (error) {
        await transaction('queue', 'readwrite', store => store.put({ ...record, offline: true, ...queueFailure(error), attemptedAt: new Date().toISOString() }))
        // Preserve order after a conflict. Nothing is discarded or silently
        // turned into a correction; a manager can resolve the original booking.
        blockedDays.add(day)
      }
    }
    return accepted
  }
  const promise = withUserLock(uid, run).finally(() => running.delete(uid))
  running.set(uid, promise)
  return promise
}
