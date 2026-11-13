// Local integration fixture: real application + IndexedDB + service worker,
// with synthetic auth and a local server. Never uses a Firebase project.
import { build } from 'vite'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import config from '../vite.config.js'
import { addDays, dateKey, weekStart } from '../src/lib/dates.js'
const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'node_modules/.cache/mobile-browser-qa')
const today = dateKey(), year = Number(today.slice(0, 4))
const storeFile = path.join(root, 'node_modules/.cache/mobile-qa-state.json')
await mkdir(path.dirname(storeFile), { recursive: true })
let store
try { store = JSON.parse(await readFile(storeFile, 'utf8')) } catch {
  store = { days: {}, writes: 0 }
  const date = addDays(today, -1)
  store.days[date] = { revision: 1, events: [ ['come', '07:00'], ['pause_start', '11:00'], ['pause_end', '11:30'], ['go', '16:00'] ].map(([type, time], index) => ({ id: `prior-${index}`, type, at: `${date}T${time}:00.000Z` })) }
}
if (process.argv.includes('--build') || !await readFile(path.join(output, 'index.html')).catch(() => null)) {
  await build({ ...config, configFile: false, root, logLevel: 'error', plugins: [{ name: 'qa-boundaries', enforce: 'pre', resolveId(source) {
    if (source === 'firebase/auth') return path.join(root, 'scripts/fixtures/mobile-qa-auth.js')
    if (source === 'firebase/firestore') return path.join(root, 'scripts/fixtures/mobile-qa-firestore.js')
  }, load(id) { if (id.endsWith('/src/lib/firebase.js')) return readFile(path.join(root, 'scripts/fixtures/mobile-qa-firebase.js'), 'utf8') }, transformIndexHtml() { return [{ tag: 'script', attrs: { type: 'module', src: '/scripts/fixtures/mobile-qa-controls.js' }, injectTo: 'body' }] } }, ...config.plugins], build: { outDir: output, emptyOutDir: true } })
}
const vacation = {
  profile: { annualVacationEntitlement: 30, vacationTrackingStartYear: year }, history: [], adjustments: [],
  requests: [ { id: 'past', userId: 'mobile-qa', status: 'approved', vacationType: 'normal', startDate: `${year}-04-13`, endDate: `${year}-04-17`, days: 5 }, { id: 'future', userId: 'mobile-qa', status: 'approved', vacationType: 'normal', startDate: `${year}-12-21`, endDate: `${year}-12-24`, days: 4 }, { id: 'pending', userId: 'mobile-qa', status: 'pending', vacationType: 'normal', startDate: `${year}-12-28`, endDate: `${year}-12-30`, days: 3 } ],
  holidays: [ { id: 'xmas', name: '1. Weihnachtstag', date: `${year}-12-25` }, { id: 'xmas2', name: '2. Weihnachtstag', date: `${year}-12-26` } ], blocks: [{ id: 'block', label: 'Jahresinventur mit dem gesamten Team', startDate: `${year}-12-14`, endDate: `${year}-12-16` }],
}
function getDay(date) {
  const value = store.days[date] || { revision: 0, events: [] }
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  let work = 0, pause = 0, start, breakAt
  for (const event of value.events.slice().sort((a,b) => Date.parse(a.at)-Date.parse(b.at))) {
    if (event.type === 'come' || event.type === 'pause_end') { if (breakAt) { pause += (Date.parse(event.at)-breakAt)/60000; breakAt = null }; start = Date.parse(event.at) }
    else { if (start) work += (Date.parse(event.at)-start)/60000; start = null; if (event.type === 'pause_start') breakAt = Date.parse(event.at) }
  }
  const targetMinutes = weekday > 0 && weekday < 6 ? 480 : 0
  return { ...value, date, targetMinutes, creditedMinutes: Math.round(work), bookedBreakMinutes: Math.round(pause), balanceMinutes: work-targetMinutes, incomplete: Boolean(start || breakAt) }
}
async function api(name, data) {
  if (name === 'getOwnMobileVacation') return vacation
  if (name === 'listTimeWorkspace') {
    const days = []
    for (let date = data.from; date <= data.to; date = addDays(date, 1)) days.push(getDay(date))
    return { days, account: { startDate: weekStart(today), openingBalanceMinutes: 0 }, balanceMinutes: 95, balanceProvisional: false, history: [], unresolvedDays: [] }
  }
  if (name === 'stampTime') {
    const date = dateKey(data.at)
    const day = store.days[date] ||= { revision: 0, events: [] }
    if (!day.events.some(event => event.id === data.eventId)) { day.events.push({ id: data.eventId, type: data.type, at: data.at }); day.revision++; store.writes++ }
    await writeFile(storeFile, JSON.stringify(store))
    return { accepted: true, revision: day.revision }
  }
  if (name === 'correctTimeDay') {
    const day = store.days[data.date] ||= { revision: 0, events: [] }
    if (day.revision !== data.expectedRevision) throw Object.assign(new Error('Der Tagesstand wurde zwischenzeitlich geändert.'), { code: 'functions/aborted' })
    day.events = data.events; day.revision++; store.writes++
    await writeFile(storeFile, JSON.stringify(store))
    return { accepted: true, revision: day.revision }
  }
  throw new Error('Unbekannter Testaufruf')
}
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/__qa/api' && req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk
      const { name, data } = JSON.parse(raw)
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(await api(name, data))); return
    }
    if (req.url === '/__qa/state') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(store)); return }
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname
    if (pathname === '/scripts/fixtures/mobile-qa-controls.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(path.join(root, 'scripts/fixtures/mobile-qa-controls.js'))); return }
    const target = path.resolve(output, `.${pathname === '/' ? '/index.html' : pathname}`)
    if (!target.startsWith(output + path.sep)) throw new Error('Invalid path')
    const content = await readFile(target)
    const extension = path.extname(target)
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' })[extension] || 'application/octet-stream')
    res.setHeader('Cache-Control', 'no-cache'); res.end(content)
  } catch (error) { res.statusCode = error.code === 'ENOENT' ? 404 : 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: error.message, code: error.code })) }
})
server.listen(4186, '127.0.0.1', () => console.log('Synthetic mobile browser QA: http://127.0.0.1:4186 · no Firebase writes'))
