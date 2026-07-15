import type { SkyliteConfig } from '../config/types.js';
import { parseConfig } from '../config/parse.js';

/**
 * Local persistence for the sponsor's authoring device: the set of explorer
 * config records (keyed by their random rkey), the sponsor's identity used to
 * build provisioning links, and the onboarding checklist acknowledgement.
 *
 * This is the sponsor's working set. Records are written into the sponsor's PDS
 * out of band (or, later, over OAuth); the exported JSON is the record body.
 * Storage access is defensive — a disabled/full store degrades, never throws.
 */

const KEY_EXPLORERS = 'skylite.sponsor.explorers';
const KEY_IDENTITY = 'skylite.sponsor.identity';
const KEY_CHECKLIST = 'skylite.sponsor.checklist';

export interface SponsorIdentity {
  did?: string;
  handle?: string;
  pdsHost?: string;
}

/** One authored explorer: its random rkey and its config record. */
export interface ExplorerEntry {
  rkey: string;
  config: SkyliteConfig;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function store(): StorageLike | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* full / disabled — non-fatal */
  }
}

/** The authored explorers, oldest first (rkeys are time-sortable TIDs). */
export function listExplorers(): ExplorerEntry[] {
  const raw = readJson<Record<string, unknown>>(KEY_EXPLORERS) ?? {};
  const out: ExplorerEntry[] = [];
  for (const [rkey, value] of Object.entries(raw)) {
    const config = parseConfig(value);
    if (config) out.push({ rkey, config });
  }
  return out.sort((a, b) => (a.rkey < b.rkey ? -1 : a.rkey > b.rkey ? 1 : 0));
}

function writeAll(entries: ExplorerEntry[]): void {
  const map: Record<string, SkyliteConfig> = {};
  for (const e of entries) map[e.rkey] = e.config;
  writeJson(KEY_EXPLORERS, map);
}

export function upsertExplorer(rkey: string, config: SkyliteConfig): void {
  const entries = listExplorers().filter((e) => e.rkey !== rkey);
  entries.push({ rkey, config });
  writeAll(entries);
}

export function removeExplorer(rkey: string): void {
  writeAll(listExplorers().filter((e) => e.rkey !== rkey));
}

export function getSponsorIdentity(): SponsorIdentity {
  return readJson<SponsorIdentity>(KEY_IDENTITY) ?? {};
}

export function setSponsorIdentity(identity: SponsorIdentity): void {
  writeJson(KEY_IDENTITY, identity);
}

export function getChecklist(): Record<string, boolean> {
  return readJson<Record<string, boolean>>(KEY_CHECKLIST) ?? {};
}

export function setChecklistItem(id: string, done: boolean): void {
  writeJson(KEY_CHECKLIST, { ...getChecklist(), [id]: done });
}
