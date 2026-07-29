import { describe, it, expect } from 'vitest';
import { bluebirdVersion } from '../../src/version.js';

describe('bluebirdVersion', () => {
  it('returns a non-empty stamp', () => {
    expect(bluebirdVersion()).toBeTruthy();
  });

  it('falls back to the dev sentinel when no build version is injected', () => {
    // Unit tests run un-bundled, so __BLUEBIRD_VERSION__ is never defined.
    expect(bluebirdVersion()).toBe('v1 0.1.0+dev');
  });

  it('is stamped with the v1 major line', () => {
    expect(bluebirdVersion()).toMatch(/^v1 /);
  });
});
