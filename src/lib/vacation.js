import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, call } from './firebase.js'
export const vacationTypes = { normal: 'Urlaub', overtime: 'Überstundenabbau', special: 'Sonderurlaub' }
export async function saveVacation(uid, values, original, kind = 'new') {
  if (!navigator.onLine) throw new Error('Urlaubsfunktionen benötigen Internet.')
  if (kind === 'replace') return call('replacePendingVacationRequest', { requestId: original.id, values }, uid)
  const ref = doc(collection(db, 'vacationRequests'))
  const data = { id: ref.id, userId: uid, type: 'vacation', startDate: values.startDate, endDate: values.endDate, days: Number(values.days), vacationType: values.vacationType, requestComment: values.requestComment || '', note: '', status: 'pending', mainStatus: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...(values.halfDayDate ? { halfDayDate: values.halfDayDate } : {}) }
  if (kind === 'change' || kind === 'cancel') {
    delete data.mainStatus
    Object.assign(data, { status: kind === 'cancel' ? 'cancellation_requested' : 'change_requested', requestStatus: 'pending', vacationId: original.id, originalRequestId: original.id })
    data[kind === 'cancel' ? 'cancellationRequest' : 'changeRequest'] = { originalStartDate: original.startDate, originalEndDate: original.endDate, originalDays: original.days }
    if (kind === 'cancel') data.requestKind = 'cancellation'
  }
  await setDoc(ref, data)
  return ref.id
}
export function suggestedBusinessDays(start, end, holidays = []) {
  if (!start || !end || start > end) return 0
  let days = 0
  const cursor = new Date(`${start}T12:00:00Z`), stop = new Date(`${end}T12:00:00Z`)
  while (cursor <= stop) { const key = cursor.toISOString().slice(0, 10), weekday = cursor.getUTCDay(); if (weekday > 0 && weekday < 6 && !holidays.some(item => (item.startDate || item.date) <= key && (item.endDate || item.date || item.startDate) >= key)) days++; cursor.setUTCDate(cursor.getUTCDate() + 1) }
  return days
}
