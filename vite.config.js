import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
// Include fingerprinted production JS/CSS in the install transaction. A first
// online visit is enough; offline reopening never relies on a second reload.
function offlineShell() {
  let outputDirectory
  return {
    name: 'time-offline-shell',
    apply: 'build',
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      const files = (await readdir(join(outputDirectory, 'assets'))).sort().map(file => `/assets/${file}`)
      const version = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12)
      const sw = await readFile(new URL('./public/sw.js', import.meta.url), 'utf8')
      await writeFile(join(outputDirectory, 'sw.js'), sw.replace('const BUILD_ASSETS = [] // @build-assets', `const BUILD_ASSETS = ${JSON.stringify(files)}`).replace('drehpunkt-time-shell-v1', `drehpunkt-time-shell-${version}`))
    },
  }
}
export default defineConfig({ plugins: [react(), offlineShell()] })
