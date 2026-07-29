import type {
  BluebirdAccount,
  BluebirdApprovedFeed,
  BluebirdChannel,
  BluebirdConfig,
  BluebirdFriend,
  BluebirdHelp,
  BluebirdSearch,
  SearchTier,
  Skin,
  TrustTier,
} from './types.js';
import { CONFIG_DEFAULTS, SEARCH_DEFAULTS, BLUEBIRD_CONFIG_VERSION } from './types.js';

// Defensive parsing of an untrusted config record. The record comes off a public
// PDS read (or local import) and must never be trusted structurally — a malformed
// field degrades to its default, never throws into the explorer's UI.
//
// Applying CONFIG_DEFAULTS for every missing field IS the v1->v2 migration: a
// legacy single-explorer record (paused + channels + help, no switches) parses into
// the canonical two-switch shape with localOnly=true, skin=simple, etc.

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseAccount(v: unknown): BluebirdAccount | null {
  if (!isObj(v) || typeof v.actor !== 'string' || v.actor.trim() === '') return null;
  return {
    actor: v.actor.trim(),
    ...(typeof v.displayName === 'string' ? { displayName: v.displayName } : {}),
  };
}

function parseChannel(v: unknown): BluebirdChannel | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== 'string' || typeof v.name !== 'string') return null;
  const accounts = Array.isArray(v.accounts)
    ? v.accounts.map(parseAccount).filter((a): a is BluebirdAccount => a !== null)
    : [];
  return {
    id: v.id,
    name: v.name,
    enabled: v.enabled === true,
    accounts,
  };
}

function parseFriend(v: unknown): BluebirdFriend | null {
  if (!isObj(v) || typeof v.did !== 'string' || !v.did.startsWith('did:')) return null;
  return {
    did: v.did.trim(),
    ...(typeof v.displayName === 'string' && v.displayName.trim() ? { displayName: v.displayName } : {}),
  };
}

function parseApprovedFeed(v: unknown): BluebirdApprovedFeed | null {
  if (!isObj(v) || typeof v.uri !== 'string' || v.uri.trim() === '') return null;
  return {
    uri: v.uri.trim(),
    name: typeof v.name === 'string' && v.name.trim() ? v.name : v.uri.trim(),
  };
}

function parseSkin(v: unknown): Skin {
  return v === 'full' ? 'full' : 'simple';
}

/** Only allow the known trust tiers; anything else is the safe default (green,
    inside the garden). */
function parseTrustTier(v: unknown): TrustTier {
  return v === 'blue' || v === 'black' ? v : 'green';
}

/** Only allow the known tiers; anything else is the safe default (off). */
function parseTier(v: unknown): SearchTier {
  return v === 'discovery' || v === 'open' ? v : 'off';
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : [];
}

/** A well-formed EC P-256 PUBLIC JWK (never a private key: `d` must be absent). */
function parseAuditPubKey(v: unknown): JsonWebKey | undefined {
  if (!isObj(v)) return undefined;
  if (v.kty !== 'EC' || v.crv !== 'P-256') return undefined;
  if (typeof v.x !== 'string' || typeof v.y !== 'string') return undefined;
  if ('d' in v) return undefined; // reject anything carrying a private scalar
  return { kty: 'EC', crv: 'P-256', x: v.x, y: v.y };
}

/**
 * Parse the search block. Legacy migration: a v2 record with the old boolean
 * `telescope` (no `search`) becomes `tier: 'open'` when it was true, else `off` —
 * the rest taking SEARCH_DEFAULTS.
 */
function parseSearch(v: unknown, legacyTelescope: unknown): BluebirdSearch {
  if (!isObj(v)) {
    return { ...SEARCH_DEFAULTS, tier: legacyTelescope === true ? 'open' : 'off' };
  }
  const auditPubKeyJwk = parseAuditPubKey(v.auditPubKeyJwk);
  return {
    tier: parseTier(v.tier),
    useAllowlist: typeof v.useAllowlist === 'boolean' ? v.useAllowlist : SEARCH_DEFAULTS.useAllowlist,
    allowlistExtra: stringList(v.allowlistExtra),
    useBlocklist: typeof v.useBlocklist === 'boolean' ? v.useBlocklist : SEARCH_DEFAULTS.useBlocklist,
    blocklistExtra: stringList(v.blocklistExtra),
    logHistory: typeof v.logHistory === 'boolean' ? v.logHistory : SEARCH_DEFAULTS.logHistory,
    ...(auditPubKeyJwk ? { auditPubKeyJwk } : {}),
  };
}

function parseHelp(v: unknown): BluebirdHelp | null {
  if (!isObj(v)) return null;
  const help: BluebirdHelp = {};
  if (typeof v.contactName === 'string' && v.contactName.trim()) help.contactName = v.contactName;
  if (typeof v.contactEmail === 'string' && v.contactEmail.trim()) help.contactEmail = v.contactEmail;
  return help.contactName || help.contactEmail ? help : null;
}

/**
 * Parse an unknown value into a canonical BluebirdConfig, or return null if it is
 * not recognizably a config. Both v1 (legacy) and v2 records parse here: missing
 * switches fall back to CONFIG_DEFAULTS. The only structural requirement is a
 * boolean `paused` (present in every version) OR the presence of `channels`.
 */
export function parseConfig(v: unknown): BluebirdConfig | null {
  if (!isObj(v)) return null;
  // A config is recognizable if it has the pause switch or a channels array.
  const looksLikeConfig = typeof v.paused === 'boolean' || Array.isArray(v.channels);
  if (!looksLikeConfig) return null;

  const version = typeof v.version === 'number' && v.version >= 1 ? v.version : BLUEBIRD_CONFIG_VERSION;
  const channels = Array.isArray(v.channels)
    ? v.channels.map(parseChannel).filter((c): c is BluebirdChannel => c !== null)
    : [];
  const friends = Array.isArray(v.friends)
    ? v.friends.map(parseFriend).filter((f): f is BluebirdFriend => f !== null)
    : [];
  const approvedFeeds = Array.isArray(v.approvedFeeds)
    ? v.approvedFeeds.map(parseApprovedFeed).filter((f): f is BluebirdApprovedFeed => f !== null)
    : [];
  const help = parseHelp(v.help);
  const staleHours =
    typeof v.staleHours === 'number' && v.staleHours > 0 ? v.staleHours : CONFIG_DEFAULTS.staleHours;

  return {
    version,
    displayName: typeof v.displayName === 'string' ? v.displayName : '',
    localOnly: typeof v.localOnly === 'boolean' ? v.localOnly : CONFIG_DEFAULTS.localOnly,
    skin: parseSkin(v.skin),
    tier: parseTrustTier(v.tier),
    paused: v.paused === true,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '',
    channels,
    friends,
    showFriendsHearts:
      typeof v.showFriendsHearts === 'boolean' ? v.showFriendsHearts : CONFIG_DEFAULTS.showFriendsHearts,
    approvedFeeds,
    search: parseSearch(v.search, v.telescope),
    showReposts: typeof v.showReposts === 'boolean' ? v.showReposts : CONFIG_DEFAULTS.showReposts,
    staleHours,
    ...(help ? { help } : {}),
  };
}

/** A fresh, fully-defaulted config for a new explorer (sponsor authoring). */
export function newExplorerConfig(displayName = ''): BluebirdConfig {
  return {
    version: BLUEBIRD_CONFIG_VERSION,
    displayName,
    localOnly: CONFIG_DEFAULTS.localOnly,
    skin: CONFIG_DEFAULTS.skin,
    tier: CONFIG_DEFAULTS.tier,
    paused: CONFIG_DEFAULTS.paused,
    updatedAt: '',
    channels: [],
    friends: [],
    showFriendsHearts: CONFIG_DEFAULTS.showFriendsHearts,
    approvedFeeds: [],
    search: { ...SEARCH_DEFAULTS },
    showReposts: CONFIG_DEFAULTS.showReposts,
    staleHours: CONFIG_DEFAULTS.staleHours,
  };
}
