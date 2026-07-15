/**
 * The inclusion list — the whole ceiling of the garden. In v1 this is a
 * sponsor-curated record that will live in the sponsor's PDS (D2, Phase 2).
 * For Phase 1 it is a checked-in dev fixture so the read path can be built and
 * demonstrated. `actor` may be a handle or a DID (getAuthorFeed accepts either).
 */

export interface InclusionEntry {
  actor: string;
  displayName: string;
}

export interface InclusionList {
  version: number;
  entries: InclusionEntry[];
}

/**
 * DEV PLACEHOLDER — not a curated explorer's list. Three real, stable Bluesky
 * accounts so `npm run e2e:live` renders a genuine three-account garden. The
 * real list arrives from the sponsor config in Phase 2.
 */
export const DEV_INCLUSION: InclusionList = {
  version: 1,
  entries: [
    { actor: 'bsky.app', displayName: 'Bluesky' },
    { actor: 'atproto.com', displayName: 'AT Protocol' },
    { actor: 'safety.bsky.app', displayName: 'Bluesky Safety' },
  ],
};
