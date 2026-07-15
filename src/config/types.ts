// TypeScript mirror of the ing.croft.skylite.config lexicon (see
// lexicons/ing.croft.skylite.config.json). This is the *per-explorer* sponsor
// control record: one record per explorer, at a RANDOM rkey (never the
// explorer's name), living in the sponsor's own ATProto repo and read publicly
// (unauthenticated com.atproto.repo.getRecord) by the explorer's device.
//
// The two switches (SKYLITE-DIRECTIVES §2) are `localOnly` (default true —
// no account, anonymous reads only) and `skin` (purely cosmetic; NO capability
// may ever key on skin). Tiers are dead. The record carries NO age, birthday,
// school, or location — ever. Follows are NOT in this record; they belong to
// the explorer's own device/repo.

export const SKYLITE_CONFIG_NSID = 'ing.croft.skylite.config';

/**
 * Legacy fixed rkey from the v1 single-explorer deployment. New explorer records
 * use a random rkey; this constant only exists to migrate the one existing
 * deployed record and to keep the unprovisioned demo pointer stable.
 */
export const SKYLITE_CONFIG_RKEY_LEGACY = 'self';

/** Current config schema version. v2 is the two-switch, multi-explorer model. */
export const SKYLITE_CONFIG_VERSION = 2;

/** Purely-cosmetic presentation. NEVER gates a capability. */
export type Skin = 'simple' | 'full';

export interface SkyliteAccount {
  actor: string;
  displayName?: string;
}

export interface SkyliteChannel {
  id: string;
  name: string;
  enabled: boolean;
  accounts: SkyliteAccount[];
}

/** A reciprocal, sponsor-curated friend. Friends are addressed by DID. */
export interface SkyliteFriend {
  did: string;
  displayName?: string;
}

/** An approved discovery feed (Telescope rung 1). */
export interface SkyliteApprovedFeed {
  /** at:// feed generator URI. */
  uri: string;
  /** Sponsor-cached display name (feeds can rename; we show what was approved). */
  name: string;
}

export interface SkyliteHelp {
  contactName?: string;
  contactEmail?: string;
}

export interface SkyliteConfig {
  $type?: typeof SKYLITE_CONFIG_NSID;
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
  /** The pause / kill switch. */
  paused: boolean;
  updatedAt: string;
  /** Named, individually toggleable groupings; the garden ceiling is their union. */
  channels: SkyliteChannel[];
  /** Reciprocal, sponsor-curated friends (whose hearts may be shown). */
  friends: SkyliteFriend[];
  /** Let a localOnly explorer see friends' hearts via anonymous reads. Default false. */
  showFriendsHearts: boolean;
  /** Approved discovery feeds (Telescope rung 1). */
  approvedFeeds: SkyliteApprovedFeed[];
  /** Open search (Telescope rung 2). Default false. */
  telescope: boolean;
  /** Whether reposts (whole outside posts) are injected into the garden. Default true. */
  showReposts: boolean;
  /** Staleness window in hours before an unreachable config locks the garden. Default 72. */
  staleHours: number;
  /** Optional trusted-adult contact for the out-of-band "something's wrong" handoff. */
  help?: SkyliteHelp;
}

/** Where the explorer device's config came from, for honest UI. */
export type ConfigSource = 'pds' | 'pds-cached' | 'local' | 'dev-fixture';

export const DEFAULT_STALE_HOURS = 72;

/** Canonical defaults for every optional/switchable field (also the migration target). */
export const CONFIG_DEFAULTS = {
  localOnly: true,
  skin: 'simple' as Skin,
  paused: false,
  showFriendsHearts: false,
  telescope: false,
  showReposts: true,
  staleHours: DEFAULT_STALE_HOURS,
} as const;
