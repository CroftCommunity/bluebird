// Public, unauthenticated repo reads: resolve a DID to its PDS, then fetch a
// record with com.atproto.repo.getRecord. This is the transport for the guardian
// config (build plan §1: "PDS getRecord is a stable public unauthenticated read
// with a JSON envelope"). No auth, same read-only posture as the garden.

export const PLC_DIRECTORY = 'https://plc.directory';

export interface DidService {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export interface DidDocument {
  id: string;
  service?: DidService[];
}

export interface GetRecordResponse<T = unknown> {
  uri: string;
  cid?: string;
  value: T;
}

export interface RepoClientOptions {
  fetchImpl?: typeof fetch;
  plcDirectory?: string;
}

export class RepoError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RepoError';
    this.status = status;
  }
}

/** Pull the atproto PDS endpoint out of a resolved DID document. */
export function pdsEndpointFromDoc(doc: DidDocument): string | null {
  const svc = (doc.service ?? []).find(
    (s) => s.type === 'AtprotoPersonalDataServer' || s.id === '#atproto_pds' || s.id.endsWith('#atproto_pds'),
  );
  return svc?.serviceEndpoint ?? null;
}

export class RepoClient {
  private readonly fetchImpl: typeof fetch;
  private readonly plcDirectory: string;

  constructor(opts: RepoClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.plcDirectory = opts.plcDirectory ?? PLC_DIRECTORY;
  }

  /** Resolve a DID to its PDS service endpoint (did:plc via directory, did:web via well-known). */
  async resolvePds(did: string): Promise<string> {
    let docUrl: string;
    if (did.startsWith('did:plc:')) {
      docUrl = `${this.plcDirectory}/${did}`;
    } else if (did.startsWith('did:web:')) {
      const rest = did.slice('did:web:'.length);
      const parts = rest.split(':').map(decodeURIComponent);
      const host = parts[0];
      const path = parts.length > 1 ? parts.slice(1).join('/') + '/did.json' : '.well-known/did.json';
      docUrl = `https://${host}/${path}`;
    } else {
      throw new RepoError(`Unsupported DID method: ${did}`);
    }

    const res = await this.fetchImpl(docUrl, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new RepoError(`DID resolution failed: ${res.status}`, res.status);
    const doc = (await res.json()) as DidDocument;
    const endpoint = pdsEndpointFromDoc(doc);
    if (!endpoint) throw new RepoError(`No PDS endpoint in DID document for ${did}`);
    return endpoint.replace(/\/+$/, '');
  }

  /** Fetch a single record from a repo via its PDS host. */
  async getRecord<T = unknown>(
    pdsHost: string,
    params: { repo: string; collection: string; rkey: string },
  ): Promise<GetRecordResponse<T>> {
    const url = new URL('/xrpc/com.atproto.repo.getRecord', pdsHost);
    url.searchParams.set('repo', params.repo);
    url.searchParams.set('collection', params.collection);
    url.searchParams.set('rkey', params.rkey);
    const res = await this.fetchImpl(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new RepoError(`getRecord failed: ${res.status}`, res.status);
    return (await res.json()) as GetRecordResponse<T>;
  }
}
