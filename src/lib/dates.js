const zone = 'Europe/Berlin'
export const dateKey = (value = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
export function addDays(date, count) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + count); return value.toISOString().slice(0, 10) }
export function weekStart(date) { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return addDays(date, -(day || 7) + 1) }
export const formatDate = date => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: zone }).format(new Date(`${date}T12:00:00Z`))
export const formatTime = value => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(new Date(value))
export function minutes(value = 0, signed = false) { const number = Math.round(Number(value) || 0); return `${number < 0 ? '−' : signed && number > 0 ? '+' : ''}${String(Math.floor(Math.abs(number) / 60)).padStart(2, '0')}:${String(Math.abs(number) % 60).padStart(2, '0')}` }
// Convert an explicit Berlin wall-clock to an instant; reject nonexistent DST
// times instead of silently shifting the employee's correction.
export function berlinInstant(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Bitte eine gültige Uhrzeit angeben.')
  const base = Date.parse(`${date}T${time}:00Z`)
  const matches = [base - 3600000, base - 7200000].filter(value => dateKey(value) === date && formatTime(value) === time)
  if (matches.length !== 1) throw new Error(matches.length ? 'Diese Uhrzeit ist wegen der Zeitumstellung doppeldeutig. Bitte in Drehpunkt klären.' : 'Diese Uhrzeit existiert wegen der Zeitumstellung nicht.')
  return new Date(matches[0]).toISOString()
}
export const canCorrectDate = (date, today = dateKey()) => date >= addDays(today, -7) && date <= today
