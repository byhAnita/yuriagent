/* eslint-env serviceworker */
/**
 * Service worker. CLAUDE.md section 3.
 *
 * Hand-rolled rather than generated, because what this needs is small and the
 * failure modes of getting it wrong are large: a service worker that caches
 * the wrong thing is a game that will not update, and one that caches too
 * little is an installed app that shows a browser error when the train goes
 * into a tunnel.
 *
 * There is no build-time precache manifest. Asset filenames are content
 * hashed, so a hardcoded list would go stale on every build; runtime caching
 * gets the same result with nothing to keep in sync.
 *
 * TWO STRATEGIES, chosen per request and for a reason:
 *
 * - **Navigations: network first.** The HTML names the current hashed bundles,
 *   so serving a stale one pins the player to an old build forever. Falls back
 *   to the cached shell when the network is gone, which is the whole point of
 *   installing it.
 * - **Everything else: cache first.** Hashed assets are immutable by
 *   construction - a changed file has a changed name - so revalidating them is
 *   spent bandwidth. Fonts are the same deal from a different origin.
 *
 * WHAT IS NEVER CACHED: anything that is not a GET, and anything that is not
 * from a host on the list below. That is what keeps model traffic out of the
 * cache - it is a cross-origin POST carrying the player's prompt, and it has no
 * business surviving on disk (section 22).
 */

const VERSION = 'v1';
const SHELL = `yuriagent-shell-${VERSION}`;
const ASSETS = `yuriagent-assets-${VERSION}`;

/** Cross-origin hosts worth keeping. Only the fonts the type scale depends on. */
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const SHELL_URL = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: 'reload' })))
      // A failed precache must not block activation - the fetch handler will
      // fill the cache on first use anyway.
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function cacheable(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin || FONT_HOSTS.includes(url.hostname);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(SHELL);
    cache.put(SHELL_URL, response.clone());
    return response;
  } catch {
    const cached = (await caches.match(SHELL_URL)) ?? (await caches.match(request));
    if (cached) return cached;
    throw new Error('offline and no cached shell');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // Opaque responses (cross-origin fonts) have status 0 and are still worth
  // keeping - that is what makes the installed app look right offline.
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(ASSETS);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!cacheable(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
