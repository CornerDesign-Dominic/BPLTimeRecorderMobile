import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build, loadEnv } from 'vite'
import { firebaseDevTarget } from './firebase-dev-target.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const mode = 'development'
const target = firebaseDevTarget(loadEnv(mode, root, 'VITE_'), process.env)
await build({ root, mode })
await writeFile(new URL('../dist/firebase-target.json', import.meta.url), `${JSON.stringify({ ...target, builtAt: new Date().toISOString() }, null, 2)}\n`)
console.log(`Firebase-Dev-Build verifiziert: ${target.projectId}`)
