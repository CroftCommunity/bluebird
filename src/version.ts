// The build injects the real version string via esbuild `define`. In non-bundled
// contexts (unit tests, type-checking) it falls back to a stable dev sentinel so
// nothing that reads the version has to special-case an undefined global.
declare const __BLUEBIRD_VERSION__: string | undefined;

/**
 * A human-readable build stamp, e.g. `v1 0.1.0+a1b2c3d`.
 *
 * Bluebird is a safety tool: a lingering stale service-worker build can strand a
 * explorer on code whose pause switch / patches are not live (IDEAS.md §4). The
 * version stamp is the visible proof of which build is actually running, so it
 * is wired in from the very first scaffold and asserted in e2e.
 */
export function bluebirdVersion(): string {
  const injected = typeof __BLUEBIRD_VERSION__ === 'string' ? __BLUEBIRD_VERSION__ : undefined;
  return injected ?? 'v1 0.1.0+dev';
}
