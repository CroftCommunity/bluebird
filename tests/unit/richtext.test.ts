import { describe, it, expect } from 'vitest';
import { segmentRichText } from '../../src/feed/richtext.js';
import type { Facet } from '../../src/atproto/types.js';

describe('segmentRichText', () => {
  it('returns a single text run when there are no facets', () => {
    expect(segmentRichText('hello world', undefined)).toEqual([
      { kind: 'text', text: 'hello world' },
    ]);
  });

  it('returns empty for empty text', () => {
    expect(segmentRichText('', undefined)).toEqual([]);
  });

  it('splits a link facet out of surrounding text (ASCII offsets)', () => {
    // "go to " = 6 bytes, "site" = 4 bytes → [6,10)
    const facets: Facet[] = [
      {
        index: { byteStart: 6, byteEnd: 10 },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://ex.com' }],
      },
    ];
    expect(segmentRichText('go to site now', facets)).toEqual([
      { kind: 'text', text: 'go to ' },
      { kind: 'link', text: 'site', uri: 'https://ex.com' },
      { kind: 'text', text: ' now' },
    ]);
  });

  it('uses UTF-8 byte offsets, not JS string indices (emoji-safe)', () => {
    // "hi 😀 " → 'h'(1)'i'(1)' '(1)'😀'(4)' '(1) = 8 bytes; "link" at [8,12)
    const text = 'hi 😀 link';
    const facets: Facet[] = [
      {
        index: { byteStart: 8, byteEnd: 12 },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://ex.com' }],
      },
    ];
    expect(segmentRichText(text, facets)).toEqual([
      { kind: 'text', text: 'hi 😀 ' },
      { kind: 'link', text: 'link', uri: 'https://ex.com' },
    ]);
  });

  it('classifies mentions and tags', () => {
    // "hey " = 4 bytes; "@bob" [4,8); " " [8,9]; "#art" [9,13)
    const text = 'hey @bob #art';
    const facets: Facet[] = [
      {
        index: { byteStart: 4, byteEnd: 8 },
        features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:bob' }],
      },
      {
        index: { byteStart: 9, byteEnd: 13 },
        features: [{ $type: 'app.bsky.richtext.facet#tag', tag: 'art' }],
      },
    ];
    expect(segmentRichText(text, facets)).toEqual([
      { kind: 'text', text: 'hey ' },
      { kind: 'mention', text: '@bob', did: 'did:plc:bob' },
      { kind: 'text', text: ' ' },
      { kind: 'tag', text: '#art', tag: 'art' },
    ]);
  });

  it('drops out-of-range facets and keeps text intact', () => {
    const facets: Facet[] = [{ index: { byteStart: 100, byteEnd: 200 }, features: [] }];
    expect(segmentRichText('short', facets)).toEqual([{ kind: 'text', text: 'short' }]);
  });

  it('resolves overlapping facets greedily without dropping text', () => {
    const facets: Facet[] = [
      {
        index: { byteStart: 0, byteEnd: 5 },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://a' }],
      },
      // Overlaps the first facet — must be skipped, not corrupt the output.
      {
        index: { byteStart: 3, byteEnd: 8 },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://b' }],
      },
    ];
    const segs = segmentRichText('01234567', facets);
    expect(segs[0]).toEqual({ kind: 'link', text: '01234', uri: 'https://a' });
    expect(segs.map((s) => s.text).join('')).toBe('01234567');
  });
});
