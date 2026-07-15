import type { SkyliteConfig } from '../config/types.js';
import { SKYLITE_CONFIG_NSID, SKYLITE_CONFIG_RKEY_LEGACY } from '../config/types.js';
import { pdsEndpointFromDoc, type DidDocument } from './repo.js';

/**
 * Guardian write path (Phase 2 remainder). The guardian, on their own device,
 * signs in and Skylite writes the config record into their PDS. This uses the
 * legacy identifier + **app-password** session (com.atproto.server.createSession
 * → com.atproto.repo.putRecord) rather than full OAuth: it is verifiable
 * end-to-end and keeps the guardian scope, and the child's device still never
 * authenticates. The password is used only to create the session and is never
 * stored — only the returned tokens live in memory for the page session.
 *
 * App passwords (Settings → App Passwords) are strongly recommended over the
 * main account password; either works.
 */

export const BSKY_ENTRYWAY = 'https://bsky.social';

export interface Session {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  pdsHost: string;
}

export interface WriteOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class WriteError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'WriteError';
    this.code = code;
  }
}

interface CreateSessionResponse {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  didDoc?: DidDocument;
}

interface XrpcError {
  error?: string;
  message?: string;
}

export class WriteClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: WriteOptions = {}) {
    this.baseUrl = opts.baseUrl ?? BSKY_ENTRYWAY;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /** Create a session from an identifier (handle/email) + app password. */
  async createSession(identifier: string, password: string): Promise<Session> {
    const res = await this.fetchImpl(new URL('/xrpc/com.atproto.server.createSession', this.baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = (await res.json()) as CreateSessionResponse & XrpcError;
    if (!res.ok) {
      throw new WriteError(data.message ?? `Sign-in failed (${res.status})`, data.error);
    }
    const pdsHost = (data.didDoc && pdsEndpointFromDoc(data.didDoc)) || this.baseUrl;
    return {
      did: data.did,
      handle: data.handle,
      accessJwt: data.accessJwt,
      refreshJwt: data.refreshJwt,
      pdsHost: pdsHost.replace(/\/+$/, ''),
    };
  }

  /** Put a record into the session's repo. */
  async putRecord(
    session: Session,
    params: { collection: string; rkey: string; record: unknown },
  ): Promise<{ uri: string; cid: string }> {
    const res = await this.fetchImpl(new URL('/xrpc/com.atproto.repo.putRecord', session.pdsHost), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: params.collection,
        rkey: params.rkey,
        record: params.record,
      }),
    });
    const data = (await res.json()) as { uri: string; cid: string } & XrpcError;
    if (!res.ok) {
      throw new WriteError(data.message ?? `Publish failed (${res.status})`, data.error);
    }
    return { uri: data.uri, cid: data.cid };
  }

  /** Sign in and publish the Skylite config to the guardian's repo. */
  async publishConfig(
    identifier: string,
    password: string,
    config: SkyliteConfig,
  ): Promise<{ session: Session; uri: string }> {
    const session = await this.createSession(identifier, password);
    const record = { ...config, $type: SKYLITE_CONFIG_NSID, updatedAt: config.updatedAt || new Date().toISOString() };
    const { uri } = await this.putRecord(session, {
      collection: SKYLITE_CONFIG_NSID,
      rkey: SKYLITE_CONFIG_RKEY_LEGACY,
      record,
    });
    return { session, uri };
  }
}
