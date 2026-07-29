import type { Label, PostView, RecordEmbedView } from '../atproto/types.js';

/**
 * The **label floor** (BLUEBIRD-DIRECTIVES §3): label-bearing posts are EXCLUDED
 * (not blurred) everywhere — garden, My Sky, Telescope, embeds, post-view. This
 * is the cheap, real, no-server part of the safety stance. The inclusion list is
 * the primary ceiling; the label floor is the backstop for when an approved (or,
 * via a repost/quote, an outside) account carries a labeled item.
 *
 * We HIDE rather than blur-with-reveal: a "tap to reveal" control is a decoy door
 * in a walled garden. There is no reveal.
 */

export type LabelAction = 'show' | 'hide';

/** Label values that remove a post (or embed) from view entirely. */
export const HIDE_LABELS: ReadonlySet<string> = new Set([
  // Adult / sexual.
  'porn',
  'sexual',
  'nudity',
  'sexual-figurative',
  // Violence / graphic.
  'graphic-media',
  'gore',
  'self-harm',
  'torture',
  'corpse',
  // System-level moderation actions.
  '!hide',
  '!takedown',
  '!warn',
]);

/** Effective (non-negated) label values from a list. */
function values(labels: Label[] | undefined): string[] {
  return (labels ?? []).filter((l) => !l.neg).map((l) => l.val);
}

/** Does any non-negated label in the list fall under the hide floor? */
export function labelsHide(labels: Label[] | undefined): boolean {
  return values(labels).some((v) => HIDE_LABELS.has(v));
}

/** Effective (non-negated) label values on a post plus its author. */
export function effectiveLabels(post: PostView): string[] {
  return [...values(post.labels), ...values(post.author.labels)];
}

export function postLabelAction(post: PostView): LabelAction {
  return effectiveLabels(post).some((v) => HIDE_LABELS.has(v)) ? 'hide' : 'show';
}

/** Convenience: keep only the posts that pass the label floor. */
export function filterByLabels(posts: PostView[]): PostView[] {
  return posts.filter((p) => postLabelAction(p) === 'show');
}

/**
 * The label floor applied to a QUOTED/EMBEDDED record. Labels attach to the
 * embedded record view (rec.labels) and/or its author (rec.author.labels). A
 * label-floored embed must never render — the `labeled-embed-never-renders`
 * invariant. Returns true when the embed must be dropped.
 */
export function recordEmbedHidden(rec: RecordEmbedView | undefined): boolean {
  if (!rec) return false;
  return labelsHide(rec.labels) || labelsHide(rec.author?.labels);
}
