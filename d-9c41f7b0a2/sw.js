/* 규효 데스크 — 오프라인 캐시
 *
 *   HTML : 네트워크 먼저, 실패하면 캐시. → 배포한 수정이 바로 보인다.
 *   그 외 : 캐시 먼저.
 *
 * 문서는 반드시 cache:'no-store' 로 가져온다. 그냥 fetch(req) 를 쓰면
 * 브라우저 HTTP 캐시를 먼저 보는데, GitHub Pages 가 max-age=600 을 주므로
 * 배포하고 10분 동안 팀은 옛 화면을 본다 — "배포했습니다"가 거짓말이 된다.
 *
 * 캐시 이름을 사이트마다 다르게 둔다. 같은 도메인의 다른 폴더라
 * 이름이 겹치면 한쪽 activate 가 다른 쪽 캐시를 지운다.
 */
const V = 'pluto-desk-v1';
const SHELL = ['./', './index.html', './icon-192.png', './icon-512.png',
               './maskable-512.png', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V)
    .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isDoc = req.mode === 'navigate' || url.pathname.endsWith('.html')
             || url.pathname.endsWith('/');
  if (isDoc) {
    e.respondWith(fetch(req.url, { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => {
        const copy = res.clone();
        caches.open(V).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(V).then((c) => c.put(req, copy));
      return res;
    })));
  }
});
