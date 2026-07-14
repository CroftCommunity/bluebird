import type {
  AuthorFeedResponse,
  FeedViewPost,
  PostView,
  ProfileViewBasic,
} from '../../src/atproto/types.js';

// Hand-built getAuthorFeed fixtures shared by unit tests and hermetic e2e. Each
// post exercises a specific render/merge/label path; timestamps are fixed so
// ordering assertions are deterministic.

function profile(handle: string, displayName: string): ProfileViewBasic {
  return { did: `did:plc:${handle.replace(/\W/g, '')}`, handle, displayName };
}

function post(p: {
  handle: string;
  displayName: string;
  rkey: string;
  text: string;
  createdAt: string;
  indexedAt?: string;
  extra?: Partial<PostView>;
}): PostView {
  const author = profile(p.handle, p.displayName);
  return {
    uri: `at://${author.did}/app.bsky.feed.post/${p.rkey}`,
    cid: `cid-${p.rkey}`,
    author,
    record: { $type: 'app.bsky.feed.post', text: p.text, createdAt: p.createdAt },
    indexedAt: p.indexedAt ?? p.createdAt,
    ...p.extra,
  };
}

// Author A — bsky.app
const A1 = post({
  handle: 'bsky.app',
  displayName: 'Bluesky',
  rkey: 'a1',
  text: 'Welcome to the sky!',
  createdAt: '2026-07-14T12:00:00.000Z',
});
const A2: PostView = {
  ...post({
    handle: 'bsky.app',
    displayName: 'Bluesky',
    rkey: 'a2',
    text: 'Read more at our site',
    createdAt: '2026-07-14T09:00:00.000Z',
  }),
  record: {
    $type: 'app.bsky.feed.post',
    text: 'Read more at our site',
    createdAt: '2026-07-14T09:00:00.000Z',
    // "Read more at " = 13 bytes; "our site" = 8 bytes → [13,21)
    facets: [
      {
        index: { byteStart: 13, byteEnd: 21 },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://example.com/story' }],
      },
    ],
  },
  embed: {
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: 'https://example.com/story',
      title: 'A Story About Stars',
      description: 'Once upon a time in the night sky.',
    },
  },
};

// Author B — atproto.com
const B1: PostView = {
  ...post({
    handle: 'atproto.com',
    displayName: 'AT Protocol',
    rkey: 'b1',
    text: 'A picture of the moon',
    createdAt: '2026-07-14T11:00:00.000Z',
  }),
  embed: {
    $type: 'app.bsky.embed.images#view',
    images: [
      {
        thumb: 'https://cdn.bsky.app/img/feed_thumbnail/moon.jpg',
        fullsize: 'https://cdn.bsky.app/img/feed_fullsize/moon.jpg',
        alt: 'The crescent moon over a dark sky',
      },
    ],
  },
};
// Newest by time, but carries a hide label — must never render.
const B2_HIDDEN: PostView = {
  ...post({
    handle: 'atproto.com',
    displayName: 'AT Protocol',
    rkey: 'b2',
    text: 'THIS POST MUST BE HIDDEN BY LABELS',
    createdAt: '2026-07-14T13:00:00.000Z',
  }),
  labels: [{ val: 'porn', src: 'did:plc:mod' }],
};

// Author C — safety.bsky.app
const C1 = post({
  handle: 'safety.bsky.app',
  displayName: 'Bluesky Safety',
  rkey: 'c1',
  text: 'Staying safe out here',
  createdAt: '2026-07-14T10:00:00.000Z',
});
// A repost of an excluded author — must be dropped (inclusion ceiling).
const C_REPOST: FeedViewPost = {
  post: post({
    handle: 'stranger.example',
    displayName: 'Stranger',
    rkey: 'x1',
    text: 'REPOSTED CONTENT FROM OUTSIDE THE GARDEN',
    createdAt: '2026-07-14T14:00:00.000Z',
  }),
  reason: {
    $type: 'app.bsky.feed.defs#reasonRepost',
    by: profile('safety.bsky.app', 'Bluesky Safety'),
  },
};

export const FIXTURE_POSTS = { A1, A2, B1, B2_HIDDEN, C1 };

function wrap(posts: PostView[]): FeedViewPost[] {
  return posts.map((p) => ({ post: p }));
}

/** Per-actor getAuthorFeed responses keyed by handle. */
export const FIXTURE_FEEDS: Record<string, AuthorFeedResponse> = {
  'bsky.app': { feed: wrap([A1, A2]) },
  'atproto.com': { feed: wrap([B2_HIDDEN, B1]) },
  'safety.bsky.app': { feed: [...wrap([C1]), C_REPOST] },
};

/** The four posts a correct garden shows, newest-first. */
export const EXPECTED_VISIBLE_ORDER = [A1.uri, B1.uri, C1.uri, A2.uri];
