/**
 * §B3 native share. Sharing is available in EVERY mode (capabilities.canShare is
 * always true — it needs no account). We share the Skylite **permalink** for a
 * post (a static, public-read page on our own origin), NOT the bsky.app URL — so
 * a shared link opens the calm, no-counts, label-floored Skylite view, never the
 * open app. When the Web Share API is unavailable, we fall back to copying the
 * link to the clipboard.
 */

/** The Skylite post-view permalink for an at:// post URI. */
export function postPermalink(uri: string, origin: string = location.origin): string {
  return `${origin}/post.html?uri=${encodeURIComponent(uri)}`;
}

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

export interface ShareDeps {
  /** Injectable for tests; defaults to the platform navigator. Both members
   *  optional so a test can simulate a device lacking share and/or clipboard. */
  nav?: { share?: Navigator['share']; clipboard?: Navigator['clipboard'] };
}

/**
 * Share a post by its permalink. Prefers the native share sheet; otherwise
 * copies the link. Returns what happened so the caller can show gentle feedback.
 * A user-cancelled share sheet ('dismissed') is NOT an error.
 */
export async function sharePost(
  uri: string,
  opts: { title?: string; text?: string; origin?: string } & ShareDeps = {},
): Promise<ShareOutcome> {
  const nav = opts.nav ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  const url = postPermalink(uri, opts.origin);
  const title = opts.title ?? 'Skylite';

  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title, url, ...(opts.text ? { text: opts.text } : {}) });
      return 'shared';
    } catch (err) {
      // The user dismissing the sheet rejects with AbortError — not a failure.
      if (err instanceof DOMException && err.name === 'AbortError') return 'dismissed';
      // fall through to the copy fallback on a real share error
    }
  }

  const clip = nav?.clipboard;
  if (clip && typeof clip.writeText === 'function') {
    try {
      await clip.writeText(url);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  return 'failed';
}
