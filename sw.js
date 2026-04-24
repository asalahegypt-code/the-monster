// ══════════════════════════════════════════
// THE MONSTER — Service Worker
// يتيح العمل بدون إنترنت ويخزن الملفات محلياً
// ══════════════════════════════════════════

const CACHE_NAME = 'the-monster-v1';
const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ══ التثبيت: تخزين الملفات الأساسية ══
self.addEventListener('install', event => {
  console.log('[SW] Installing THE MONSTER cache...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
        )
      );
    }).then(() => {
      console.log('[SW] Cache ready ✅');
      return self.skipWaiting();
    })
  );
});

// ══ التفعيل: حذف الكاش القديم ══
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ══ الاعتراض: Cache First للملفات المحلية، Network First للـ API ══
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls — لا نحجبها (news, anthropic)
  if (url.hostname === 'api.anthropic.com' ||
      url.pathname.includes('/api/') ||
      event.request.method !== 'GET') {
    return;
  }

  // استراتيجية: Cache First مع Fallback للشبكة
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // في الخلفية: تحديث الكاش
        fetch(event.request).then(response => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
          }
        }).catch(() => {});
        return cached;
      }

      // غير موجود في الكاش — جلب من الشبكة
      return fetch(event.request).then(response => {
        if (!response || !response.ok || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback للصفحة الرئيسية
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ══ رسائل من التطبيق ══
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
