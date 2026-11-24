/**
 * Service worker — makes the hub installable and fully playable offline.
 *
 * Strategy
 *  - On install, pre-cache the whole app shell (everything is tiny).
 *  - Navigations: network first (fresh deploys show up), cache fallback.
 *  - Everything else: cache first, then network (and cache the result).
 *
 * Bump CACHE_VERSION whenever you deploy changes to cached files.
 */
const CACHE_VERSION = 'pixelhub-v2.0.2';

const PRECACHE = [
  './',
  './index.html',
  './play.html',
  './manifest.json',
  './css/style.css',
  './js/catalog.js',
  './js/main.js',
  './js/pwa.js',
  './js/shell.js',
  './js/village.js',
  './js/wfc.js',
  './js/art/village-art.js',
  './js/arcade/blocks.js',
  './js/arcade/board.js',
  './js/arcade/bricks.js',
  './js/arcade/catcher.js',
  './js/arcade/cave.js',
  './js/arcade/cycles.js',
  './js/arcade/flap.js',
  './js/arcade/gridpuzzles.js',
  './js/arcade/hopland.js',
  './js/arcade/hopper.js',
  './js/arcade/invaders.js',
  './js/arcade/kit.js',
  './js/arcade/lander.js',
  './js/arcade/logic.js',
  './js/arcade/maze.js',
  './js/arcade/merge.js',
  './js/arcade/mines.js',
  './js/arcade/missile.js',
  './js/arcade/muncher.js',
  './js/arcade/nibbles.js',
  './js/arcade/pong.js',
  './js/arcade/racer.js',
  './js/arcade/rocks.js',
  './js/arcade/runner.js',
  './js/arcade/sokoban.js',
  './js/arcade/stacker.js',
  './js/arcade/tiles.js',
  './js/arcade/whack.js',
  './js/core/audio.js',
  './js/core/fx.js',
  './js/core/input.js',
  './js/core/pixeltext.js',
  './js/core/rng.js',
  './js/core/storage.js',
  './js/games/snake.js',
  './assets/fonts/press-start-2p.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
