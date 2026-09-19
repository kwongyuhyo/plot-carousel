/* PLOT 제작 앱 — 오프라인 캐시
 *
 * 규칙 두 가지만 지킨다.
 *   HTML  : 네트워크 먼저, 실패하면 캐시.  → 배포한 수정이 바로 보인다.
 *   폰트·아이콘 : 캐시 먼저.              → 1.6MB 짜리 woff2 를 다시 받지 않는다.
 *
 * 버전을 올리면 옛 캐시는 activate 에서 통째로 지운다.
 */
const V = 'plot-app-v10';
const SHELL = [
  './', './index.html', './carousel.html', './shorts.html', './sources.html',
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
  // 데이터 파일은 하루 두 번 갱신된다. 캐시 우선으로 주면 처음 받은 후보가
  // 영원히 고정돼서 '어제 것을 보고 있는' 사고가 난다. HTML 과 같은 규칙으로.
  const isData = url.pathname.endsWith('.json') &&
                 !url.pathname.endsWith('manifest.webmanifest');

  if (isDoc || isData) {
    e.respondWith(
      // 브라우저의 HTTP 캐시를 건너뛰고 서버에 직접 물어본다.
      // GitHub Pages 가 max-age=600 을 주므로 그냥 fetch 하면 배포하고 10분 동안
      // 옛 화면이 나온다. 설치된 앱에서는 그게 '고쳤는데 그대로네' 로 보인다.
      //
      // fetch(req, {cache:'no-cache'}) 는 쓸 수 없다 — 첫 화면 요청은 mode 가
      // 'navigate' 라서 옵션을 얹어 Request 를 다시 만들면 TypeError 가 난다.
      // 그러면 이 핸들러가 통째로 죽고 결국 HTTP 캐시가 답한다. 주소로 새로 만든다.
      fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
        .then((res) => {
          const copy = res.clone();
          caches.open(V).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || (isDoc ? caches.match('./index.html') : undefined)))
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
