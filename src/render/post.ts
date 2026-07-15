import type { EmbedView, ImageView, PostView, RecordEmbedView } from '../atproto/types.js';
import { segmentRichText, type Segment } from '../feed/richtext.js';
import { el } from './dom.js';
import { relativeTime } from './time.js';
import { showLeaveInterstitial } from './interstitial.js';
import { recordEmbedHidden } from '../feed/labels.js';
import { clipFromPost } from '../saves/clip.js';
import { saveClip, removeClip } from '../saves/store.js';
import { friendHeartsSentence } from '../social/friends-hearts.js';

function setSaveState(btn: HTMLButtonElement, saved: boolean): void {
  btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
  btn.textContent = saved ? '★ Saved' : '☆ Save';
  btn.classList.toggle('post__save--on', saved);
}

async function toggleSave(post: PostView, btn: HTMLButtonElement): Promise<void> {
  const saved = btn.getAttribute('aria-pressed') === 'true';
  if (saved) {
    await removeClip(post.uri);
    setSaveState(btn, false);
  } else {
    await saveClip(clipFromPost(post, '', Date.now()));
    setSaveState(btn, true);
  }
}

/** Reflect which posts are already in the Saves onto their Save buttons. */
export function markSavedPosts(root: ParentNode, saved: Set<string>): void {
  root.querySelectorAll<HTMLButtonElement>('[data-save-btn]').forEach((btn) => {
    const uri = btn.getAttribute('data-save-btn');
    if (uri && saved.has(uri)) setSaveState(btn, true);
  });
}

/**
 * B2 friends' hearts, patched onto an already-rendered garden (the lurk read is
 * anonymous and can be slow, so the garden paints first and this fills in when
 * the friends' public likes resolve — same after-the-fact pattern as
 * markSavedPosts). Count-free, by name, among friends only.
 */
export function applyFriendHearts(root: ParentNode, byPost: Map<string, string[]>): void {
  root.querySelectorAll<HTMLElement>('[data-post-uri]').forEach((article) => {
    const uri = article.getAttribute('data-post-uri');
    if (!uri) return;
    const names = byPost.get(uri);
    if (article.querySelector('[data-friend-hearts]')) return; // idempotent
    if (!names || names.length === 0) return;
    const line = el('p', { class: 'post__friends', 'data-friend-hearts': 'true' }, [friendHeartsSentence(names)]);
    const footer = article.querySelector('.post__actions');
    if (footer) footer.before(line);
    else article.append(line);
  });
}

/**
 * B1/B2 like control. Shown only when the explorer has an account
 * (`canLike` = capabilities.canPersistLikes = localOnly off). No counts, ever.
 * When there is no valid session (a lapse) the heart degrades to a gentle
 * "sign in to like" — the garden is never affected.
 */
export interface LikeUi {
  canLike: boolean;
  hasSession: boolean;
  isLiked: (uri: string) => boolean;
  onToggle: (post: PostView, btn: HTMLButtonElement) => void;
}

export function setLikeState(btn: HTMLButtonElement, liked: boolean): void {
  btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
  btn.textContent = liked ? '♥ Liked' : '♡ Like';
  btn.classList.toggle('post__like--on', liked);
}

/**
 * Render one post into the garden. Big, bright, high-contrast, and — by
 * construction — no like/repost/reply counts anywhere (anti-compulsion stance,
 * CONCEPT.md §1). Text is facet-segmented; links are gated (D7); media shows alt
 * text and posters. Nothing here can post, reply, or interact.
 */

function domainOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
}

function renderSegment(seg: Segment): Node {
  switch (seg.kind) {
    case 'link': {
      const btn = el('button', { class: 'seg seg--link', type: 'button', 'data-link': seg.uri }, [
        seg.text,
      ]);
      btn.addEventListener('click', () => showLeaveInterstitial(seg.uri));
      return btn;
    }
    case 'tag':
      return el('span', { class: 'seg seg--tag' }, [seg.text]);
    case 'mention':
      // Profiles are not a destination in v1; render inert, styled.
      return el('span', { class: 'seg seg--mention' }, [seg.text]);
    default:
      return document.createTextNode(seg.text);
  }
}

function renderText(post: PostView): HTMLElement | null {
  const segments = segmentRichText(post.record.text ?? '', post.record.facets);
  if (segments.length === 0) return null;
  return el('p', { class: 'post__text' }, segments.map(renderSegment));
}

function renderImages(images: ImageView[]): HTMLElement {
  const grid = el('div', { class: `post__images post__images--${Math.min(images.length, 4)}` });
  for (const img of images) {
    const hasAlt = Boolean(img.alt && img.alt.trim());
    // Each image sits in a figure so an "ALT" badge (bsky-style, §B4 full skin)
    // can overlay it when the image carries alt text — a positive accessibility
    // signal, never a count. The badge is CSS-hidden except in the full skin.
    grid.append(
      el('figure', { class: 'post__image-wrap' }, [
        el('img', {
          class: 'post__image',
          src: img.thumb,
          alt: img.alt || '',
          loading: 'lazy',
          decoding: 'async',
        }),
        hasAlt ? el('span', { class: 'post__alt-badge', 'aria-hidden': 'true' }, ['ALT']) : null,
      ]),
    );
  }
  return grid;
}

function renderVideo(thumbnail: string | undefined, alt: string | undefined): HTMLElement {
  // Playback is out of scope for Phase 1 (the HLS host isn't in the CSP); we show
  // the poster with a clear video marker and alt text.
  const poster = thumbnail
    ? el('img', { class: 'post__video-poster', src: thumbnail, alt: alt || 'Video', loading: 'lazy' })
    : el('div', { class: 'post__video-poster post__video-poster--blank' }, ['Video']);
  return el('div', { class: 'post__video' }, [poster, el('span', { class: 'post__video-badge' }, ['▶ Video'])]);
}

function renderExternal(uri: string, title: string, description: string): HTMLElement {
  // D7: link cards render domain + title only, and are gated on tap.
  const card = el('button', { class: 'post__external', type: 'button', 'data-external': uri }, [
    el('span', { class: 'post__external-domain' }, [domainOf(uri)]),
    title ? el('span', { class: 'post__external-title' }, [title]) : null,
    description ? el('span', { class: 'post__external-desc' }, [description]) : null,
  ]);
  card.addEventListener('click', () => showLeaveInterstitial(uri));
  return card;
}

function renderQuoted(rec: RecordEmbedView): HTMLElement | null {
  // Label floor on embeds (§3): a label-bearing quoted record never renders —
  // the labeled-embed-never-renders invariant. Drop the whole quote block.
  if (recordEmbedHidden(rec)) return null;
  const author = rec.author;
  const text = rec.value?.text;
  if (!author && !text) return null;
  // The navigation wall (§3): a quote renders INLINE but is never a door into
  // casual browsing of the outside author's feed. The author label is inert
  // text (a <span>, never a link/button) — the only deliberate path in is
  // follow-to-My-Sky, added in RUN-DISCOVER.
  return el('div', { class: 'post__quote', 'data-quote': 'true' }, [
    author
      ? el('span', { class: 'post__quote-author', 'data-quote-author': 'true' }, [
          author.displayName || `@${author.handle}`,
        ])
      : null,
    text ? el('p', { class: 'post__quote-text' }, [text]) : null,
  ]);
}

function renderEmbed(embed: EmbedView | undefined): Node | null {
  if (!embed) return null;
  switch (embed.$type) {
    case 'app.bsky.embed.images#view':
      return renderImages((embed as Extract<EmbedView, { $type: 'app.bsky.embed.images#view' }>).images);
    case 'app.bsky.embed.video#view': {
      const v = embed as Extract<EmbedView, { $type: 'app.bsky.embed.video#view' }>;
      return renderVideo(v.thumbnail, v.alt);
    }
    case 'app.bsky.embed.external#view': {
      const e = embed as Extract<EmbedView, { $type: 'app.bsky.embed.external#view' }>;
      return renderExternal(e.external.uri, e.external.title, e.external.description);
    }
    case 'app.bsky.embed.record#view': {
      const r = embed as Extract<EmbedView, { $type: 'app.bsky.embed.record#view' }>;
      return renderQuoted(r.record);
    }
    case 'app.bsky.embed.recordWithMedia#view': {
      const rm = embed as Extract<EmbedView, { $type: 'app.bsky.embed.recordWithMedia#view' }>;
      const frag = document.createDocumentFragment();
      const media = renderEmbed(rm.media);
      if (media) frag.append(media);
      const quoted = renderQuoted(rm.record.record);
      if (quoted) frag.append(quoted);
      return frag.childNodes.length ? frag : null;
    }
    default:
      return null;
  }
}

export function renderPost(
  post: PostView,
  opts: { like?: LikeUi; friendHearts?: Map<string, string[]> } = {},
): HTMLElement {
  const author = post.author;
  const name = author.displayName?.trim() || `@${author.handle}`;

  const avatar = author.avatar
    ? el('img', { class: 'post__avatar', src: author.avatar, alt: '', loading: 'lazy' })
    : el('div', { class: 'post__avatar post__avatar--blank', 'aria-hidden': 'true' }, [
        name.slice(0, 1).toUpperCase(),
      ]);

  const header = el('header', { class: 'post__header' }, [
    avatar,
    el('div', { class: 'post__id' }, [
      el('span', { class: 'post__name' }, [name]),
      el('span', { class: 'post__handle' }, [`@${author.handle}`]),
    ]),
    el('time', { class: 'post__time', datetime: post.record.createdAt }, [
      relativeTime(post.record.createdAt),
    ]),
  ]);

  const article = el('article', { class: 'post', 'data-post-uri': post.uri }, [header]);

  const text = renderText(post);
  if (text) article.append(text);

  const embed = renderEmbed(post.embed);
  if (embed) article.append(embed);

  // B2 friends' hearts — a relational, count-free "Liked by <friends>" line.
  // Sourced from friends' PUBLIC like records (read anonymously), shown only
  // among the sponsor-curated friends and only by name. Never a global count.
  const heartNames = opts.friendHearts?.get(post.uri);
  if (heartNames && heartNames.length > 0) {
    article.append(
      el('p', { class: 'post__friends', 'data-friend-hearts': 'true' }, [friendHeartsSentence(heartNames)]),
    );
  }

  // Save to Saves (D4) — private and local. No like/repost/reply counts, by
  // construction.
  const saveBtn = el('button', {
    class: 'post__save',
    type: 'button',
    'data-save-btn': post.uri,
    'aria-pressed': 'false',
    'aria-label': 'Save to saves',
  });
  setSaveState(saveBtn, false);
  saveBtn.addEventListener('click', () => void toggleSave(post, saveBtn));

  const actions: HTMLElement[] = [saveBtn];

  // B1/B2 heart — only for an account-holding explorer; no counts.
  const like = opts.like;
  if (like?.canLike) {
    const heart = el('button', {
      class: 'post__like',
      type: 'button',
      'data-like-btn': post.uri,
      ...(like.hasSession ? {} : { 'data-like-signedout': 'true' }),
    });
    if (like.hasSession) {
      setLikeState(heart, like.isLiked(post.uri));
    } else {
      heart.textContent = '♡ Sign in to like';
      heart.setAttribute('aria-label', 'Sign in to like');
    }
    heart.addEventListener('click', () => like.onToggle(post, heart));
    actions.unshift(heart);
  }

  article.append(el('footer', { class: 'post__actions' }, actions));

  return article;
}
