import type { AuthorFeedResponse, PostView, RecordEmbedView } from '../../src/atproto/types.js';

// Fixtures for the §3 embed invariants: labeled-embed-never-renders and
// navigation-wall-blocks-embed-browsing. Kept separate from authorFeed.ts so the
// main garden spec's counts stay stable — each e2e spec supplies its own mock.

function base(rkey: string, text: string, createdAt: string): PostView {
  return {
    uri: `at://did:plc:bskyapp/app.bsky.feed.post/${rkey}`,
    cid: `cid-${rkey}`,
    author: { did: 'did:plc:bskyapp', handle: 'bsky.app', displayName: 'Bluesky' },
    record: { $type: 'app.bsky.feed.post', text, createdAt },
    indexedAt: createdAt,
  };
}

function quotedRecord(labels?: RecordEmbedView['labels'], authorLabels?: PostView['labels']): RecordEmbedView {
  return {
    $type: 'app.bsky.embed.record#viewRecord',
    uri: 'at://did:plc:outsider/app.bsky.feed.post/q',
    author: {
      did: 'did:plc:outsider',
      handle: 'outsider.test',
      displayName: 'Outside Author',
      ...(authorLabels ? { labels: authorLabels } : {}),
    },
    value: { $type: 'app.bsky.feed.post', text: 'QUOTED-EMBED-BODY', createdAt: '2026-07-14T08:00:00.000Z' },
    ...(labels ? { labels } : {}),
  };
}

// A post quoting a CLEAN outside record — quote renders inline; the author label
// is inert (navigation wall). Newest so it sorts first.
const CLEAN_QUOTE: PostView = {
  ...base('cq', 'Look at this GARDEN-POST-CLEAN', '2026-07-14T12:00:00.000Z'),
  embed: { $type: 'app.bsky.embed.record#view', record: quotedRecord() },
};

// A post quoting a LABELED outside record — post renders, quote block absent.
const LABELED_QUOTE: PostView = {
  ...base('lq', 'Text GARDEN-POST-LABELEDQUOTE around a bad quote', '2026-07-14T11:00:00.000Z'),
  embed: { $type: 'app.bsky.embed.record#view', record: quotedRecord([{ val: 'porn', src: 'did:plc:mod' }]) },
};

// A post quoting an outside author who is themselves labeled — quote absent.
const LABELED_AUTHOR_QUOTE: PostView = {
  ...base('laq', 'Text GARDEN-POST-LABELEDAUTHOR here', '2026-07-14T10:00:00.000Z'),
  embed: { $type: 'app.bsky.embed.record#view', record: quotedRecord(undefined, [{ val: '!takedown' }]) },
};

export const EMBED_FIXTURE_FEEDS: Record<string, AuthorFeedResponse> = {
  'bsky.app': { feed: [{ post: CLEAN_QUOTE }, { post: LABELED_QUOTE }, { post: LABELED_AUTHOR_QUOTE }] },
  'atproto.com': { feed: [] },
  'safety.bsky.app': { feed: [] },
};
