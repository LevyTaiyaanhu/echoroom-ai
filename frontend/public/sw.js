const SHELL_CACHE = 'echoroom-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([
        '/',
        '/manifest.json',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
      ]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('echoroom-') && cacheName !== SHELL_CACHE)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (
    request.method !== 'GET'
    || url.origin !== self.location.origin
    || url.pathname.startsWith('/api/')
  ) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(SHELL_CACHE)
          await cache.put('/', response.clone())
        }
        return response
      } catch {
        const cachedPage = await caches.match('/')
        if (cachedPage) return cachedPage
        throw new Error('The app shell is unavailable offline.')
      }
    })())
    return
  }

  if (
    url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/icons/')
    || url.pathname === '/manifest.json'
    || url.pathname === '/favicon.svg'
  ) {
    event.respondWith(
      (async () => {
        const cachedResponse = await caches.match(request)
        if (cachedResponse) return cachedResponse

        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(SHELL_CACHE)
          await cache.put(request, response.clone())
        }
        return response
      })(),
    )
  }
})
