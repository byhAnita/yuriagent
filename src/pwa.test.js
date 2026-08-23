/**
 * The PWA, asserted against the files rather than the browser.
 *
 * Everything here is a deploy-day bug: it works perfectly in `npm run dev` and
 * fails the first time the app is served from anywhere other than a domain
 * root, or opened on an actual phone. That is exactly the class of thing worth
 * a test, because nobody finds it by playing.
 *
 * rv-simulator hit the base-path half of this and settled on `base: './'`.
 * These assertions are that lesson, plus the iOS safe-area half it did not
 * need (it never set `viewport-fit=cover`).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const html = read('index.html');
const css = read('src/index.css');
const viteConfig = read('vite.config.js');
const sw = read('public/sw.js');
const manifest = JSON.parse(read('public/manifest.webmanifest'));

describe('it can be served from a subpath', () => {
  /**
   * The default base is '/', which assumes the app owns the domain root.
   * GitHub Pages serves a project site from '/<repo>/', so every absolute
   * asset URL 404s and the page is blank with a console full of errors.
   */
  it('builds with a relative base', () => {
    expect(viteConfig).toMatch(/base:\s*process\.env\.BASE_URL\s*\?\?\s*'\.\/'/);
  });

  it('references the manifest and the favicon relatively', () => {
    const hrefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    const local = hrefs.filter((h) => !h.startsWith('http') && !h.startsWith('/src/'));

    expect(local.length).toBeGreaterThan(0);
    for (const href of local) {
      expect(href.startsWith('./'), href).toBe(true);
    }
  });

  it('keeps every manifest path relative too', () => {
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('./'), icon.src).toBe(true);
    }
  });
});

describe('it installs like an app on a phone', () => {
  it('declares what a home-screen launch needs', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait');
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
  });

  it('ships the icon sizes Android asks for, including a maskable one', () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('asks iOS for the full screen', () => {
    expect(html).toMatch(/name="apple-mobile-web-app-capable"\s+content="yes"/);
    expect(html).toMatch(/name="mobile-web-app-capable"\s+content="yes"/);
    expect(html).toMatch(/name="apple-mobile-web-app-status-bar-style"/);
    expect(html).toMatch(/viewport-fit=cover/);
  });

  /**
   * The pair above is what makes the app fill the screen instead of sitting in
   * a letterboxed frame - and the price is that the web view draws UNDERNEATH
   * the iOS status bar and the home indicator. Without insets the day header
   * sits behind the clock and the chip bar behind the gesture bar, on every
   * iPhone, in the one mode the game is designed for. Android needs it on any
   * device with a cutout.
   */
  it('pays for it with safe-area insets', () => {
    expect(css).toContain('env(safe-area-inset-top');
    expect(css).toContain('env(safe-area-inset-bottom');
    expect(css).toMatch(/padding:\s*var\(--safe-top\)/);
    // The full-height rules have to subtract what the body just padded, or the
    // last row is pushed off the bottom by the height of the notch.
    expect(css).toMatch(/min-height:\s*calc\(100dvh - var\(--safe-top\) - var\(--safe-bottom\)\)/);
    expect(css).toMatch(/height:\s*calc\(100dvh - var\(--safe-top\) - var\(--safe-bottom\)\)/);
  });
});

describe('the service worker', () => {
  it('serves navigations network first, so a new build is picked up', () => {
    expect(sw).toContain('networkFirst');
    expect(sw).toMatch(/request\.mode === 'navigate'/);
  });

  it('serves hashed assets cache first, because they cannot change', () => {
    expect(sw).toContain('cacheFirst');
  });

  /**
   * Section 22. Model traffic is a cross-origin POST carrying the player's
   * prompt and it has no business surviving on disk, so the worker refuses
   * anything that is not a GET from a host it knows.
   */
  it('caches nothing but GETs from hosts it knows', () => {
    expect(sw).toMatch(/request\.method !== 'GET'/);
    expect(sw).toContain('self.location.origin');
    expect(sw).toContain('FONT_HOSTS');
  });

  it('purges its old caches on activate', () => {
    expect(sw).toContain('caches.delete');
    expect(sw).toContain('skipWaiting');
    expect(sw).toContain('clients.claim');
  });
});
