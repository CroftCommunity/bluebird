// Minimal structural types for the slice of `app.bsky.feed.getAuthorFeed` that
// Bluebird reads. Grounded against the getAuthorFeed lexicon + the embed/richtext
// lexicons (bluesky-social/atproto). We model only what the garden renders; the
// AppView sends more fields, which we ignore. Everything optional is genuinely
// optional in the wire format.

/** A moderation label attached to a post or actor (app.bsky.label). */
export interface Label {
  val: string;
  src?: string;
  uri?: string;
  neg?: boolean;
}

export interface ProfileViewBasic {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  labels?: Label[];
}

/** app.bsky.richtext.facet — byte-indexed rich-text ranges over the UTF-8 text. */
export interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: FacetFeature[];
}

export type FacetFeature =
  | { $type: 'app.bsky.richtext.facet#link'; uri: string }
  | { $type: 'app.bsky.richtext.facet#mention'; did: string }
  | { $type: 'app.bsky.richtext.facet#tag'; tag: string }
  | { $type: string; [k: string]: unknown };

/** app.bsky.feed.post record (the authored content). */
export interface PostRecord {
  $type?: 'app.bsky.feed.post';
  text: string;
  createdAt: string;
  facets?: Facet[];
  langs?: string[];
}

export interface ImageView {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: { width: number; height: number };
}

export interface ExternalView {
  uri: string;
  title: string;
  description: string;
  thumb?: string;
}

export type EmbedView =
  | { $type: 'app.bsky.embed.images#view'; images: ImageView[] }
  | { $type: 'app.bsky.embed.external#view'; external: ExternalView }
  | {
      $type: 'app.bsky.embed.video#view';
      playlist: string;
      thumbnail?: string;
      alt?: string;
      aspectRatio?: { width: number; height: number };
    }
  | { $type: 'app.bsky.embed.record#view'; record: RecordEmbedView }
  | {
      $type: 'app.bsky.embed.recordWithMedia#view';
      record: { record: RecordEmbedView };
      media: EmbedView;
    }
  | { $type: string; [k: string]: unknown };

/** The inner view of a quoted record (only the readable shape we surface). */
export interface RecordEmbedView {
  $type?: string;
  uri?: string;
  author?: ProfileViewBasic;
  value?: PostRecord;
  labels?: Label[];
}

export interface PostView {
  uri: string;
  cid: string;
  author: ProfileViewBasic;
  record: PostRecord;
  embed?: EmbedView;
  labels?: Label[];
  indexedAt: string;
}

export interface ReasonRepost {
  $type: 'app.bsky.feed.defs#reasonRepost';
  by: ProfileViewBasic;
  indexedAt?: string;
}

export interface FeedViewPost {
  post: PostView;
  reason?: ReasonRepost | { $type: string; [k: string]: unknown };
  reply?: unknown;
}

export interface AuthorFeedResponse {
  cursor?: string;
  feed: FeedViewPost[];
}
