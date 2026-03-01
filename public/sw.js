/* Service worker for web push (PWA notifications). */
self.addEventListener('push', function (event) {
  let payload = { title: 'fxarchives', body: 'Time for devotions.' };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_) {
      payload.body = event.data.text() || payload.body;
    }
  }
  const options = {
    body: payload.body,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'fxarchives-push',
    renotify: true,
  };
  event.waitUntil(
    self.registration.showNotification(payload.title || 'fxarchives', options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      const url = '/devotions';
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
