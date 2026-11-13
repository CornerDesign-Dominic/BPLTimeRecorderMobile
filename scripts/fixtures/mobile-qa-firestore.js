const profile = { active: true, role: 'user', firstName: 'Test', lastName: 'Mobile', permissions: { timeTracking: 'edit', vacation: 'edit' } }
export const doc = (_db, _collection, id) => ({ id: id || crypto.randomUUID() })
export const collection = () => ({})
export const serverTimestamp = () => new Date().toISOString()
export const setDoc = async () => { throw new Error('Urlaubs-Schreibzugriff in der Browser-Testumgebung gesperrt.') }
export const getDoc = async () => ({ exists: () => true, data: () => profile })
export const onSnapshot = (_doc, _options, callback) => { const timer = setTimeout(() => callback({ exists: () => true, data: () => profile, metadata: { fromCache: false } }), 0); return () => clearTimeout(timer) }
