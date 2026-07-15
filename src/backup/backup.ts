import type { Clip } from '../saves/clip.js';
import type { Binding } from '../config/binding.js';
import type { SkyliteConfig } from '../config/types.js';
import { parseConfig } from '../config/parse.js';
import { listClips, saveClip } from '../saves/store.js';
import {
  getBinding,
  setBinding,
  getLocalConfig,
  setLocalConfig,
  getLocalFollows,
  setLocalFollows,
} from '../config/binding.js';

/**
 * S5 backup & restore. One versioned JSON that captures everything an explorer's
 * device holds locally — saves (with their private notes), local follows, and
 * local settings (the device binding + any local config). Export via download or
 * the OS share sheet; import restores it on a fresh device. In localOnly mode
 * this file is the ONLY copy of the saves — the UI says so plainly.
 *
 * The storage ports are injectable so the assembly logic is unit-tested without
 * IndexedDB / localStorage; the defaults wire the real device stores.
 */

export const BACKUP_SCHEMA = 'skylite.backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  $schema: typeof BACKUP_SCHEMA;
  version: number;
  exportedAt: string;
  saves: Clip[];
  /** Local follows (My Sky) as DIDs — RUN-DISCOVER D1; empty until then. */
  localFollows: string[];
  settings: {
    binding?: Binding;
    localConfig?: SkyliteConfig;
  };
}

export interface BackupPorts {
  listClips: () => Promise<Clip[]>;
  putClip: (c: Clip) => Promise<void>;
  getBinding: () => Binding | null;
  setBinding: (b: Binding) => void;
  getLocalConfig: () => SkyliteConfig | null;
  setLocalConfig: (c: SkyliteConfig) => void;
  getLocalFollows: () => string[];
  setLocalFollows: (dids: string[]) => void;
  now: () => number;
}

function defaultPorts(): BackupPorts {
  return {
    listClips,
    putClip: saveClip,
    getBinding,
    setBinding,
    getLocalConfig,
    setLocalConfig,
    getLocalFollows,
    setLocalFollows,
    now: () => Date.now(),
  };
}

export interface RestoreSummary {
  saves: number;
  follows: number;
  boundSponsor: boolean;
  localConfig: boolean;
}

/** Gather everything on this device into a single backup object. */
export async function buildBackup(ports: Partial<BackupPorts> = {}): Promise<BackupFile> {
  const p = { ...defaultPorts(), ...ports };
  const binding = p.getBinding();
  const localConfig = p.getLocalConfig();
  return {
    $schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: new Date(p.now()).toISOString(),
    saves: await p.listClips(),
    localFollows: p.getLocalFollows(),
    settings: {
      ...(binding ? { binding } : {}),
      ...(localConfig ? { localConfig } : {}),
    },
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseClip(v: unknown): Clip | null {
  if (!isObj(v) || typeof v.uri !== 'string') return null;
  return {
    uri: v.uri,
    authorName: typeof v.authorName === 'string' ? v.authorName : '',
    handle: typeof v.handle === 'string' ? v.handle : '',
    text: typeof v.text === 'string' ? v.text : '',
    ...(typeof v.thumb === 'string' ? { thumb: v.thumb } : {}),
    note: typeof v.note === 'string' ? v.note : '',
    savedAt: typeof v.savedAt === 'number' ? v.savedAt : 0,
  };
}

function parseBinding(v: unknown): Binding | null {
  if (!isObj(v) || typeof v.sponsorDid !== 'string' || !v.sponsorDid.startsWith('did:')) return null;
  return {
    sponsorDid: v.sponsorDid,
    rkey: typeof v.rkey === 'string' && v.rkey ? v.rkey : 'self',
    ...(typeof v.pdsHost === 'string' ? { pdsHost: v.pdsHost } : {}),
  };
}

/**
 * Defensively parse an untrusted backup file. An imported file may be anything —
 * a wrong file, a corrupt one — so every field degrades rather than throws.
 * Returns null only when the object is not recognizably a Skylite backup.
 */
export function parseBackup(v: unknown): BackupFile | null {
  if (!isObj(v) || v.$schema !== BACKUP_SCHEMA) return null;
  const settings = isObj(v.settings) ? v.settings : {};
  const binding = parseBinding(settings.binding);
  const localConfig = parseConfig(settings.localConfig);
  return {
    $schema: BACKUP_SCHEMA,
    version: typeof v.version === 'number' ? v.version : BACKUP_VERSION,
    exportedAt: typeof v.exportedAt === 'string' ? v.exportedAt : '',
    saves: Array.isArray(v.saves) ? v.saves.map(parseClip).filter((c): c is Clip => c !== null) : [],
    localFollows: Array.isArray(v.localFollows)
      ? v.localFollows.filter((d): d is string => typeof d === 'string')
      : [],
    settings: {
      ...(binding ? { binding } : {}),
      ...(localConfig ? { localConfig } : {}),
    },
  };
}

/** Restore a parsed backup onto this device. Saves are merged (put by URI). */
export async function restoreBackup(
  data: BackupFile,
  ports: Partial<BackupPorts> = {},
): Promise<RestoreSummary> {
  const p = { ...defaultPorts(), ...ports };
  for (const clip of data.saves) await p.putClip(clip);
  if (data.localFollows.length) p.setLocalFollows(data.localFollows);
  if (data.settings.binding) p.setBinding(data.settings.binding);
  if (data.settings.localConfig) p.setLocalConfig(data.settings.localConfig);
  return {
    saves: data.saves.length,
    follows: data.localFollows.length,
    boundSponsor: Boolean(data.settings.binding),
    localConfig: Boolean(data.settings.localConfig),
  };
}
