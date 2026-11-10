import { useState } from 'react'
import { call } from '../lib/firebase.js'
import { berlinInstant, formatDate, formatTime, canCorrectDate } from '../lib/dates.js'
import { Modal, Notice } from './ui.jsx'
export const eventLabels = { come: 'Kommen', pause_start: 'Pause Beginn', pause_end: 'Pause Ende', go: 'Gehen' }
const editableEvents = day => (day.events || []).map(event => ({ id: event.id, type: event.type, time: formatTime(event.at), originalTime: formatTime(event.at), originalAt: event.at }))
export function Correction({ day, uid, online, onClose, onSaved }) {
  const [events, setEvents] = useState(editableEvents(day))
  const [revision, setRevision] = useState(day.revision || 0)
  const [stale, setStale] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      if (!online || !navigator.onLine) throw new Error('Korrekturen sind nur mit Internet möglich.')
      await call('correctTimeDay', { date: day.date, expectedRevision: revision, reason, note, events: events.map(item => ({ ...(item.id ? { id: item.id } : {}), type: item.type, at: item.originalAt && item.originalTime === item.time ? item.originalAt : berlinInstant(day.date, item.time) })) }, uid)
      await onSaved(); onClose()
    } catch (failure) { setError(failure.message); if (failure.code === 'functions/aborted') setStale(true) } finally { setBusy(false) }
  }
  async function reload() {
    setBusy(true)
    try { const data = await call('listTimeWorkspace', { from: day.date, to: day.date, ownOnly: true }, uid); const current = data.days?.find(item => item.date === day.date) || { events: [], revision: 0 }; setEvents(editableEvents(current)); setRevision(current.revision || 0); setStale(false); setError('Aktueller Stand geladen. Bitte Änderungen erneut prüfen und speichern.') } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  const allowed = canCorrectDate(day.date)
  return <Modal title={`Zeiten · ${formatDate(day.date)}`} onClose={onClose}><p className="muted">Nachträge und Änderungen werden mit Grund und Änderungsverlauf gespeichert.</p>{!allowed && <Notice>Dieser Tag liegt außerhalb der 7-Tage-Frist. Bitte deinen Zeitmanager kontaktieren.</Notice>}<form onSubmit={save}><fieldset disabled={busy || !online || !allowed}>{events.map((item, index) => <div className="event-edit" key={index}><select aria-label={`Buchungsart ${index + 1}`} value={item.type} onChange={event => setEvents(events.map((value, n) => n === index ? { ...value, type: event.target.value } : value))}>{Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label={`Uhrzeit ${index + 1}`} type="time" required value={item.time} onChange={event => setEvents(events.map((value, n) => n === index ? { ...value, time: event.target.value } : value))}/><button type="button" className="icon-button" aria-label={`Buchung ${index + 1} entfernen`} onClick={() => setEvents(events.filter((_, n) => index !== n))}>×</button></div>)}<button type="button" className="text-button" onClick={() => setEvents([...events, { type: events.length ? 'go' : 'come', time: '' }])}>+ Buchung ergänzen</button><label>Grund<select required value={reason} onChange={event => setReason(event.target.value)}><option value="">Bitte auswählen</option><option value="forgot_stamp">Stempeln vergessen</option><option value="forgot_break">Pause vergessen</option><option value="wrong_booking">Fehlbuchung</option><option value="other">Sonstiges</option></select></label><label>Hinweis <span className="muted">(optional)</span><textarea maxLength="1000" rows="3" value={note} onChange={event => setNote(event.target.value)}/></label><button className="button" type="submit">{busy ? 'Wird gespeichert …' : 'Änderung speichern'}</button></fieldset>{error && <Notice danger>{error}</Notice>}{stale && <button type="button" className="button button--secondary" disabled={!online || busy} onClick={reload}>Entwurf verwerfen und aktuelle Zeiten laden</button>}</form></Modal>
}
