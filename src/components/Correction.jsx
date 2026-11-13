import { useState } from 'react'
import { call } from '../lib/firebase.js'
import { formatDate, formatTime, canCorrectDate } from '../lib/dates.js'
import { bookingEditPayload } from '../lib/bookingEdit.js'
import { Icon, Modal, Notice } from './ui.jsx'

export const eventLabels = { come: 'Kommen', pause_start: 'Pause Start', pause_end: 'Pause Ende', go: 'Gehen' }

export function Correction({ day, event = null, uid, online, onClose, onSaved }) {
  const [snapshot, setSnapshot] = useState(day)
  const [eventId] = useState(() => event?.id || crypto.randomUUID())
  const [type, setType] = useState(event?.type || 'come')
  const [time, setTime] = useState(event ? formatTime(event.at) : '')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stale, setStale] = useState(false)
  const [missing, setMissing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const allowed = canCorrectDate(day.date)
  const current = snapshot.events?.find(item => item.id === eventId)
  const disabled = busy || !online || !allowed || stale || missing || saved
  const unchanged = event && current?.type === type && formatTime(current.at) === time

  async function persist(deleting = false) {
    if (disabled) return
    setError(''); setBusy(true)
    let accepted = false
    try {
      if (!navigator.onLine) throw new Error('Korrekturen sind nur mit Internet möglich.')
      const payload = bookingEditPayload(snapshot, event ? eventId : null, { id: eventId, type, time, reason, note }, { deleting })
      await call('correctTimeDay', payload, uid)
      accepted = true; setSaved(true); setConfirmDelete(false)
      await onSaved(); onClose()
    } catch (failure) {
      setError(accepted ? 'Die Buchung ist gespeichert. Die Ansicht konnte noch nicht aktualisiert werden.' : failure.message)
      if (failure.code === 'functions/aborted') { setStale(true); setConfirmDelete(false) }
    } finally { setBusy(false) }
  }

  async function reload() {
    setBusy(true)
    try {
      if (saved) { await onSaved(); onClose(); return }
      const data = await call('listTimeWorkspace', { from: day.date, to: day.date, ownOnly: true }, uid)
      const latest = data.days?.find(item => item.date === day.date)
      if (!latest) throw new Error('Der Buchungstag konnte nicht geladen werden.')
      const selected = latest.events?.find(item => item.id === eventId)
      // A lost response may have hidden an already accepted addition.
      if (!event && selected) { await onSaved(); onClose(); return }
      setSnapshot(latest); setStale(false); setReason(''); setNote('')
      if (event && !selected) { setMissing(true); setError('Diese Buchung wurde inzwischen gelöscht. Bitte das Fenster schließen.'); return }
      setType(selected?.type || 'come'); setTime(selected ? formatTime(selected.at) : ''); setError('')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  return <Modal title={`${confirmDelete ? 'Buchung löschen?' : event ? 'Buchung bearbeiten' : 'Buchung hinzufügen'} · ${formatDate(day.date)}`} onClose={() => { if (!busy) onClose() }}>
    {!allowed && <Notice>Nur heute und die vergangenen sieben Tage können bearbeitet werden.</Notice>}
    <form onSubmit={submit => { submit.preventDefault(); void persist(confirmDelete) }}>
      <fieldset disabled={disabled}>
        {confirmDelete ? <Notice danger><strong>{eventLabels[current?.type]} um {current ? formatTime(current.at) : time} wirklich löschen?</strong><p>Die Buchung bleibt im Änderungsverlauf nachvollziehbar.</p></Notice> : <div className="booking-fields"><label>Buchung<select value={type} onChange={change => setType(change.target.value)}>{Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Uhrzeit<input type="time" required value={time} onChange={change => setTime(change.target.value)}/></label></div>}
        <label>Grund<select required value={reason} onChange={change => setReason(change.target.value)}><option value="">Bitte auswählen</option><option value="forgot_stamp">Stempeln vergessen</option><option value="forgot_break">Pause vergessen</option><option value="wrong_booking">Fehlbuchung</option><option value="other">Sonstiges</option></select></label>
        <label>Hinweis <span className="muted">(optional)</span><textarea maxLength="1000" rows="2" value={note} onChange={change => setNote(change.target.value)}/></label>
      </fieldset>
      {error && <Notice danger>{error}</Notice>}
      {stale && <><p className="muted small">Der Tagesstand wurde inzwischen geändert. Beim Neuladen werden deine Eingaben verworfen.</p><button type="button" className="button button--secondary" disabled={busy || !online} onClick={reload}>Aktuellen Stand laden</button></>}
      {saved && <button type="button" className="button button--secondary" disabled={busy || !online} onClick={reload}>Ansicht aktualisieren</button>}
      <div className="booking-footer">
        {event && !confirmDelete && <button type="button" className="icon-button booking-delete" aria-label="Buchung löschen" disabled={disabled} onClick={() => { setConfirmDelete(true); setReason(''); setNote(''); setError('') }}><Icon name="trash" size={20}/></button>}
        <button type="button" className="button button--secondary" disabled={busy} onClick={() => confirmDelete ? setConfirmDelete(false) : onClose()}>Abbrechen</button>
        <button className={`button ${confirmDelete ? 'button--danger' : ''}`} disabled={disabled || (!confirmDelete && unchanged)}>{busy ? 'Wird gespeichert …' : confirmDelete ? 'Löschen bestätigen' : event ? 'Speichern' : 'Hinzufügen'}</button>
      </div>
    </form>
  </Modal>
}
