/* PLOT 제작 앱 — 오프라인 캐시
 *
 * 규칙 두 가지만 지킨다.
 *   HTML  : 네트워크 먼저, 실패하면 캐시.  → 배포한 수정이 바로 보인다.
 *   폰트·아이콘 : 캐시 먼저.              → 1.6MB 짜리 woff2 를 다시 받지 않는다.
 *
 * 버전을 올리면 옛 캐시는 activate 에서 통째로 지운다.
 */
const V = 'plot-app-v1';
const SHELL = [
  './', './index.html', './carousel.html', './shorts.html',
  './f-eb.woff2', './f-sb.woff2', './f-nb.woff2',
  './icon-192.png', './icon-512.png', './maskable-512.png',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  // 하나가 실패해도 설치 자체는 끝나게 한다 — 전부 아니면 무 는 너무 약하다.
  e.waitUntil(
    caches.open(V)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // 텔레그램 SDK·폰트 CDN 은 건드리지 않는다

  const isDoc = req.mode === 'navigate' || url.pathname.endsWith('.html') ||
                url.pathname.endsWith('/');

  if (isDoc) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(V).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
  } else {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(V).then((c) => c.put(req, copy));
        return res;
      }))
    );
  }
});
