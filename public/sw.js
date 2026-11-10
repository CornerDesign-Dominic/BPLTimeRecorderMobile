// Only same-origin static application assets are cached. Never cache Firebase,
// callable responses, credentials or staff data. Updates activate on next launch.
const CACHE = 'drehpunkt-time-shell-v1'
const BUILD_ASSETS = [] // @build-assets
const SHELL = ['/', '/index.html', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest', ...BUILD_ASSETS]
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))))
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('drehpunkt-time-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())))
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  const asset = url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)
  if (event.request.mode !== 'navigate' && !asset) return
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request.mode === 'navigate' ? '/index.html' : event.request, copy)) }
    return response
  }).catch(() => caches.match(event.request.mode === 'navigate' ? '/index.html' : event.request).then(response => response || Response.error())))
})
