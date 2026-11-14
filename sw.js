// Service Worker for カーメンテナンス
const CACHE = 'car-maint-v11';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg', './icon-maskable.svg'];

// インストール時にキャッシュ（ブラウザのHTTPキャッシュを経由せず最新を取得）
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

// 古いキャッシュを削除
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ページ本体はネットワーク優先（更新をすぐ反映）、オフライン時はキャッシュ。その他はキャッシュ優先
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// サーバーからのプッシュ通知（将来の拡張用）
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'カーメンテナンス', {
      body: data.body || 'メンテナンスの確認をしてください',
      icon: './icon.svg',
      badge: './icon.svg',
      tag: data.tag || 'maintenance',
      data,
    })
  );
});

// アプリからのメッセージで通知を制御
self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'UPDATE_NOTIFICATIONS') {
    const { showItems = [], clearTags = [] } = e.data;

    // 解消された通知を閉じる
    const clearPromises = clearTags.map(tag =>
      self.registration.getNotifications({ tag }).then(ns => ns.forEach(n => n.close()))
    );

    // 期限が来た項目の通知を表示
    const showPromises = showItems.map(item =>
      self.registration.showNotification(item.title, {
        body: item.body,
        icon: './icon.svg',
        badge: './icon.svg',
        tag: item.tag,
        renotify: false,
        requireInteraction: false,
      })
    );

    e.waitUntil(Promise.all([...clearPromises, ...showPromises]));
  }
});

// 通知タップでアプリを開く
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('./');
    })
  );
});
