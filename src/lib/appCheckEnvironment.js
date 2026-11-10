// A built local preview needs the same debug provider as the Vite dev server
// so that Service Worker/offline tests can call the real development backend.
// Production projects and remotely hosted origins never enable this provider.
export function useLocalAppCheckDebug(projectId, hostname) {
  return projectId === 'db-bpl-drehpunkt-dev'
    && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)
}
