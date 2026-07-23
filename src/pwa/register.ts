// Register the service worker. `updateViaCache: 'none'` tells the browser not to
// serve sw.js itself from the HTTP cache, so a shipped update is discovered
// promptly — the SW then skipWaiting + clients.claim to take over (IDEAS.md §4).
import { log } from '../log';

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    // Relative so the scope is the deploy directory (root today, a /pr-preview/
    // subpath for planned previews).
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(
      (reg) => log.info('sw registered', reg.scope),
      // SW is a progressive enhancement — a failure must never break the app, but
      // it should be diagnosable from the console rather than swallowed silently.
      (err) => log.warn('sw registration failed', err),
    );
  });
}
