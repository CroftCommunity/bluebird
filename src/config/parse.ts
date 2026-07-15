import type {
  SkyliteAccount,
  SkyliteApprovedFeed,
  SkyliteChannel,
  SkyliteConfig,
  SkyliteFriend,
  SkyliteHelp,
  SkyliteSearch,
  SearchTier,
  Skin,
} from './types.js';
import { CONFIG_DEFAULTS, SEARCH_DEFAULTS, SKYLITE_CONFIG_VERSION } from './types.js';

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

function parseAccount(v: unknown): SkyliteAccount | null {
  if (!isObj(v) || typeof v.actor !== 'string' || v.actor.trim() === '') return null;
  return {
    actor: v.actor.trim(),
    ...(typeof v.displayName === 'string' ? { displayName: v.displayName } : {}),
  };
}

function parseChannel(v: unknown): SkyliteChannel | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== 'string' || typeof v.name !== 'string') return null;
  const accounts = Array.isArray(v.accounts)
    ? v.accounts.map(parseAccount).filter((a): a is SkyliteAccount => a !== null)
    : [];
  return {
    id: v.id,
    name: v.name,
    enabled: v.enabled === true,
    accounts,
  };
}

function parseFriend(v: unknown): SkyliteFriend | null {
  if (!isObj(v) || typeof v.did !== 'string' || !v.did.startsWith('did:')) return null;
  return {
    did: v.did.trim(),
    ...(typeof v.displayName === 'string' && v.displayName.trim() ? { displayName: v.displayName } : {}),
  };
}

function parseApprovedFeed(v: unknown): SkyliteApprovedFeed | null {
  if (!isObj(v) || typeof v.uri !== 'string' || v.uri.trim() === '') return null;
  return {
    uri: v.uri.trim(),
    name: typeof v.name === 'string' && v.name.trim() ? v.name : v.uri.trim(),
  };
}

function parseSkin(v: unknown): Skin {
  return v === 'full' ? 'full' : 'simple';
}

/** Only allow the known tiers; anything else is the safe default (off). */
function parseTier(v: unknown): SearchTier {
  return v === 'discovery' || v === 'open' ? v : 'off';
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : [];
}

/**
 * Parse the search block. Legacy migration: a v2 record with the old boolean
 * `telescope` (no `search`) becomes `tier: 'open'` when it was true, else `off` —
 * the rest taking SEARCH_DEFAULTS.
 */
function parseSearch(v: unknown, legacyTelescope: unknown): SkyliteSearch {
  if (!isObj(v)) {
    return { ...SEARCH_DEFAULTS, tier: legacyTelescope === true ? 'open' : 'off' };
  }
  return {
    tier: parseTier(v.tier),
    useAllowlist: typeof v.useAllowlist === 'boolean' ? v.useAllowlist : SEARCH_DEFAULTS.useAllowlist,
    allowlistExtra: stringList(v.allowlistExtra),
    useBlocklist: typeof v.useBlocklist === 'boolean' ? v.useBlocklist : SEARCH_DEFAULTS.useBlocklist,
    blocklistExtra: stringList(v.blocklistExtra),
    logHistory: typeof v.logHistory === 'boolean' ? v.logHistory : SEARCH_DEFAULTS.logHistory,
  };
}

function parseHelp(v: unknown): SkyliteHelp | null {
  if (!isObj(v)) return null;
  const help: SkyliteHelp = {};
  if (typeof v.contactName === 'string' && v.contactName.trim()) help.contactName = v.contactName;
  if (typeof v.contactEmail === 'string' && v.contactEmail.trim()) help.contactEmail = v.contactEmail;
  return help.contactName || help.contactEmail ? help : null;
}

/**
 * Parse an unknown value into a canonical SkyliteConfig, or return null if it is
 * not recognizably a config. Both v1 (legacy) and v2 records parse here: missing
 * switches fall back to CONFIG_DEFAULTS. The only structural requirement is a
 * boolean `paused` (present in every version) OR the presence of `channels`.
 */
export function parseConfig(v: unknown): SkyliteConfig | null {
  if (!isObj(v)) return null;
  // A config is recognizable if it has the pause switch or a channels array.
  const looksLikeConfig = typeof v.paused === 'boolean' || Array.isArray(v.channels);
  if (!looksLikeConfig) return null;

  const version = typeof v.version === 'number' && v.version >= 1 ? v.version : SKYLITE_CONFIG_VERSION;
  const channels = Array.isArray(v.channels)
    ? v.channels.map(parseChannel).filter((c): c is SkyliteChannel => c !== null)
    : [];
  const friends = Array.isArray(v.friends)
    ? v.friends.map(parseFriend).filter((f): f is SkyliteFriend => f !== null)
    : [];
  const approvedFeeds = Array.isArray(v.approvedFeeds)
    ? v.approvedFeeds.map(parseApprovedFeed).filter((f): f is SkyliteApprovedFeed => f !== null)
    : [];
  const help = parseHelp(v.help);
  const staleHours =
    typeof v.staleHours === 'number' && v.staleHours > 0 ? v.staleHours : CONFIG_DEFAULTS.staleHours;

  return {
    version,
    displayName: typeof v.displayName === 'string' ? v.displayName : '',
    localOnly: typeof v.localOnly === 'boolean' ? v.localOnly : CONFIG_DEFAULTS.localOnly,
    skin: parseSkin(v.skin),
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
export function newExplorerConfig(displayName = ''): SkyliteConfig {
  return {
    version: SKYLITE_CONFIG_VERSION,
    displayName,
    localOnly: CONFIG_DEFAULTS.localOnly,
    skin: CONFIG_DEFAULTS.skin,
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
