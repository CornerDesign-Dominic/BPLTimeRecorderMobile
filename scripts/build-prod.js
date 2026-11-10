import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build, loadEnv } from 'vite'
import { firebaseProdTarget } from './firebase-prod-target.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const mode = 'production-pwa'
const target = firebaseProdTarget(loadEnv(mode, root, 'VITE_'), process.env)
await build({ root, mode, build: { outDir: 'dist-production' } })
await writeFile(new URL('../dist-production/firebase-target.json', import.meta.url), `${JSON.stringify({ ...target, builtAt: new Date().toISOString() }, null, 2)}\n`)
console.log(`Firebase-Produktionsbuild verifiziert: ${target.projectId}`)
