import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } from 'firebase/app-check'
import { useLocalAppCheckDebug } from './appCheckEnvironment.js'

const env = import.meta.env
const required = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID']
export const configurationMissing = required.filter(key => !env[`VITE_FIREBASE_${key}`])
const app = configurationMissing.length ? null : initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID })
if (useLocalAppCheckDebug(env.VITE_FIREBASE_PROJECT_ID, globalThis.location?.hostname)) globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true
const appCheck = app && env.VITE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY ? initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(env.VITE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY), isTokenAutoRefreshEnabled: true }) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
const functions = app ? getFunctions(app, 'europe-west3') : null
export async function call(name, data = {}, expectedUid = auth?.currentUser?.uid) {
  if (!navigator.onLine) throw new Error('Hierfür ist eine Internetverbindung erforderlich.')
  if (!functions) throw new Error('Firebase ist noch nicht eingerichtet.')
  if (appCheck) await getToken(appCheck)
  if (!expectedUid || auth.currentUser?.uid !== expectedUid) throw new Error('Das angemeldete Konto hat sich geändert. Bitte erneut versuchen.')
  return (await httpsCallable(functions, name)({ ...data, expectedUserId: expectedUid })).data
}
