import { useEffect, useId, useState } from 'react'
import { call } from '../lib/firebase.js'
import { workspaceCoversStamp } from '../lib/queue.js'
import { addDays, canCorrectDate, dateKey, formatDate, formatTime, minutes, weekStart } from '../lib/dates.js'
import { eventLabels } from './Correction.jsx'
import { Icon, Notice } from './ui.jsx'

const emptyDay = date => ({ date, events: [], targetMinutes: 0, creditedMinutes: 0, bookedBreakMinutes: 0, balanceMinutes: 0 })

export default function TimeOverview({ uid, workspace, queue, today, online, editable, onEdit }) {
  const [view, setView] = useState('day')
  const [chosenDate, setChosenDate] = useState(null)
  const [remote, setRemote] = useState(null)
  const [retry, setRetry] = useState(0)
  const id = useId()
  const selectedDate = chosenDate && chosenDate < today ? chosenDate : today
  const knownDay = workspace?.days?.find(day => day.date === selectedDate)
  const requestKey = `${uid}:${selectedDate}:${workspace?.loadedAt || ''}:${retry}`

  useEffect(() => {
    if (view !== 'day' || knownDay || !online) return
    let active = true
    call('listTimeWorkspace', { from: selectedDate, to: selectedDate, ownOnly: true }, uid)
      .then(data => {
        const day = data.days?.find(item => item.date === selectedDate)
        if (!day) throw new Error('Der Tag konnte nicht geladen werden.')
        if (active) setRemote({ key: requestKey, day })
      })
      .catch(error => { if (active) setRemote({ key: requestKey, error: error.message }) })
    return () => { active = false }
  }, [view, knownDay, online, selectedDate, uid, requestKey])

  const result = remote?.key === requestKey ? remote : null
  // Keep locally captured stamps visible even after an offline date change.
  const localDayEvents = queue.filter(record => record.at && selectedDate === dateKey(record.at))
  const day = knownDay || result?.day || (localDayEvents.length ? emptyDay(selectedDate) : null)
  const events = day ? [...(day.events || []), ...localDayEvents.filter(record => !workspaceCoversStamp(record, day)).map(record => ({ ...record, id: record.eventId, pending: !record.acknowledgedAt, local: true }))].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)) : []
  const mayEdit = editable && online && queue.length === 0 && canCorrectDate(selectedDate, today)
  const start = weekStart(today)
  const week = Array.from({ length: 7 }, (_, index) => workspace?.days?.find(item => item.date === addDays(start, index)) || emptyDay(addDays(start, index)))
  const worked = week.reduce((sum, item) => sum + (item.creditedMinutes || 0), 0)
  const target = week.reduce((sum, item) => sum + (item.targetMinutes || 0), 0)
  const balance = week.filter(item => item.date <= today).reduce((sum, item) => sum + (item.balanceMinutes || 0), 0)
  const maxBar = Math.max(60, ...week.flatMap(item => [item.targetMinutes || 0, (item.creditedMinutes || 0) + (item.bookedBreakMinutes || 0)]))
  const tabs = [['day', 'Heute'], ['week', 'Woche'], ['total', 'Gesamt']]

  return <section className="card time-overview">
    <div className="overview-tabs" role="tablist" aria-label="Zeitübersicht" onKeyDown={event => {
      const index = tabs.findIndex(([key]) => `${id}-${key}-tab` === event.target.id)
      if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3
      setView(tabs[next][0]); document.getElementById(`${id}-${tabs[next][0]}-tab`)?.focus()
    }}>{tabs.map(([key, label]) => <button type="button" key={key} id={`${id}-${key}-tab`} role="tab" tabIndex={view === key ? 0 : -1} aria-selected={view === key} aria-controls={`${id}-${key}-panel`} onClick={() => { setView(key); if (key === 'day') setChosenDate(null) }}>{label}</button>)}</div>
    <div role="tabpanel" id={`${id}-${view}-panel`} aria-labelledby={`${id}-${view}-tab`}>
      {view === 'day' && <>
        <div className="day-navigation"><button type="button" className="icon-button" aria-label="Vorheriger Tag" onClick={() => setChosenDate(addDays(selectedDate, -1))}><Icon name="back" size={21}/></button><button type="button" className="day-today" onClick={() => setChosenDate(null)} disabled={selectedDate === today}>Heute</button><button type="button" className="icon-button" aria-label="Nächster Tag" disabled={selectedDate >= today} onClick={() => setChosenDate(addDays(selectedDate, 1))}><Icon name="forward" size={21}/></button></div>
        <div className="section-head day-heading"><h2>{new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date(`${selectedDate}T12:00:00Z`))}</h2>{day && <strong>{minutes(day.creditedMinutes)} Std.</strong>}</div>
        {!day ? !online ? <Notice>Dieser Tag ist auf diesem Gerät nicht verfügbar. Zum Laden brauchst du Internet.</Notice> : result?.error ? <Notice danger>{result.error}<button type="button" className="text-button" onClick={() => setRetry(value => value + 1)}>Erneut laden</button></Notice> : <p className="empty" role="status">Buchungen werden geladen …</p> : <>
          {events.length ? <ol className="compact-bookings">{events.map(event => <li key={event.id}><time>{formatTime(event.at)}</time><span>{eventLabels[event.type]}{event.pending && <small>Noch nicht übertragen</small>}</span>{mayEdit && !event.local && <button type="button" className="icon-button" aria-label={`${eventLabels[event.type]} um ${formatTime(event.at)} bearbeiten`} onClick={() => onEdit(day, event)}><Icon name="edit" size={18}/></button>}</li>)}</ol> : <p className="empty">{selectedDate === today ? 'Dein Arbeitstag kann starten.' : 'Keine Buchungen an diesem Tag.'}</p>}
          <div className="day-break"><span>Pause gesamt</span><strong>{minutes(day.bookedBreakMinutes)} Std.</strong></div>
          {day.incomplete && <p className="muted small">{selectedDate === today ? 'Dieser Tag läuft noch oder ist unvollständig.' : 'Dieser Tag ist unvollständig.'}</p>}
          {editable && canCorrectDate(selectedDate, today) && <button type="button" className="button button--secondary add-booking" disabled={!mayEdit} onClick={() => onEdit(day, null)}>+ Buchung hinzufügen</button>}
          {!canCorrectDate(selectedDate, today) && <p className="muted small day-readonly">Ältere Buchungen können nur angesehen werden.</p>}
          {editable && canCorrectDate(selectedDate, today) && (!online || queue.length > 0) && <p className="muted small">{!online ? 'Zum Bearbeiten brauchst du Internet.' : 'Bearbeiten ist nach der Übertragung deiner Stempel möglich.'}</p>}
        </>}
      </>}
      {view === 'week' && <>
        <div className="section-head"><h2>Diese Woche</h2><span>{formatDate(start).slice(0, 6)} – {formatDate(addDays(start, 6))}</span></div>
        {!workspace ? <p className="empty">Die Wochenübersicht ist noch nicht verfügbar.</p> : <>
          <div className="week-chart" aria-label={`Diese Woche: Ist ${minutes(worked)}, Soll ${minutes(target)} Stunden`}>{week.map((item, index) => <div className={`chart-column ${item.date === today ? 'chart-column--today' : ''}`} key={item.date}><div className="bar-area"><div className="bar-target" style={{ height: `${item.targetMinutes / maxBar * 100}%` }}/><div className="bar-stack" style={{ height: `${((item.creditedMinutes || 0) + (item.bookedBreakMinutes || 0)) / maxBar * 100}%` }} title={`Ist ${minutes(item.creditedMinutes)}, Pause ${minutes(item.bookedBreakMinutes)}`}><div className="bar-work" style={{ flex: item.creditedMinutes || 0 }}/><div className="bar-break" style={{ flex: item.bookedBreakMinutes || 0 }}/></div></div><span>{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][index]}</span></div>)}</div>
          <div className="week-metrics"><div><small>Ist</small><strong>{minutes(worked)}</strong></div><div><small>Soll</small><strong>{minutes(target)}</strong></div><div><small>Saldo bis heute</small><strong>{minutes(balance, true)}</strong></div></div>
          {week.some(item => item.date <= today && (item.incomplete || item.calculationIncomplete)) && <p className="muted small">Der Wochensaldo ist vorläufig.</p>}
        </>}
      </>}
      {view === 'total' && <div className="total-balance"><h2>Mein Zeitkonto</h2><strong>{workspace ? minutes(workspace.balanceMinutes, true) : '—'} <small>Std.</small></strong><p className="muted small">{!workspace ? 'Noch kein Zeitkonto geladen.' : workspace.balanceMinutes > 0 ? 'Du bist insgesamt im Plus.' : workspace.balanceMinutes < 0 ? 'Du bist insgesamt im Minus.' : 'Dein Zeitkonto ist ausgeglichen.'}</p>{workspace?.balanceProvisional && <p className="muted small">Vorläufiger Stand · unvollständige Tage sind noch zu klären.</p>}</div>}
    </div>
  </section>
}
