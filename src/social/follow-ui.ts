import { followActor, unfollowActor, isFollowedLocally } from './follows.js';
import { setFollowState, type FollowUi, type FollowTarget } from '../render/post.js';
import type { OAuthSession } from '../atproto/oauth/client.js';

/**
 * §D1 follow control wiring. Optimistic toggle with revert on failure. Follows
 * are device-local in every mode (My Sky works with no account); when a session
 * is present the follow is ALSO persisted as a record. Unlike the heart, this
 * never routes to sign-in — following works offline/localOnly by design.
 */

export interface FollowUiDeps {
  getSession: () => OAuthSession | null;
  setSession: (session: OAuthSession) => void;
  nowIso?: () => string;
  /** Called after a successful toggle (e.g. to re-render My Sky). */
  onChange?: () => void;
}

async function toggle(target: FollowTarget, btn: HTMLButtonElement, deps: FollowUiDeps): Promise<void> {
  const wasFollowed = btn.getAttribute('aria-pressed') === 'true';
  setFollowState(btn, !wasFollowed); // optimistic
  const session = deps.getSession();
  try {
    if (wasFollowed) {
      const next = await unfollowActor(target.did, session);
      if (next) deps.setSession(next);
    } else {
      const now = deps.nowIso ? deps.nowIso() : new Date().toISOString();
      // Capture the author's name at follow time so My Sky reads by name.
      const next = await followActor(target.did, session, now, { name: target.name });
      if (next) deps.setSession(next);
    }
    deps.onChange?.();
  } catch {
    setFollowState(btn, wasFollowed); // revert on failure (record write failed)
  }
}

export function makeFollowUi(deps: FollowUiDeps): FollowUi {
  return {
    isFollowed: (did) => isFollowedLocally(did),
    onToggle: (target, btn) => void toggle(target, btn, deps),
  };
}
