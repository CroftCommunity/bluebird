import {
  beginAuthorization,
  completeAuthorization,
  putRecord,
  ensureFresh,
  type OAuthSession,
  type PendingAuth,
} from '../atproto/oauth/client.js';
import { SKYLITE_CONFIG_NSID } from '../config/types.js';
import type { SkyliteConfig } from '../config/types.js';

/**
 * Sponsor-side OAuth glue. Bluesky OAuth is the ONLY sign-in path (app passwords
 * are rejected everywhere, §S2). Tokens live in sessionStorage — ephemeral,
 * per-tab, never written to disk — and the flow's pending state survives the
 * authorization redirect there too.
 *
 * The base scope `atproto transition:generic` is used today; narrowing to a
 * per-collection grant (limited to ing.croft.skylite.config) is the documented
 * verify-in-run item.
 */

export const SKYLITE_CLIENT_ID = 'https://skylite.croft.ing/oauth/client-metadata.json';
export const SKYLITE_SCOPE = 'atproto transition:generic';

const KEY_PENDING = 'skylite.oauth.pending';
const KEY_SESSION = 'skylite.oauth.session';
const KEY_HANDLE = 'skylite.oauth.handle';

/** The typed sign-in value, kept only if it's a handle (not a DID), for display. */
function normalizeHandle(handleOrDid: string): string | null {
  const v = handleOrDid.trim().replace(/^@/, '');
  return v && !v.startsWith('did:') ? v : null;
}

function cfg(): { clientId: string; redirectUri: string; scope: string } {
  return { clientId: SKYLITE_CLIENT_ID, redirectUri: `${window.location.origin}/sponsor.html`, scope: SKYLITE_SCOPE };
}

function ss(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function getSession(): OAuthSession | null {
  try {
    const raw = ss()?.getItem(KEY_SESSION);
    return raw ? (JSON.parse(raw) as OAuthSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  ss()?.removeItem(KEY_SESSION);
}

/** Begin sign-in: PAR, stash the pending state, and hand off to the auth server. */
export async function startSignIn(handleOrDid: string): Promise<void> {
  const { authorizeUrl, pending } = await beginAuthorization(handleOrDid.trim(), cfg());
  ss()?.setItem(KEY_PENDING, JSON.stringify(pending));
  const handle = normalizeHandle(handleOrDid);
  if (handle) ss()?.setItem(KEY_HANDLE, handle);
  else ss()?.removeItem(KEY_HANDLE);
  window.location.assign(authorizeUrl);
}

/** If this load is an OAuth callback, finish it and persist the session. */
export async function finishSignInFromUrl(): Promise<OAuthSession | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;

  const raw = ss()?.getItem(KEY_PENDING);
  if (!raw) throw new Error('No pending sign-in on this device.');
  const pending = JSON.parse(raw) as PendingAuth;

  const base = await completeAuthorization(pending, { code, state }, cfg());
  const handle = ss()?.getItem(KEY_HANDLE)?.trim();
  const session: OAuthSession = handle ? { ...base, handle } : base;
  ss()?.setItem(KEY_SESSION, JSON.stringify(session));
  ss()?.removeItem(KEY_PENDING);
  ss()?.removeItem(KEY_HANDLE);

  // Scrub the OAuth params from the address bar.
  const url = new URL(window.location.href);
  for (const k of ['code', 'state', 'iss']) url.searchParams.delete(k);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return session;
}

/** Publish an explorer's config record into the sponsor's PDS over DPoP. */
export async function publishRecord(session: OAuthSession, rkey: string, record: SkyliteConfig): Promise<string> {
  const fresh = await ensureFresh(session); // proactive refresh so an expired token just works
  const { session: next, uri } = await putRecord(fresh, { collection: SKYLITE_CONFIG_NSID, rkey, record });
  ss()?.setItem(KEY_SESSION, JSON.stringify(next));
  return uri;
}
