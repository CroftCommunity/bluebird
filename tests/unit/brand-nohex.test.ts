import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// Raw hex colors may live ONLY in the tokens stylesheet. Component CSS must go
// through semantic custom properties, so themes and contrast are guaranteed by
// the tokens layer alone.

const COMPONENT_CSS = ['styles.css'];

describe('no raw hex in component CSS', () => {
  it.each(COMPONENT_CSS)('%s uses tokens, not raw hex', (file) => {
    if (!existsSync(file)) return;
    const css = readFileSync(file, 'utf8');
    // Strip comments so a hex in a note doesn't trip the guard.
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const hexes = stripped.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexes, `raw hex in ${file}: ${hexes.join(', ')}`).toEqual([]);
  });
});
