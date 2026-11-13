import { useCallback, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { auth, db, call, configurationMissing } from './lib/firebase.js'
import { cacheProfile, cacheWorkspace, readSnapshot, clearSnapshot, listQueue, queueStamp, syncQueue, archiveStamp, listArchived, workspaceCoversStamp, queueFailure } from './lib/queue.js'
import { permitted } from './lib/access.js'
import { addDays, dateKey, formatDate, formatTime, minutes, weekStart } from './lib/dates.js'
import { Icon, Modal, Notice } from './components/ui.jsx'
import { Correction, eventLabels } from './components/Correction.jsx'
import Vacation from './components/Vacation.jsx'
import InstallAppCard from './components/InstallAppCard.jsx'
import TimeOverview from './components/TimeOverview.jsx'
import { useAppInstall } from './lib/useAppInstall.js'

const minimalProfile = raw => ({ active: raw.active === true, role: raw.role || 'user', permissions: { timeTracking: raw.permissions?.timeTracking || 'none', vacation: raw.permissions?.vacation || 'none' }, firstName: raw.firstName || '', lastName: raw.lastName || '' })
const statusFrom = events => ({ come: 'working', pause_start: 'break', pause_end: 'working', go: 'away' })[events.at(-1)?.type] || 'away'
const emptyDay = date => ({ date, events: [], targetMinutes: 0, creditedMinutes: 0, bookedBreakMinutes: 0, automaticBreakMinutes: 0, balanceMinutes: 0 })

export default function App() {
  const installation = useAppInstall()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(navigator.onLine)
  const [tab, setTab] = useState('time')
  const [workspace, setWorkspace] = useState(null)
  const [queue, setQueue] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(new Date())
  const month = dateKey(now).slice(0, 7)
  const [correction, setCorrection] = useState(null)
  const [forgot, setForgot] = useState(null)
  const [resolving, setResolving] = useState(null)
  const [archived, setArchived] = useState([])
  const generation = useRef(0)
  const refreshGeneration = useRef(0)
  const currentUid = useRef(null)
  const currentProfile = useRef(null)
  const today = dateKey(now)

  const hasTimeAccess = useCallback((uid, edit = false) => currentUid.current === uid && permitted(currentProfile.current, 'timeTracking', edit), [])

  const refresh = useCallback(async (uid, selectedMonth = month) => {
    if (!navigator.onLine || !hasTimeAccess(uid)) return
    const requestId = ++refreshGeneration.current
    const from = `${selectedMonth}-01`
    const nextMonth = new Date(`${from}T12:00:00Z`); nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    const monthEnd = addDays(nextMonth.toISOString().slice(0, 10), -1)
    const weekEnd = addDays(weekStart(dateKey()), 6)
    const to = selectedMonth === dateKey().slice(0, 7) && weekEnd > monthEnd ? weekEnd : monthEnd
    const data = await call('listTimeWorkspace', { from: addDays(from, -7), to, ownOnly: true }, uid)
    if (!hasTimeAccess(uid) || requestId !== refreshGeneration.current) return
    let currentWeekDays = []
    if (selectedMonth !== dateKey().slice(0, 7)) {
      const start = weekStart(dateKey())
      const current = await call('listTimeWorkspace', { from: start, to: addDays(start, 6), ownOnly: true }, uid)
      currentWeekDays = current.days || []
    }
    if (!hasTimeAccess(uid) || requestId !== refreshGeneration.current) return
    const value = { ...data, models: [], employees: [], days: [...new Map([...(data.days || []), ...currentWeekDays].map(day => [day.date, day])).values()].sort((a, b) => a.date.localeCompare(b.date)), loadedAt: new Date().toISOString() }
    setWorkspace(value)
    await cacheWorkspace(uid, value)
    const records = await listQueue(uid)
    if (hasTimeAccess(uid) && requestId === refreshGeneration.current) setQueue(records)
  }, [hasTimeAccess, month])

  const synchronize = useCallback(async uid => {
    if (!navigator.onLine || !hasTimeAccess(uid)) return
    let accepted = []
    if (hasTimeAccess(uid, true)) accepted = await syncQueue(uid, payload => {
      if (auth.currentUser?.uid !== uid) throw new Error('Bitte mit dem ursprünglichen Konto anmelden, um diese Buchung zu übertragen.')
      if (!hasTimeAccess(uid, true)) throw new Error('Die Berechtigung zum Stempeln fehlt.')
      return call('stampTime', { ...payload, expectedUserId: uid }, uid)
    })
    if (currentUid.current !== uid) return
    const records = await listQueue(uid)
    if (currentUid.current !== uid) return
    setQueue(records)
    await refresh(uid)
    if (hasTimeAccess(uid)) {
      setError('')
      if (accepted.length) setMessage(accepted.length === 1 ? 'Buchung übertragen.' : 'Buchungen übertragen.')
    }
  }, [hasTimeAccess, refresh])

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!auth) { setLoading(false); return }
    return onAuthStateChanged(auth, async user => {
      const ticket = ++generation.current
      currentUid.current = user?.uid || null
      currentProfile.current = null
      refreshGeneration.current++
      setSession(null); setWorkspace(null); setQueue([]); setCorrection(null); setForgot(null); setResolving(null); setArchived([]); setMessage(''); setTab('time'); setError(''); setBusy(false); setLoading(true)
      if (!user) { setLoading(false); return }
      try {
        let cached
        if (navigator.onLine) {
          const snapshot = await getDoc(doc(db, 'users', user.uid))
          if (ticket !== generation.current) return
          if (!snapshot.exists() || snapshot.data().active !== true) { await clearSnapshot(user.uid); throw new Error('Dein Drehpunkt-Konto ist nicht aktiv. Bitte die Administration kontaktieren.') }
          cached = await cacheProfile(user.uid, minimalProfile(snapshot.data()))
        } else {
          cached = await readSnapshot(user.uid)
          if (!cached?.profile?.active) throw new Error('Bitte zuerst einmal mit Internet anmelden. Danach ist Offline-Stempeln möglich.')
        }
        const [queued, localArchive] = await Promise.all([listQueue(user.uid), listArchived(user.uid)])
        if (ticket !== generation.current) return
        const profile = cached.profile
        const ownWorkspace = permitted(profile, 'timeTracking') && cached.workspace ? { ...cached.workspace, models: [], employees: [] } : null
        currentProfile.current = profile
        setSession({ user, profile }); setWorkspace(ownWorkspace); setQueue(queued); setArchived(localArchive)
      } catch (failure) { if (ticket === generation.current) setError(queueFailure(failure).error) }
      finally { if (ticket === generation.current) setLoading(false) }
    })
  }, [])

  const sessionUid = session?.user.uid
  useEffect(() => {
    if (!sessionUid || !online) return
    const uid = sessionUid
    async function revoke() {
      if (currentUid.current !== uid) return
      currentProfile.current = null
      refreshGeneration.current++
      setSession(null); setWorkspace(null); setQueue([]); setArchived([]); setCorrection(null); setForgot(null); setResolving(null); setMessage('')
      setError('Dein Konto ist nicht mehr freigegeben. Bitte die Administration kontaktieren.')
      // Keep unsent stamps scoped to the original UID. Signing out does not
      // remove the device queue and never transfers it to another account.
      await Promise.allSettled([clearSnapshot(uid), signOut(auth)])
    }
    return onSnapshot(doc(db, 'users', uid), { includeMetadataChanges: true }, snapshot => {
      if (currentUid.current !== uid || snapshot.metadata.fromCache) return
      if (!snapshot.exists() || snapshot.data().active !== true) { revoke().catch(() => {}); return }
      const profile = minimalProfile(snapshot.data())
      currentProfile.current = profile
      setSession(previous => previous?.user.uid === uid && JSON.stringify(previous.profile) !== JSON.stringify(profile) ? { ...previous, profile } : previous)
      // A permission revocation must also replace the last confirmed offline
      // rights. Never copy the full personnel/user document into IndexedDB.
      cacheProfile(uid, profile).catch(() => {})
      if (!permitted(profile, 'timeTracking')) { refreshGeneration.current++; setWorkspace(null); setCorrection(null); setForgot(null) }
      else if (!permitted(profile, 'timeTracking', true)) { setCorrection(null); setForgot(null) }
    }, failure => { if (failure.code === 'permission-denied' && currentUid.current === uid) revoke().catch(() => {}) })
  }, [sessionUid, online])

  useEffect(() => {
    if (!session || !online) return
    let alive = true
    synchronize(session.user.uid).catch(failure => { if (alive) setError(queueFailure(failure).error) })
    const interval = setInterval(() => synchronize(session.user.uid).catch(() => {}), 60000)
    return () => { alive = false; clearInterval(interval) }
  }, [session, online, synchronize, today])

  async function stamp(type) {
    if (!session || busy || !hasTimeAccess(session.user.uid, true)) return
    setBusy(true); setError(''); setMessage('')
    const uid = session.user.uid
    try {
      const event = { eventId: crypto.randomUUID(), type, at: new Date().toISOString(), offline: !navigator.onLine }
      await queueStamp(uid, event)
      const records = await listQueue(uid)
      if (currentUid.current !== uid) return
      setQueue(records)
      setMessage('Auf diesem Gerät gespeichert.')
      if (type === 'come') {
        const missing = [...(workspace?.unresolvedDays || []), ...(workspace?.days || [])].filter(day => day.date < today && day.incomplete).sort((a, b) => a.date.localeCompare(b.date)).at(-1)
        if (missing) setForgot(missing)
      }
      if (navigator.onLine) {
        await synchronize(uid)
        const remaining = await listQueue(uid)
        if (currentUid.current !== uid) return
        setMessage(remaining.some(record => record.eventId === event.eventId && !record.acknowledgedAt) ? 'Auf diesem Gerät gespeichert. Die Übertragung steht noch aus.' : 'Buchung übertragen.')
      }
    } catch (failure) { if (currentUid.current === uid) setError(queueFailure(failure).error) }
    finally { if (currentUid.current === uid) setBusy(false) }
  }

  async function beginResolution(record) {
    const uid = session.user.uid
    try { await refresh(uid); if (currentUid.current === uid) setResolving(record) } catch (failure) { if (currentUid.current === uid) setError(queueFailure(failure).error) }
  }
  async function resolveBooking() {
    const uid = session.user.uid
    setBusy(true)
    try {
      await archiveStamp(uid, resolving.eventId)
      const [records, archive] = await Promise.all([listQueue(uid), listArchived(uid)])
      if (currentUid.current !== uid) return
      setQueue(records); setArchived(archive); setResolving(null)
      await synchronize(uid)
    } catch (failure) { if (currentUid.current === uid) setError(queueFailure(failure).error) }
    finally { if (currentUid.current === uid) setBusy(false) }
  }

  async function logout() {
    setBusy(true)
    try { await signOut(auth); setTab('time'); setMessage('') } catch { setError('Abmelden nicht möglich. Bitte erneut versuchen.') } finally { setBusy(false) }
  }

  if (configurationMissing.length) return <main className="setup"><img src="/icon.svg" alt=""/><h1>Meine Zeit</h1><p>Die PWA ist vorbereitet. Für die Verbindung zu Drehpunkt fehlt noch die Firebase-Konfiguration.</p><Notice>Die erforderlichen Einstellungen stehen in der README und in der Datei .env.example.</Notice></main>
  if (loading) return <main className="setup"><img src="/icon.svg" alt=""/><h1>Meine Zeit</h1><p>Konto wird geladen …</p></main>
  if (!session) return <Login error={error} online={online} onLogout={auth?.currentUser ? logout : null}/>

  const timeRight = permitted(session.profile, 'timeTracking')
  const editTime = permitted(session.profile, 'timeTracking', true)
  const vacationRight = permitted(session.profile, 'vacation')
  const days = workspace?.days || []
  const baseToday = days.find(day => day.date === today) || emptyDay(today)
  const pending = queue.filter(record => !record.acknowledgedAt)
  const localToday = queue.filter(event => dateKey(event.at) === today && !workspaceCoversStamp(event, baseToday))
  const todayEvents = [...baseToday.events, ...localToday.map(event => ({ ...event, id: event.eventId, pending: !event.acknowledgedAt }))].sort((a, b) => a.at.localeCompare(b.at))
  const status = statusFrom(todayEvents)
  const currentStatus = { working: 'Bei der Arbeit', break: 'In Pause', away: 'Abwesend' }[status]
  return <div className="app"><header className="app-header"><a className="brand" href="/" aria-label="Drehpunkt Meine Zeit"><img src="/icon.svg" alt=""/><span>DREHPUNKT<small>Meine Zeit</small></span></a>{timeRight && tab === 'time' && <span className={`header-status header-status--${status}`} role="status"><i/>{currentStatus}</span>}</header><main>
    {!online && <Notice>Ohne Internet: Nur Stempeln ist möglich. Buchungen bleiben bis zur Übertragung auf diesem Gerät.</Notice>}
    {pending.length > 0 && <Notice danger={pending.some(item => item.error && !item.retryable)}><strong>{pending.length} {pending.length === 1 ? 'Buchung wartet' : 'Buchungen warten'} auf Übertragung.</strong>{pending.find(item => item.error)?.error && <p>{pending.find(item => item.error).error} {pending.find(item => item.error).retryable ? 'Die Übertragung wird bei Verbindung erneut versucht.' : 'Die Buchung bleibt erhalten. Bitte bei einem Konflikt den Zeitmanager kontaktieren.'}</p>}{online && <button className="text-button" disabled={busy} onClick={() => synchronize(session.user.uid).catch(failure => setError(queueFailure(failure).error))}>Erneut übertragen</button>}</Notice>}
    {pending.filter(item => item.error && !item.retryable).map(item => <div className="queue-conflict" key={item.eventId}><span>{formatDate(dateKey(item.at))} · {eventLabels[item.type]} · {formatTime(item.at)}</span><button className="text-button" disabled={!online || busy} onClick={() => beginResolution(item)}>Bereits im Web geklärt?</button></div>)}
    {error && !pending.some(item => item.error && item.retryable) && <Notice danger>{error}</Notice>}{message && !pending.some(item => item.error && item.retryable) && <p className="feedback" role="status">{message}</p>}
    {tab === 'time' && (!timeRight ? <Notice>Für die Zeiterfassung fehlt die Freigabe. Bitte die Administration kontaktieren.</Notice> : <>
      <section className="clock-section"><div className="clock">{formatTime(now)}</div><p className="date">{new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(now)}</p></section>
      <section className={`stamp-section stamp-section--${status}`} aria-label="Stempeln"><div className="stamp-actions"><button disabled={busy || !editTime || status !== 'away'} onClick={() => stamp('come')}><span className="stamp-circle stamp-circle--primary"><Icon name="play" size={34}/></span>Einstempeln</button><button className={status === 'break' ? 'resume-action' : ''} disabled={busy || !editTime || status === 'away'} onClick={() => stamp(status === 'break' ? 'pause_end' : 'pause_start')}><span className="stamp-circle"><Icon name={status === 'break' ? 'play' : 'pause'} size={33}/></span>{status === 'break' ? 'Pause beenden' : 'Pause'}</button><button disabled={busy || !editTime || status === 'away'} onClick={() => stamp('go')}><span className="stamp-circle"><Icon name="exit" size={33}/></span>Ausstempeln</button></div></section>
      <TimeOverview key={session.user.uid} uid={session.user.uid} workspace={workspace} queue={queue} today={today} online={online} editable={editTime} onEdit={(day, event) => setCorrection({ day, event })}/>

    </>)}
    {tab === 'vacation' && (vacationRight ? <Vacation uid={session.user.uid} online={online} editable={permitted(session.profile, 'vacation', true)}/> : <Notice>Für Urlaub fehlt die Freigabe. Bitte die Administration kontaktieren.</Notice>)}
    {tab === 'account' && <><div className="page-heading"><p className="eyebrow">Drehpunkt</p><h1>Mein Konto</h1></div><section className="card"><h2>{session.profile.firstName} {session.profile.lastName}</h2><p className="muted">{session.user.email}</p><p>Du nutzt dieselbe Anmeldung wie in Drehpunkt.</p><button className="button button--secondary" disabled={!online || busy} onClick={async () => { setError(''); try { await session.user.reload(); await synchronize(session.user.uid); setMessage('Daten aktualisiert.') } catch (failure) { setError(queueFailure(failure).error) } }}>Daten aktualisieren</button><button className="button" disabled={busy} onClick={logout}>Abmelden</button>{pending.length > 0 && <Notice>Deine noch nicht übertragenen Stempel bleiben auf diesem Gerät und werden beim nächsten Anmelden mit diesem Konto übertragen. Bitte Browserdaten vorher nicht löschen.</Notice>}</section><InstallAppCard installation={installation} /></>}
    {tab === 'account' && workspace?.account && <section className="card"><h2>Zeitkonto</h2><p className="muted small">Beginn {formatDate(workspace.account.startDate)} · Anfangssaldo {minutes(workspace.account.openingBalanceMinutes, true)}</p><p>Gesamtsaldo <strong>{minutes(workspace.balanceMinutes, true)}</strong>{workspace.balanceProvisional && <small className="muted"> · vorläufig</small>}</p><p className="muted small">Genehmigter Überstundenabbau wird gesondert vom Zeitkonto abgezogen. Die Einträge findest du unter Zeit und Urlaub.</p></section>}
    {tab === 'account' && workspace?.history?.length > 0 && <section className="card"><h2>Änderungsverlauf</h2>{workspace.history.slice(0, 30).map(item => <details className="calendar-row" key={item.id}><summary>{formatDate(item.date)} · {item.kind === 'addition' ? 'Nachtrag' : 'Korrektur'}</summary><small>{item.createdAt ? `${formatDate(dateKey(item.createdAt))} · ${formatTime(item.createdAt)}` : ''} · {item.createdBy === session.user.uid ? 'Du' : item.createdByName || 'Berechtigte Person'}</small><p className="small">{({ forgot_stamp: 'Stempeln vergessen', forgot_break: 'Pause vergessen', wrong_booking: 'Fehlbuchung', other: 'Sonstiges' })[item.reason] || item.reason}{item.note ? ` · ${item.note}` : ''}</p><p className="small muted">Vorher: {(item.before || []).map(event => `${eventLabels[event.type]} ${formatTime(event.at)}`).join(' · ') || 'Keine Buchungen'}</p><p className="small">Danach: {(item.after || []).map(event => `${eventLabels[event.type]} ${formatTime(event.at)}`).join(' · ') || 'Keine Buchungen'}</p></details>)}</section>}
    {tab === 'account' && archived.length > 0 && <section className="card"><h2>Lokal geklärte Buchungen</h2><p className="muted small">Im Web geklärt und auf diesem Gerät archiviert. Diese Belege werden nicht erneut übertragen.</p>{archived.map(item => <div className="calendar-row" key={item.eventId}><strong>{formatDate(dateKey(item.at))} · {eventLabels[item.type]} · {formatTime(item.at)}</strong><small>Archiviert am {formatDate(dateKey(item.resolvedAt))} um {formatTime(item.resolvedAt)}</small></div>)}</section>}
  </main><nav className="bottom-nav" aria-label="Hauptnavigation">{[['time', 'clock', 'Zeit'], ['vacation', 'calendar', 'Urlaub'], ['account', 'user', 'Konto']].map(([key, icon, label]) => <button key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => { setTab(key); setError(''); setMessage('') }}><Icon name={icon}/><span>{label}</span></button>)}</nav>
    {resolving && <Modal title="Buchung im Web geklärt?" onClose={() => setResolving(null)}><p><strong>{formatDate(dateKey(resolving.at))} · {eventLabels[resolving.type]} · {formatTime(resolving.at)}</strong></p><p>Bestätige nur, wenn diese Buchung bereits in Drehpunkt nachgetragen oder mit dem Zeitmanager geklärt wurde. Sie wird danach nicht erneut übertragen. Der ursprüngliche Beleg bleibt im lokalen Archiv dieses Kontos erhalten.</p><button className="button" disabled={!online || busy} onClick={resolveBooking}>Im Web geklärt – lokal archivieren</button><button className="button button--secondary" onClick={() => setResolving(null)}>Weiter zur Übertragung vormerken</button></Modal>}
    {correction && <Correction day={correction.day} event={correction.event} uid={session.user.uid} online={online} onClose={() => setCorrection(null)} onSaved={() => refresh(session.user.uid)}/>}
    {forgot && <Modal title="Feierabend nachtragen" onClose={() => setForgot(null)}><p>Dein Arbeitsstart ist auf diesem Gerät gespeichert. Am {formatDate(forgot.date)} fehlt noch eine Buchung. Bitte vervollständige diesen Tag.</p><div className="stack"><button className="button" disabled={!online || queue.length > 0} onClick={() => { setCorrection({ day: forgot, event: null }); setForgot(null) }}>Jetzt nachtragen</button><button className="button button--secondary" onClick={() => setForgot(null)}>Später</button></div></Modal>}
  </div>
}

function Login({ error: externalError, online, onLogout }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await signInWithEmailAndPassword(auth, email.trim(), password) } catch { setError('Anmeldung nicht möglich. Bitte E-Mail, Passwort und Verbindung prüfen.') } finally { setBusy(false) } }
  return <main className="login"><div className="login-brand"><img src="/icon.svg" alt=""/><p className="eyebrow">DREHPUNKT</p><h1>Dein Tag.<br/>Deine Zeit.</h1><p className="muted">Arbeitszeit und Urlaub – einfach im Alltag.</p></div>{(error || externalError) && <Notice danger>{error || externalError}</Notice>}{onLogout ? <button className="button" onClick={onLogout}>Anderes Konto verwenden</button> : <form onSubmit={submit}><label>E-Mail<input autoComplete="username" type="email" required value={email} onChange={event => setEmail(event.target.value)}/></label><label>Passwort<input autoComplete="current-password" type="password" required value={password} onChange={event => setPassword(event.target.value)}/></label><button className="button" disabled={!online || busy}>{busy ? 'Anmeldung läuft …' : 'Mit Drehpunkt anmelden'}</button><p className="muted small">Verwende deine bestehende Drehpunkt-Anmeldung.</p>{!online && <Notice>Für die erste Anmeldung brauchst du Internet.</Notice>}</form>}</main>
}
