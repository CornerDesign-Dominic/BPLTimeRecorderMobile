import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { JSDOM } from 'jsdom'
const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'node_modules/.cache/time-ui')
await mkdir(output, { recursive: true })
await build({ configFile: false, root, logLevel: 'error', plugins: [{ name: 'mock-time-api', enforce: 'pre', async load(id) {
  if (id.endsWith('/src/lib/firebase.js')) return 'export const db = {}; export const call = (...args) => globalThis.mobileUiApi(...args)'
  if (id.endsWith('/src/lib/vacation.js')) {
    const source = await readFile(id, 'utf8')
    const first = source.indexOf('export async function saveVacation')
    const last = source.indexOf('export function suggestedBusinessDays')
    return source.slice(0, first) + 'export const saveVacation = (...args) => globalThis.mobileUiVacationSave(...args)\n' + source.slice(last)
  }
} }, react()], build: { ssr: path.join(root, `src/components/${process.argv[2] || 'TimeOverview.ui.test.jsx'}`), outDir: output, emptyOutDir: true, minify: false, rollupOptions: { output: { entryFileNames: 'tests.mjs' } } } })
const dom = new JSDOM('<html><body></body></html>', { url: 'https://mobile.test', pretendToBeVisual: true })
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'Node']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] })
process.env.NODE_ENV = 'development'
globalThis.IS_REACT_ACT_ENVIRONMENT = true
await import(pathToFileURL(path.join(output, 'tests.mjs')).href)
dom.window.close()

