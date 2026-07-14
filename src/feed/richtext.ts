import type { Facet, FacetFeature } from '../atproto/types.js';

/**
 * Segment post text into plain + rich runs using ATProto facets. Facet indices
 * are **UTF-8 byte offsets** (app.bsky.richtext.facet), not JS string indices —
 * so we slice on an encoded byte view and decode each run back to a string.
 * Emoji and other astral characters are why this can't be done on `.slice()`.
 *
 * Pure and deterministic — unit-tested against byte-offset fixtures.
 */

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; uri: string }
  | { kind: 'mention'; text: string; did: string }
  | { kind: 'tag'; text: string; tag: string };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Pick the run kind from a facet's features (link > mention > tag). */
function classify(text: string, features: FacetFeature[]): Segment {
  for (const f of features) {
    if (f.$type === 'app.bsky.richtext.facet#link' && typeof f.uri === 'string') {
      return { kind: 'link', text, uri: f.uri };
    }
  }
  for (const f of features) {
    if (f.$type === 'app.bsky.richtext.facet#mention' && typeof f.did === 'string') {
      return { kind: 'mention', text, did: f.did };
    }
  }
  for (const f of features) {
    if (f.$type === 'app.bsky.richtext.facet#tag' && typeof f.tag === 'string') {
      return { kind: 'tag', text, tag: f.tag };
    }
  }
  return { kind: 'text', text };
}

export function segmentRichText(text: string, facets: Facet[] | undefined): Segment[] {
  const bytes = encoder.encode(text);
  if (!facets || facets.length === 0) {
    return text.length ? [{ kind: 'text', text }] : [];
  }

  // Keep only well-formed, in-range facets, then order by start. Overlapping
  // facets are resolved greedily (a later facet starting before the cursor is
  // dropped) so the output is always a clean, non-overlapping partition.
  const clean = facets
    .filter(
      (f) =>
        f.index &&
        Number.isInteger(f.index.byteStart) &&
        Number.isInteger(f.index.byteEnd) &&
        f.index.byteStart >= 0 &&
        f.index.byteEnd <= bytes.length &&
        f.index.byteStart < f.index.byteEnd,
    )
    .sort((a, b) => a.index.byteStart - b.index.byteStart);

  const out: Segment[] = [];
  const pushText = (slice: Uint8Array): void => {
    if (slice.length === 0) return;
    out.push({ kind: 'text', text: decoder.decode(slice) });
  };

  let cursor = 0;
  for (const facet of clean) {
    const { byteStart, byteEnd } = facet.index;
    if (byteStart < cursor) continue; // overlaps a facet we already emitted
    pushText(bytes.subarray(cursor, byteStart));
    const runText = decoder.decode(bytes.subarray(byteStart, byteEnd));
    out.push(classify(runText, facet.features ?? []));
    cursor = byteEnd;
  }
  pushText(bytes.subarray(cursor));
  return out;
}
