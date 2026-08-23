/**
 * Install the service worker. CLAUDE.md sections 3 and 18.
 *
 * Two deliberate choices, both about not breaking things that currently work:
 *
 * **Production only.** A service worker in dev caches the very modules Vite is
 * hot-reloading, so edits stop appearing and the fix looks like "my change did
 * nothing" rather than "something is holding an old file".
 *
 * **A relative URL.** `./sw.js` resolves against the document, so it lands on
 * `/sw.js` at a domain root and `/YuriAgent/sw.js` on a GitHub Pages project
 * site - the same reason `vite.config.js` sets `base: './'`. An absolute
 * `/sw.js` registers nothing on Pages and fails silently, because a failed
 * registration is a rejected promise nobody is awaiting.
 *
 * rv-simulator shipped a manifest and no worker, so it is installable but not
 * playable offline. What this adds is the second half: the shell and the
 * assets survive a dead connection, and with no API key the game is fully
 * playable that way (section 3 treats the offline writer as a supported mode,
 * not a degraded one).
 */

export function registerSW() {
  if (import.meta.env.DEV) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // An unavailable worker is a game that needs a connection, not a broken
      // one. Nothing to tell the player, and nothing to log - section 22 keeps
      // the console clean of anything that runs on every load.
    });
  });
}
