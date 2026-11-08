/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// Web push from the free Supabase `send-reminders` function
self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data?.json() ?? {}
    } catch {
      return { title: 'Cozy Planner', body: event.data?.text() }
    }
  })()
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Cozy Planner 🐾', {
      body: data.body ?? '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag,
      data: { url: data.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const w = wins.find((c) => 'focus' in c)
      if (w) {
        ;(w as WindowClient).navigate(url)
        return (w as WindowClient).focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
