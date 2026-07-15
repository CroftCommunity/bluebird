import { installTheme } from '../brand/theme.js';
import { skyliteVersion } from '../version.js';
import { el, clear } from '../render/dom.js';
import { registerServiceWorker } from '../pwa/register.js';
import { AuthorFeedClient } from '../atproto/client.js';
import { renderPost, markSavedPosts } from '../render/post.js';
import { filterByLabels } from '../feed/labels.js';
import { savedUris } from '../saves/store.js';

/**
 * §B3 post-view page (`/post.html?uri=at://…`). Renders one post in full — the
 * destination of a shared Skylite permalink, and of tapping a saved post. It is
 * a PUBLIC, unauthenticated read (app.bsky.feed.getPosts): no account, no
 * session. The **label floor** still applies (labels.ts names post-view
 * explicitly): a label-bearing post is EXCLUDED here exactly as in the garden —
 * shown as "not available", never revealed. No counts, like everywhere.
 */

const AT_URI = /^at:\/\/(did:[a-z0-9:%._-]+|[a-z0-9.-]+)\/app\.bsky\.feed\.post\/[A-Za-z0-9._~-]+$/i;

function status(root: HTMLElement, text: string, kind: string): void {
  clear(root);
  root.append(el('p', { class: 'garden__status', 'data-post-status': kind }, [text]));
}

async function render(root: HTMLElement, client: AuthorFeedClient, uri: string): Promise<void> {
  status(root, 'Opening the post…', 'loading');
  try {
    const { posts } = await client.getPosts([uri]);
    const visible = filterByLabels(posts);
    const post = visible[0];
    if (!post) {
      // Either not found, or removed by the label floor — one calm message.
      status(root, "This post isn't available.", 'unavailable');
      return;
    }
    clear(root);
    const list = el('div', { class: 'garden__list', 'data-garden-list': 'true' }, [renderPost(post)]);
    root.append(list);
    void savedUris().then((set) => markSavedPosts(root, set));
  } catch {
    status(root, "Couldn't reach the sky. Try again in a little while.", 'error');
  }
}

function boot(): void {
  installTheme();
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();
  registerServiceWorker();

  const root = document.querySelector<HTMLElement>('[data-post-view]');
  if (!root) return;

  const uri = new URLSearchParams(location.search).get('uri') ?? '';
  if (!AT_URI.test(uri)) {
    status(root, 'No post to show.', 'empty');
    return;
  }
  void render(root, new AuthorFeedClient(), uri);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
