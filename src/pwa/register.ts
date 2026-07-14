// Register the service worker. `updateViaCache: 'none'` tells the browser not to
// serve sw.js itself from the HTTP cache, so a shipped update is discovered
// promptly — the SW then skipWaiting + clients.claim to take over (IDEAS.md §4).
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      /* SW is a progressive enhancement — a failure must never break the app */
    });
  });
}
