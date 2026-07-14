import type { SkyliteAccount, SkyliteChannel, SkyliteConfig } from './types.js';

// Defensive parsing of an untrusted config record. The record comes off a public
// PDS read (or local import) and must never be trusted structurally — a
// malformed field should degrade gracefully, never throw into the child's UI.

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

/**
 * Parse an unknown value into a SkyliteConfig, or return null if it is not
 * recognizably a config. Unknown/extra fields are ignored; bad channels/accounts
 * are dropped rather than failing the whole record.
 */
export function parseConfig(v: unknown): SkyliteConfig | null {
  if (!isObj(v)) return null;
  if (typeof v.paused !== 'boolean') return null;
  const version = typeof v.version === 'number' && v.version >= 1 ? v.version : 1;
  const channels = Array.isArray(v.channels)
    ? v.channels.map(parseChannel).filter((c): c is SkyliteChannel => c !== null)
    : [];
  return {
    version,
    paused: v.paused,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '',
    channels,
  };
}
