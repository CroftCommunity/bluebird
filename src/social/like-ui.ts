import { likePost, unlikePost, likedPostUris } from './likes.js';
import { setLikeState, type LikeUi } from '../render/post.js';
import { el } from '../render/dom.js';
import type { OAuthSession } from '../atproto/oauth/client.js';
import type { PostView } from '../atproto/types.js';

/**
 * The garden's like control wiring (B1/B2). Optimistic toggle with revert on
 * failure; when there is no session the heart routes to sign-in instead. Kept
 * out of main so the read path stays legible.
 */

export interface LikeUiDeps {
  getSession: () => OAuthSession | null;
  setSession: (session: OAuthSession) => void;
  requestSignIn: () => void;
  nowIso?: () => string;
}

async function toggle(post: PostView, btn: HTMLButtonElement, deps: LikeUiDeps): Promise<void> {
  const session = deps.getSession();
  if (!session) {
    deps.requestSignIn();
    return;
  }
  const wasLiked = btn.getAttribute('aria-pressed') === 'true';
  setLikeState(btn, !wasLiked); // optimistic
  try {
    if (wasLiked) {
      deps.setSession(await unlikePost(session, post.uri));
    } else {
      const now = deps.nowIso ? deps.nowIso() : new Date().toISOString();
      const { session: next } = await likePost(session, post, now);
      deps.setSession(next);
    }
  } catch {
    setLikeState(btn, wasLiked); // revert on failure
  }
}

export function makeLikeUi(deps: LikeUiDeps): LikeUi {
  return {
    canLike: true,
    hasSession: deps.getSession() !== null,
    isLiked: (uri) => likedPostUris().has(uri),
    onToggle: (post, btn) => void toggle(post, btn, deps),
  };
}

/** The gentle "sharing is on — sign in to add hearts" banner. */
export function explorerSignInBanner(onSignIn: (handle: string) => void): HTMLElement {
  const input = el('input', {
    type: 'text',
    class: 'signin__input',
    placeholder: 'your handle, e.g. you.bsky.social',
    'data-explorer-handle': 'true',
    'aria-label': 'Your Bluesky handle',
  });
  const msg = el('span', { class: 'signin__msg', 'data-explorer-signin-msg': 'true', role: 'status' });
  const btn = el('button', { type: 'button', class: 'signin__btn', 'data-explorer-signin': 'true' }, [
    'Sign in to add hearts',
  ]);
  btn.addEventListener('click', () => {
    if (!input.value.trim()) {
      msg.textContent = 'Enter your handle.';
      return;
    }
    msg.textContent = 'Redirecting to Bluesky…';
    onSignIn(input.value);
  });
  return el('div', { class: 'banner signin', 'data-explorer-signin-banner': 'true' }, [
    el('span', { class: 'banner__glyph', 'aria-hidden': 'true' }, ['♡']),
    el('div', { class: 'signin__body' }, [
      el('p', { class: 'signin__lede' }, ['Sharing is on. Sign in to add hearts your friends can see.']),
      el('div', { class: 'signin__row' }, [input, btn]),
      msg,
    ]),
  ]);
}
