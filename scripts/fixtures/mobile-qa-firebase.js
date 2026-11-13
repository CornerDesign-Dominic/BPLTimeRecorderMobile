// Synthetic identity used only by serve-mobile-qa.mjs, never by the real build.
export const auth = { currentUser: { uid: 'mobile-qa', email: 'test@example.invalid', reload: async () => {} } }
export const configurationMissing = []
export const db = {}
export async function call(name, data = {}, expectedUid = auth.currentUser?.uid) {
  if (!navigator.onLine) throw new Error('Hierfür ist eine Internetverbindung erforderlich.')
  if (expectedUid !== auth.currentUser?.uid) throw new Error('Das Konto hat sich geändert.')
  const response = await fetch('/__qa/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, data }) })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.error), { code: result.code })
  return result
}
