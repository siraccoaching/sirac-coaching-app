/* Ajouté au service worker : ouvre la bonne page au toucher d'une notification, et affiche les notifications « push » (app fermée). */
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus() } }
    return self.clients.openWindow(url)
  }))
})
self.addEventListener('push', event => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch (e) { d = { title: 'Sirac Coaching', body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(d.title || 'Sirac Coaching', {
    body: d.body || '', icon: '/pwa-192x192.png', badge: '/pwa-192x192.png', data: { url: d.url || '/' },
  }))
})
