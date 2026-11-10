export const FIREBASE_PROD_PROJECT = 'db-bpl-drehpunkt'
const projectNumber = '878536841109'
const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY',
]

export function firebaseProdTarget(fileEnvironment, processEnvironment = {}) {
  if (processEnvironment.GCLOUD_PROJECT && processEnvironment.GCLOUD_PROJECT !== FIREBASE_PROD_PROJECT) {
    throw new Error('Produktionsbuild abgebrochen: Falsches Firebase-Deployziel.')
  }
  const setting = key => processEnvironment[key] ?? fileEnvironment[key]
  for (const key of required) {
    if (!setting(key)?.trim()) throw new Error(`Produktionsbuild abgebrochen: ${key} fehlt.`)
  }
  const projectId = setting('VITE_FIREBASE_PROJECT_ID')
  const appId = setting('VITE_FIREBASE_APP_ID')
  const appIdPattern = new RegExp(`^1:${projectNumber}:web:[0-9a-f]+$`)
  if (projectId !== FIREBASE_PROD_PROJECT || !appIdPattern.test(appId)
    || setting('VITE_FIREBASE_MESSAGING_SENDER_ID') !== projectNumber
    || setting('VITE_FIREBASE_AUTH_DOMAIN') !== `${projectId}.firebaseapp.com`
    || ![`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`].includes(setting('VITE_FIREBASE_STORAGE_BUCKET'))) {
    throw new Error('Produktionsbuild abgebrochen: Die Firebase-Webkonfiguration gehört nicht zum Produktionsprojekt.')
  }
  return { projectId, appId }
}
