import type { Label, PostView } from '../atproto/types.js';

/**
 * D3 — honor ATProto moderation labels already present on post/author views.
 * This is the cheap, real, no-server part of the safety stance (the AI
 * "Sky-Shield" layer is explicitly out of v1). The inclusion list is the primary
 * ceiling; labels are the backstop for when an approved account posts something
 * that got labeled.
 *
 * For a child's garden we HIDE rather than blur-with-reveal: a "tap to reveal"
 * control is a decoy door in a walled garden, and reveal is exactly the wrong
 * affordance here. There is no reveal in v1.
 */

export type LabelAction = 'show' | 'hide';

/** Label values that remove a post from the garden entirely. */
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

/** Effective (non-negated) label values on a post plus its author. */
export function effectiveLabels(post: PostView): string[] {
  const collect = (labels: Label[] | undefined): string[] =>
    (labels ?? []).filter((l) => !l.neg).map((l) => l.val);
  return [...collect(post.labels), ...collect(post.author.labels)];
}

export function postLabelAction(post: PostView): LabelAction {
  return effectiveLabels(post).some((v) => HIDE_LABELS.has(v)) ? 'hide' : 'show';
}

/** Convenience: keep only the posts that pass the label backstop. */
export function filterByLabels(posts: PostView[]): PostView[] {
  return posts.filter((p) => postLabelAction(p) === 'show');
}
