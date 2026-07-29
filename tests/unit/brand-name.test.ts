import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// RUN-BLUEBIRD: the installed PWA identity is Bluebird.
describe('manifest brand identity', () => {
  const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8')) as {
    name: string;
    short_name: string;
  };

  it('name is Bluebird', () => {
    expect(manifest.name).toBe('Bluebird');
  });

  it('short_name is Bluebird', () => {
    expect(manifest.short_name).toBe('Bluebird');
  });
});
