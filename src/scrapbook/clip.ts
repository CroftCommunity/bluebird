import type { EmbedView, PostView } from '../atproto/types.js';

/**
 * A saved post. The Scrapbook (D4) is private, local bookmarking in place of
 * like/repost — a kid can clip a post and add a private note ("want to draw this
 * later"). It lives only on the device (IndexedDB); the UI says so plainly.
 */
export interface Clip {
  uri: string;
  authorName: string;
  handle: string;
  text: string;
  thumb?: string;
  note: string;
  savedAt: number;
}

function firstImageThumb(embed: EmbedView | undefined): string | undefined {
  if (!embed) return undefined;
  if (embed.$type === 'app.bsky.embed.images#view') {
    return (embed as Extract<EmbedView, { $type: 'app.bsky.embed.images#view' }>).images[0]?.thumb;
  }
  if (embed.$type === 'app.bsky.embed.video#view') {
    return (embed as Extract<EmbedView, { $type: 'app.bsky.embed.video#view' }>).thumbnail;
  }
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    return firstImageThumb((embed as Extract<EmbedView, { $type: 'app.bsky.embed.recordWithMedia#view' }>).media);
  }
  return undefined;
}

/** Build a Clip from a post view. Pure — the timestamp is passed in. */
export function clipFromPost(post: PostView, note: string, savedAt: number): Clip {
  const author = post.author;
  const thumb = firstImageThumb(post.embed);
  return {
    uri: post.uri,
    authorName: author.displayName?.trim() || `@${author.handle}`,
    handle: author.handle,
    text: post.record.text ?? '',
    ...(thumb ? { thumb } : {}),
    note,
    savedAt,
  };
}
