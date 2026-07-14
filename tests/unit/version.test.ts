import { describe, it, expect } from 'vitest';
import { skyliteVersion } from '../../src/version.js';

describe('skyliteVersion', () => {
  it('returns a non-empty stamp', () => {
    expect(skyliteVersion()).toBeTruthy();
  });

  it('falls back to the dev sentinel when no build version is injected', () => {
    // Unit tests run un-bundled, so __SKYLITE_VERSION__ is never defined.
    expect(skyliteVersion()).toBe('v1 0.1.0+dev');
  });

  it('is stamped with the v1 major line', () => {
    expect(skyliteVersion()).toMatch(/^v1 /);
  });
});
