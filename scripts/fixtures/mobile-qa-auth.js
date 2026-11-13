import { auth } from './mobile-qa-firebase.js'
export function onAuthStateChanged(_auth, callback) { const timer = setTimeout(() => callback(auth.currentUser), 0); return () => clearTimeout(timer) }
export async function signInWithEmailAndPassword() { throw new Error('Nur synthetischer Testzugang.') }
export async function signOut() { location.reload() }
