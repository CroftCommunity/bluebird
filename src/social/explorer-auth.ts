import {
  beginAuthorization,
  completeAuthorization,
  ensureFresh,
  type BeginOptions,
  type OAuthSession,
  type PendingAuth,
} from '../atproto/oauth/client.js';
import { BLUEBIRD_CLIENT_ID } from '../sponsor/oauth.js';
import { LIKE_NSID } from './likes.js';

/**
 * B1 lazy explorer identity. Triggered the first time an explorer's localOnly
 * switch is off and she wants to add a heart. Custody posture 1 (docs/custody.md):
 * the device holds ONLY this scoped session — never the password. The account is
 * created/linked out of band by the sponsor (in-app createAccount + the 13+ age
 * gate are deferred). A lapsed session degrades gently to "ask your sponsor to
 * sign back in"; the garden is never affected.
 */

// Granular scope: create/delete on the explorer's like + follow + (encrypted)
// search-history collections ONLY. The exact atproto scope syntax is a
// verify-in-run item; this is the intent.
export const EXPLORER_SCOPE = `atproto repo:${LIKE_NSID} repo:ing.croft.bluebird.follow repo:ing.croft.bluebird.search`;

const KEY_PENDING = 'bluebird.explorer.oauth.pending';
const KEY_SESSION = 'bluebird.explorer.oauth.session';

function cfg(): { clientId: string; redirectUri: string; scope: string } {
  return { clientId: BLUEBIRD_CLIENT_ID, redirectUri: `${window.location.origin}/`, scope: EXPLORER_SCOPE };
}

function ss(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function getExplorerSession(): OAuthSession | null {
  try {
    const raw = ss()?.getItem(KEY_SESSION);
    return raw ? (JSON.parse(raw) as OAuthSession) : null;
  } catch {
    return null;
  }
}

export function clearExplorerSession(): void {
  ss()?.removeItem(KEY_SESSION);
}

function persist(session: OAuthSession): void {
  ss()?.setItem(KEY_SESSION, JSON.stringify(session));
}

/**
 * Proactive refresh-on-open: keep re-auth rare. Returns a fresh session, or null
 * (clearing the stored one) when the refresh chain has broken — the only time
 * the sponsor is pulled in.
 */
export async function refreshExplorerSessionOnOpen(): Promise<OAuthSession | null> {
  const session = getExplorerSession();
  if (!session) return null;
  try {
    const fresh = await ensureFresh(session);
    persist(fresh);
    return fresh;
  } catch {
    clearExplorerSession();
    return null;
  }
}

/** `target` is a provider entryway (server first) or a handle/DID — the sheet's seam. */
export async function startExplorerSignIn(target: string, options: BeginOptions = {}): Promise<void> {
  const { authorizeUrl, pending } = await beginAuthorization(target.trim(), cfg(), {}, options);
  ss()?.setItem(KEY_PENDING, JSON.stringify(pending));
  window.location.assign(authorizeUrl);
}

/** If this load is an OAuth callback, finish it and persist the scoped session. */
export async function finishExplorerSignInFromUrl(): Promise<OAuthSession | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;

  const raw = ss()?.getItem(KEY_PENDING);
  if (!raw) return null; // not our callback
  const pending = JSON.parse(raw) as PendingAuth;

  const session = await completeAuthorization(pending, { code, state }, cfg());
  persist(session);
  ss()?.removeItem(KEY_PENDING);

  const url = new URL(window.location.href);
  for (const k of ['code', 'state', 'iss']) url.searchParams.delete(k);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return session;
}

export function persistExplorerSession(session: OAuthSession): void {
  persist(session);
}
