export const FIREBASE_DEV_PROJECT = 'db-bpl-drehpunkt-dev'

// Vite gives already-defined process variables priority over dotenv files.
// Validate that same effective target before invoking the build or deployment.
export function firebaseDevTarget(fileEnvironment, processEnvironment = {}) {
  const projectId = processEnvironment.VITE_FIREBASE_PROJECT_ID ?? fileEnvironment.VITE_FIREBASE_PROJECT_ID
  const appId = processEnvironment.VITE_FIREBASE_APP_ID ?? fileEnvironment.VITE_FIREBASE_APP_ID
  if (projectId !== FIREBASE_DEV_PROJECT) throw new Error(`Dev-Build abgebrochen: VITE_FIREBASE_PROJECT_ID muss ${FIREBASE_DEV_PROJECT} sein.`)
  if (typeof appId !== 'string' || !appId.trim()) throw new Error('Dev-Build abgebrochen: VITE_FIREBASE_APP_ID fehlt.')
  return { projectId, appId }
}
