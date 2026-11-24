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
  try { d = event.data ? event.data.json() : {} } catch (e) { d = { title: 'ARISE', body: event.data && event.data.text() } }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    // App ouverte et visible : la notification est déjà affichée par l'app (temps réel), on évite le doublon.
    // (Sur iPhone, une notification push doit toujours être affichée : on l'affiche donc sans son ni vibration.)
    const visible = list.some(c => c.visibilityState === 'visible')
    return self.registration.showNotification(d.title || 'ARISE', {
      body: d.body || '', icon: '/pwa-192x192.png', badge: '/pwa-192x192.png', data: { url: d.url || '/' },
      tag: d.tag || undefined, renotify: !visible && !!d.tag, silent: visible,
    })
  }))
})
