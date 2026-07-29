import type { FeedViewPost, PostView } from '../atproto/types.js';
import { HIDE_LABELS, effectiveLabels, postLabelAction, recordEmbedHidden } from '../feed/labels.js';
import type { InclusionEntry } from '../feed/inclusion.js';
import { AuthorFeedClient } from '../atproto/client.js';

/**
 * S7 label-audit — the effectiveness half. Replays the EXACT garden fetch+filter
 * on the sponsor's own device, over public data, and counts what the label floor
 * hid: posts hidden per label per account, plus label-excluded embeds as their
 * own count, with a few examples. Nothing is collected from the explorer's
 * device — this is public getAuthorFeed data, filtered the same way the garden
 * filters it (§S7).
 */

export interface AuditExample {
  uri: string;
  actor: string;
  text: string;
  labels: string[];
}

export interface AccountAudit {
  actor: string;
  displayName: string;
  fetched: number;
  hidden: number;
  byLabel: Record<string, number>;
  examples: AuditExample[];
}

export interface AuditResult {
  perAccount: AccountAudit[];
  totalFetched: number;
  totalHidden: number;
  byLabel: Record<string, number>;
  embedExclusions: { count: number; examples: AuditExample[] };
}

const MAX_EXAMPLES = 5;

function hideLabelsOn(post: PostView): string[] {
  return effectiveLabels(post).filter((v) => HIDE_LABELS.has(v));
}

/** Pure: given each account's fetched feed, count what the label floor removes. */
export function auditGarden(feeds: { entry: InclusionEntry; feed: FeedViewPost[] }[]): AuditResult {
  const perAccount: AccountAudit[] = [];
  const totalByLabel: Record<string, number> = {};
  let totalFetched = 0;
  let totalHidden = 0;
  const embedExamples: AuditExample[] = [];
  let embedCount = 0;

  for (const { entry, feed } of feeds) {
    const acct: AccountAudit = {
      actor: entry.actor,
      displayName: entry.displayName,
      fetched: feed.length,
      hidden: 0,
      byLabel: {},
      examples: [],
    };
    totalFetched += feed.length;

    for (const item of feed) {
      const post = item.post;
      if (!post) continue;
      const hides = hideLabelsOn(post);
      if (hides.length > 0 && postLabelAction(post) === 'hide') {
        acct.hidden++;
        totalHidden++;
        for (const label of hides) {
          acct.byLabel[label] = (acct.byLabel[label] ?? 0) + 1;
          totalByLabel[label] = (totalByLabel[label] ?? 0) + 1;
        }
        if (acct.examples.length < MAX_EXAMPLES) {
          acct.examples.push({ uri: post.uri, actor: entry.actor, text: post.record.text ?? '', labels: hides });
        }
      } else if (recordEmbedHidden(embedRecord(post))) {
        // The post itself is shown, but its quoted/embedded record is label-floored.
        embedCount++;
        if (embedExamples.length < MAX_EXAMPLES) {
          embedExamples.push({ uri: post.uri, actor: entry.actor, text: post.record.text ?? '', labels: ['(embed)'] });
        }
      }
    }
    perAccount.push(acct);
  }

  return {
    perAccount,
    totalFetched,
    totalHidden,
    byLabel: totalByLabel,
    embedExclusions: { count: embedCount, examples: embedExamples },
  };
}

/** Pull the quoted record view out of a post's embed, if any (record / recordWithMedia). */
function embedRecord(post: PostView): Parameters<typeof recordEmbedHidden>[0] {
  const embed = post.embed;
  if (!embed) return undefined;
  if (embed.$type === 'app.bsky.embed.record#view') {
    return (embed as Extract<typeof embed, { $type: 'app.bsky.embed.record#view' }>).record;
  }
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    return (embed as Extract<typeof embed, { $type: 'app.bsky.embed.recordWithMedia#view' }>).record.record;
  }
  return undefined;
}

/** Fetch each included account's feed and audit it. Public reads only. */
export async function fetchAudit(
  inclusion: InclusionEntry[],
  opts: { client?: AuthorFeedClient; perAuthor?: number } = {},
): Promise<AuditResult> {
  const client = opts.client ?? new AuthorFeedClient();
  const perAuthor = opts.perAuthor ?? 40;
  const settled = await Promise.allSettled(
    inclusion.map((entry) =>
      client.collectAuthorFeed(entry.actor, { maxPosts: perAuthor }).then((feed) => ({ entry, feed })),
    ),
  );
  const feeds = settled
    .filter((r): r is PromiseFulfilledResult<{ entry: InclusionEntry; feed: FeedViewPost[] }> => r.status === 'fulfilled')
    .map((r) => r.value);
  return auditGarden(feeds);
}

/** What Bluebird does with each label it acts on (its own honest descriptions). */
export const LABEL_MEANINGS: { value: string; description: string; action: string }[] = [
  { value: 'porn', description: 'Adult sexual content.', action: 'Hidden from the garden entirely.' },
  { value: 'sexual', description: 'Sexually suggestive content.', action: 'Hidden from the garden entirely.' },
  { value: 'nudity', description: 'Non-sexual or artistic nudity.', action: 'Hidden from the garden entirely.' },
  { value: 'sexual-figurative', description: 'Drawn or figurative sexual content.', action: 'Hidden from the garden entirely.' },
  { value: 'graphic-media', description: 'Graphic or disturbing media.', action: 'Hidden from the garden entirely.' },
  { value: 'gore', description: 'Gore and extreme violence.', action: 'Hidden from the garden entirely.' },
  { value: 'self-harm', description: 'Self-harm content.', action: 'Hidden from the garden entirely.' },
  { value: 'torture', description: 'Torture.', action: 'Hidden from the garden entirely.' },
  { value: 'corpse', description: 'Depictions of death.', action: 'Hidden from the garden entirely.' },
  { value: '!hide', description: 'A moderation service asked to hide this.', action: 'Hidden from the garden entirely.' },
  { value: '!takedown', description: 'A moderation service took this down.', action: 'Hidden from the garden entirely.' },
  { value: '!warn', description: 'A moderation service warned on this.', action: 'Hidden from the garden entirely.' },
];
