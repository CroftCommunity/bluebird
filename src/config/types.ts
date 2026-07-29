// TypeScript mirror of the ing.croft.bluebird.config lexicon (see
// lexicons/ing.croft.bluebird.config.json). This is the *per-explorer* sponsor
// control record: one record per explorer, at a RANDOM rkey (never the
// explorer's name), living in the sponsor's own ATProto repo and read publicly
// (unauthenticated com.atproto.repo.getRecord) by the explorer's device.
//
// The two switches (BLUEBIRD-DIRECTIVES §2) are `localOnly` (default true —
// no account, anonymous reads only) and `skin` (purely cosmetic; NO capability
// may ever key on skin). Tiers are dead. The record carries NO age, birthday,
// school, or location — ever. Follows are NOT in this record; they belong to
// the explorer's own device/repo.

export const BLUEBIRD_CONFIG_NSID = 'ing.croft.bluebird.config';

/**
 * Legacy fixed rkey from the v1 single-explorer deployment. New explorer records
 * use a random rkey; this constant only exists to migrate the one existing
 * deployed record and to keep the unprovisioned demo pointer stable.
 */
export const BLUEBIRD_CONFIG_RKEY_LEGACY = 'self';

/** Current config schema version. v2 is the two-switch, multi-explorer model. */
export const BLUEBIRD_CONFIG_VERSION = 2;

/** Purely-cosmetic presentation. NEVER gates a capability. */
export type Skin = 'simple' | 'full';

/**
 * Trust distance from the tended garden — the trail rating of the garden itself.
 * green = inside the garden, blue = one hop beyond it, black = the open network.
 * A trust rating, NOT a content-maturity rating. Baked into the config lexicon
 * so future Patrol tooling and third-party audits can read it at the protocol
 * layer. (UI renders it as the green-circle / blue-square / black-diamond trail
 * markers; the field name stays a durable colour noun, never a mountain term.)
 */
export type TrustTier = 'green' | 'blue' | 'black';

export interface BluebirdAccount {
  actor: string;
  displayName?: string;
}

export interface BluebirdChannel {
  id: string;
  name: string;
  enabled: boolean;
  accounts: BluebirdAccount[];
}

/** A reciprocal, sponsor-curated friend. Friends are addressed by DID. */
export interface BluebirdFriend {
  did: string;
  displayName?: string;
}

/** Telescope rung 2 search reach (see docs/trail-map-search.md). */
export type SearchTier = 'off' | 'discovery' | 'open';

/** The sponsor-set search trust gradient + its layered safeguards. */
export interface BluebirdSearch {
  /** Reach: no search / bounded to approved-feed authors / whole network. */
  tier: SearchTier;
  /** Positive gate: only queries matching an allowed topic run. Default off. */
  useAllowlist: boolean;
  /** Sponsor additions to the seeded default topic allowlist. */
  allowlistExtra: string[];
  /** Negative gate: queries containing a blocked term are refused. Default on. */
  useBlocklist: boolean;
  /** Sponsor additions to the seeded default blocklist. */
  blocklistExtra: string[];
  /** Search-history visible to the sponsor (the accountability indicator). Default on. */
  logHistory: boolean;
  /**
   * When the sponsor turned on the ENCRYPTED archive, their audit PUBLIC key
   * (EC P-256 JWK), published here via the config so the explorer device can seal
   * each search to it. Present ⇒ the device seals + syncs the ciphertext; absent
   * ⇒ history stays on-device. Only the sponsor's private key can read it.
   */
  auditPubKeyJwk?: JsonWebKey;
}

/** An approved discovery feed (Telescope rung 1). */
export interface BluebirdApprovedFeed {
  /** at:// feed generator URI. */
  uri: string;
  /** Sponsor-cached display name (feeds can rename; we show what was approved). */
  name: string;
}

export interface BluebirdHelp {
  contactName?: string;
  contactEmail?: string;
}

export interface BluebirdConfig {
  $type?: typeof BLUEBIRD_CONFIG_NSID;
  /** Schema version. >=2 for the two-switch model. */
  version: number;
  /**
   * The explorer's nickname. Guidance ("a nickname, never a real or legal
   * name") is enforced in the sponsor UI; the record just carries the string.
   * This is public, like the whole record.
   */
  displayName: string;
  /** Switch 1. DEFAULT TRUE: no account, device makes only anonymous GETs. */
  localOnly: boolean;
  /** Switch 2. Cosmetic only. */
  skin: Skin;
  /**
   * Trust distance from the tended garden (green inside / blue one hop / black
   * open). A trust rating, not a content rating. Default green.
   */
  tier: TrustTier;
  /** The pause / kill switch. */
  paused: boolean;
  updatedAt: string;
  /** Named, individually toggleable groupings; the garden ceiling is their union. */
  channels: BluebirdChannel[];
  /** Reciprocal, sponsor-curated friends (whose hearts may be shown). */
  friends: BluebirdFriend[];
  /** Let a localOnly explorer see friends' hearts via anonymous reads. Default false. */
  showFriendsHearts: boolean;
  /** Approved discovery feeds (Telescope rung 1). */
  approvedFeeds: BluebirdApprovedFeed[];
  /** Open search (Telescope rung 2) — a sponsor-set trust gradient. See docs/trail-map-search.md. */
  search: BluebirdSearch;
  /** Whether reposts (whole outside posts) are injected into the garden. Default true. */
  showReposts: boolean;
  /** Staleness window in hours before an unreachable config locks the garden. Default 72. */
  staleHours: number;
  /** Optional trusted-adult contact for the out-of-band "something's wrong" handoff. */
  help?: BluebirdHelp;
}

/** Where the explorer device's config came from, for honest UI. */
export type ConfigSource = 'pds' | 'pds-cached' | 'local' | 'dev-fixture';

export const DEFAULT_STALE_HOURS = 72;

/** Default search block for a new explorer — the safe end of the gradient. */
export const SEARCH_DEFAULTS: BluebirdSearch = {
  tier: 'off',
  useAllowlist: false,
  allowlistExtra: [],
  useBlocklist: true,
  blocklistExtra: [],
  logHistory: true,
};

/** Canonical defaults for every optional/switchable field (also the migration target). */
export const CONFIG_DEFAULTS = {
  localOnly: true,
  skin: 'simple' as Skin,
  tier: 'green' as TrustTier,
  paused: false,
  showFriendsHearts: false,
  showReposts: true,
  staleHours: DEFAULT_STALE_HOURS,
} as const;
