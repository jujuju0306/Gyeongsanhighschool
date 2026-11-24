// 서비스 워커: 앱 오프라인 실행 + 푸시 알림 수신
// 앱 파일을 고친 뒤 배포할 때는 아래 버전 숫자를 올려 주세요.
const CACHE = 'patrol-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'firebase-config.js', 'css/style.css',
  'js/app.js', 'js/ui.js', 'js/utils.js', 'js/actions.js', 'js/push.js', 'js/components.js',
  'js/store/index.js', 'js/store/demo.js', 'js/store/firebase.js',
  'js/screens/home.js', 'js/screens/schedule.js', 'js/screens/swap.js', 'js/screens/contact.js',
  'js/screens/more.js', 'js/screens/admin.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/badge-96.png',
];
const CDN_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net', 'www.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 우리 앱 파일: 최신 버전 우선, 오프라인이면 저장본
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
    );
    return;
  }

  // 라이브러리(CDN): 저장본 우선 (버전이 고정된 주소라 안전)
  const isLib = CDN_HOSTS.includes(url.hostname) && (url.hostname !== 'www.gstatic.com' || url.pathname.startsWith('/firebasejs/'));
  if (isLib) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});

// ---- 푸시 알림 받기 (알림 발송 서버 → Firebase Cloud Messaging → 휴대폰) ----
self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { data: { body: e.data && e.data.text() } }; }
  const n = p.notification || {};
  const d = p.data || {};
  const title = d.title || n.title || '학생부 순찰';
  const options = {
    body: d.body || n.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    data: { url: d.url || './#home' },
    vibrate: [200, 100, 200],
  };
  if (d.tag) { options.tag = d.tag; options.renotify = true; }
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './#home', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        c.postMessage({ type: 'open', url });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
