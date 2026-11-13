import { berlinInstant, canCorrectDate, formatTime } from './dates.js'

// Change only the selected event while keeping the backend day revision contract.
export function bookingEditPayload(day, selectedId, values, { deleting = false, today } = {}) {
  if (!canCorrectDate(day.date, today)) throw new Error('Dieser Tag kann nicht mehr bearbeitet werden.')
  if (!values.reason) throw new Error('Bitte einen Grund auswählen.')
  const current = selectedId ? day.events?.find(event => event.id === selectedId) : null
  if (selectedId && !current) throw new Error('Diese Buchung ist nicht mehr vorhanden. Bitte den aktuellen Stand laden.')
  let events = (day.events || []).map(({ id, type, at }) => ({ id, type, at }))
  if (deleting) {
    if (!current) throw new Error('Keine Buchung zum Löschen ausgewählt.')
    events = events.filter(event => event.id !== selectedId)
  } else {
    const replacement = {
      id: current?.id || values.id,
      type: values.type,
      at: current && formatTime(current.at) === values.time ? current.at : berlinInstant(day.date, values.time),
    }
    events = current ? events.map(event => event.id === selectedId ? replacement : event) : [...events, replacement]
  }
  return { date: day.date, expectedRevision: day.revision || 0, events, reason: values.reason, note: values.note || '' }
}
