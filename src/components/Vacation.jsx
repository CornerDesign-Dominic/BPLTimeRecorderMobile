import { useCallback, useEffect, useState } from 'react'
import { call } from '../lib/firebase.js'
import { vacationOverview } from '../lib/vacationBalance.js'
import { filterVacationRequests, hasOpenVacationRequest } from '../lib/vacationFilters.js'
import { getMainVacationStatus, getVacationRequestStatus, getVacationRequestKind, mainStatusLabel, requestStatusLabel } from '../lib/vacationStatus.js'
import { saveVacation, suggestedBusinessDays, vacationTypes } from '../lib/vacation.js'
import { dateKey, formatDate } from '../lib/dates.js'
import { Modal, Notice, Icon } from './ui.jsx'

const historyLabels = { vacation_pending: 'Urlaub angefragt', vacation_approved: 'Urlaub genehmigt', vacation_rejected: 'Urlaub abgelehnt', vacation_manual: 'Urlaub manuell erfasst', vacation_withdrawn: 'Antrag zurückgezogen', vacation_replaced: 'Antrag überarbeitet', change_pending: 'Änderung angefragt', change_approved: 'Änderung genehmigt', change_rejected: 'Änderung abgelehnt', cancellation_pending: 'Storno angefragt', cancellation_approved: 'Storno genehmigt', cancellation_rejected: 'Storno abgelehnt', change_withdrawn: 'Änderung zurückgezogen', cancellation_withdrawn: 'Storno zurückgezogen' }
const displayDays = value => value == null || Number.isNaN(value) ? '—' : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value)
const period = item => `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`
function historyMillis(value) { if (!value) return 0; return +new Date(value._seconds != null ? value._seconds * 1000 : value.seconds != null ? value.seconds * 1000 : value) || 0 }
function historyTime(value) { const stamp = historyMillis(value); return stamp ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(stamp) : '' }

export default function Vacation({ uid, online, editable }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [modal, setModal] = useState(null), [selected, setSelected] = useState(null)
  const [year, setYear] = useState(Number(dateKey().slice(0, 4)))
  const [filter, setFilter] = useState('all')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const refresh = useCallback(async () => { if (!navigator.onLine) return; setBusy(true); try { const value = await call('getOwnMobileVacation', {}, uid); setData({ ...value, requests: (value.requests || []).filter(item => item.userId === uid) }); setError('') } catch (failure) { setError(failure.message) } finally { setBusy(false) } }, [uid])
  useEffect(() => { if (online) refresh() }, [refresh, online])
  if (!online) return <><div className="page-heading"><p className="eyebrow">Deine Auszeit</p><h1>Mein Urlaub</h1></div><Notice>Urlaubsübersicht und Anträge sind nur mit Internet verfügbar.</Notice></>
  const requests = data?.requests || [], history = data?.history || []
  const today = dateKey()
  const currentYear = Number(today.slice(0, 4))
  const overview = vacationOverview({ ...(data?.profile || {}), entries: [...requests, ...(data?.adjustments || [])], year: currentYear, today })
  const years = [...new Set([year, ...requests.flatMap(item => [Number(item.startDate?.slice(0, 4)), Number(item.endDate?.slice(0, 4))]), ...Array.from({ length: 9 }, (_, index) => currentYear - 5 + index)])].filter(value => value >= 2000 && value <= 2199).sort((a, b) => b - a)
  const main = filterVacationRequests(requests, { year, filter, today })
  const calendar = [...(data?.holidays || []).map(item => ({ ...item, kind: 'Feiertag' })), ...(data?.blocks || []).map(item => ({ ...item, kind: 'Urlaubssperre' }))].filter(item => (item.endDate || item.date || item.startDate) >= today).sort((a, b) => (a.startDate || a.date).localeCompare(b.startDate || b.date))
  const children = selected ? requests.filter(item => (item.vacationId || item.originalRequestId) === selected.id) : []
  const openChild = children.some(item => getVacationRequestStatus(item) === 'pending')
  const selectedStatus = selected && getMainVacationStatus(selected)
  async function withdraw(item) { setBusy(true); try { await call('withdrawVacationRequest', { requestId: item.id }, uid); setSelected(null); await refresh() } catch (failure) { setError(failure.message) } finally { setBusy(false) } }
  return <><div className="page-heading"><p className="eyebrow">Deine Auszeit</p><h1>Mein Urlaub</h1></div>
    {error && <Notice danger>{error}</Notice>}
    <section className="card vacation-summary" aria-labelledby="vacation-summary-heading">
      <div className="section-head"><h2 id="vacation-summary-heading">Dein Urlaub {currentYear}</h2></div>
      <div className="vacation-summary-grid">{[
        ['Jahreskontingent', overview.budgetDays],
        ['Genommen', overview.completedDays],
        ['Geplant', overview.plannedDays],
        ['Noch verfügbar', overview.remainingDays],
      ].map(([label, value]) => <div className="vacation-summary-tile" key={label}><span>{label}</span><strong>{data ? displayDays(value) : '—'} <small>Tage</small></strong></div>)}</div>
      <p className="muted small">Geplant: genehmigte und laufende Urlaube. Offene Anträge sind noch nicht abgezogen.</p>
      {editable && <button className="button" disabled={busy || !data} onClick={() => setModal({ kind: 'new' })}>Urlaub beantragen</button>}
    </section>
    <section className="card vacation-requests" aria-labelledby="vacation-requests-heading">
      <div className="section-head"><h2 id="vacation-requests-heading">Meine Anträge</h2><button className="icon-button" aria-label="Urlaub aktualisieren" disabled={busy} onClick={refresh}><Icon name="refresh" size={19}/></button></div>
      <div className="vacation-list-filters"><label>Jahr<select value={year} onChange={event => setYear(Number(event.target.value))}>{years.map(value => <option value={value} key={value}>{value}</option>)}</select></label><label>Filter<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Alle</option><option value="upcoming">Anstehend / laufend</option><option value="past">Vergangen</option><option value="pending">Offene Anfragen</option><option value="closed">Abgelehnt / beendet</option></select></label></div>
      {busy && !data ? <p className="empty" role="status">Wird geladen …</p> : main.length ? <div className="request-list">{main.map(item => <button key={item.id} onClick={() => setSelected(item)}><div className="section-head"><strong>{vacationTypes[item.vacationType] || 'Urlaub'}</strong><span className={`badge badge--${getMainVacationStatus(item)}`}>{mainStatusLabel(getMainVacationStatus(item))}</span></div><span>{period(item)}</span><small>{displayDays(item.days)} Tage{getMainVacationStatus(item) !== 'pending' && hasOpenVacationRequest(item, requests) ? ' · Folgeantrag offen' : ''}</small></button>)}</div> : <p className="empty">Keine Anträge für diese Auswahl.</p>}
    </section>
    <button type="button" className="button button--secondary vacation-calendar-button" disabled={!data} onClick={() => setCalendarOpen(true)}><Icon name="calendar" size={18}/> Feiertage & Urlaubssperren</button>
    {calendarOpen && <Modal title="Feiertage & Urlaubssperren" onClose={() => setCalendarOpen(false)}><p className="muted small">Anstehende Termine aus dem Drehpunkt-Kalender.</p>{calendar.length ? <ul className="vacation-calendar-list">{calendar.map(item => <li key={`${item.kind}-${item.id}`}><div><strong>{item.label || item.name || item.kind}</strong>{(item.label || item.name) && (item.label || item.name) !== item.kind && <span className={`calendar-kind ${item.kind === 'Urlaubssperre' ? 'calendar-kind--block' : ''}`}>{item.kind}</span>}</div><span>{formatDate(item.startDate || item.date)}{item.endDate && item.endDate !== (item.startDate || item.date) ? ` – ${formatDate(item.endDate)}` : ''}</span></li>)}</ul> : <p className="empty">Keine anstehenden Feiertage oder Urlaubssperren.</p>}</Modal>}

    {selected && <Modal title={vacationTypes[selected.vacationType] || 'Urlaub'} onClose={() => setSelected(null)}><p><strong>{period(selected)}</strong></p><p>{displayDays(selected.days)} Tage · {mainStatusLabel(selectedStatus)}</p>{selected.requestComment && <p>{selected.requestComment}</p>}{selected.managerComment && <Notice>{selected.managerComment}</Notice>}<div className="stack">{editable && selectedStatus === 'pending' && !openChild && <><button className="button" disabled={busy} onClick={() => { setModal({ kind: 'replace', original: selected }); setSelected(null) }}>Antrag überarbeiten</button><button className="button button--secondary" disabled={busy} onClick={() => withdraw(selected)}>Antrag zurückziehen</button></>}{editable && selectedStatus === 'approved' && !openChild && <><button className="button" disabled={busy} onClick={() => { setModal({ kind: 'change', original: selected }); setSelected(null) }}>Änderung beantragen</button><button className="button button--secondary" disabled={busy} onClick={() => { setModal({ kind: 'cancel', original: selected }); setSelected(null) }}>Storno beantragen</button></>}</div>{children.length > 0 && <><h3>Folgeanträge</h3>{children.map(item => <div className="calendar-row" key={item.id}><strong>{getVacationRequestKind(item) === 'cancellation' ? 'Stornoantrag' : 'Änderungsantrag'}</strong><span>{period(item)}</span><small>{requestStatusLabel(getVacationRequestStatus(item))}</small>{editable && getVacationRequestStatus(item) === 'pending' && <button className="text-button" disabled={busy} onClick={() => withdraw(item)}>Zurückziehen</button>}</div>)}</>}<h3>Verlauf</h3>{history.filter(item => item.vacationId === selected.id || item.requestId === selected.id).sort((a, b) => historyMillis(b.createdAt) - historyMillis(a.createdAt)).map(item => <div className="calendar-row" key={item.id}><strong>{historyLabels[item.eventType] || 'Status aktualisiert'}</strong><small>{historyTime(item.createdAt)}{item.createdByName ? ` · ${item.createdByName}` : ''}</small>{item.comment && <span>{item.comment}</span>}</div>)}</Modal>}
    {modal && <VacationForm {...modal} holidays={data?.holidays || []} blocks={data?.blocks || []} onClose={() => setModal(null)} onSave={async values => { await saveVacation(uid, values, modal.original, modal.kind); setModal(null); await refresh() }}/>}</>
}

function VacationForm({ kind, original, holidays, blocks, onClose, onSave }) {
  const initial = original || { startDate: dateKey(), endDate: dateKey(), vacationType: 'normal' }
  const [form, setForm] = useState({ startDate: initial.startDate, endDate: initial.endDate, days: String(initial.days ?? suggestedBusinessDays(initial.startDate, initial.endDate, holidays)), vacationType: initial.vacationType || 'normal', requestComment: '', halfDayDate: initial.halfDayDate || '' })
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const cancel = kind === 'cancel'
  const half = Number(form.days) % 1 === 0.5
  const blocked = blocks.some(item => (item.startDate || item.date) <= form.endDate && (item.endDate || item.date || item.startDate) >= form.startDate)
  function setDate(field, value) { setForm(previous => { const next = { ...previous, [field]: value }; if (next.endDate < next.startDate) next.endDate = next.startDate; return { ...next, days: String(suggestedBusinessDays(next.startDate, next.endDate, holidays)), halfDayDate: '' } }) }
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      if (!navigator.onLine) throw new Error('Urlaubsfunktionen benötigen Internet.')
      const days = Number(form.days)
      if (!form.startDate || !form.endDate || form.endDate < form.startDate || !Number.isFinite(days) || days < 0 || days % 0.5 !== 0) throw new Error('Bitte Zeitraum und Urlaubstage prüfen.')
      const halfDayDate = half ? form.startDate === form.endDate ? form.startDate : form.halfDayDate : ''
      if (half && (!halfDayDate || halfDayDate < form.startDate || halfDayDate > form.endDate)) throw new Error('Bitte den halben Urlaubstag auswählen.')
      await onSave({ ...form, days, halfDayDate })
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  return <Modal title={{ new: 'Urlaub beantragen', replace: 'Antrag überarbeiten', change: 'Änderung beantragen', cancel: 'Storno beantragen' }[kind]} onClose={onClose}><form onSubmit={submit}><fieldset disabled={busy}>{cancel ? <p>Storno für {period(original)} mit {displayDays(original.days)} Tagen beantragen.</p> : <><div className="form-grid"><label>Von<input type="date" required value={form.startDate} onChange={event => setDate('startDate', event.target.value)}/></label><label>Bis<input type="date" required min={form.startDate} value={form.endDate} onChange={event => setDate('endDate', event.target.value)}/></label></div><label>Urlaubstage<input type="number" required min="0" max="366" step="0.5" value={form.days} onChange={event => setForm({ ...form, days: event.target.value })}/><small className="muted">Vorschlag aus Mo–Fr ohne Feiertage. Bitte bei abweichendem Arbeitsmodell prüfen.</small></label>{half && form.startDate !== form.endDate && <label>Halber Urlaubstag am<input type="date" required min={form.startDate} max={form.endDate} value={form.halfDayDate} onChange={event => setForm({ ...form, halfDayDate: event.target.value })}/></label>}<label>Urlaubsart<select value={form.vacationType} onChange={event => setForm({ ...form, vacationType: event.target.value })}>{Object.entries(vacationTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{blocked && <Notice>Der Zeitraum berührt eine Urlaubssperre. Bitte vor dem Antrag mit deinem Urlaubsmanager klären.</Notice>}</>}<label>Kommentar <span className="muted">(optional)</span><textarea maxLength="1000" rows="3" value={form.requestComment} onChange={event => setForm({ ...form, requestComment: event.target.value })}/></label><button className="button">{busy ? 'Wird gesendet …' : cancel ? 'Storno beantragen' : 'Antrag senden'}</button></fieldset>{error && <Notice danger>{error}</Notice>}</form></Modal>
}
