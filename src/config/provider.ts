import type { InclusionEntry } from '../feed/inclusion.js';
import { DEV_INCLUSION } from '../feed/inclusion.js';
import { RepoClient } from '../atproto/repo.js';
import { SKYLITE_CONFIG_NSID } from './types.js';
import type { SkyliteConfig } from './types.js';
import { parseConfig } from './parse.js';
import { effectiveInclusion } from './inclusion.js';
import {
  getBinding,
  getCachedConfig,
  getLocalConfig,
  setCachedConfig,
  type Binding,
} from './binding.js';
import {
  resolveLocalGate,
  resolvePdsGate,
  type CachedConfig,
  type Gate,
  type PollResult,
} from './state.js';

/**
 * Resolve which config governs this device and the resulting D5 gate, in
 * priority order: PDS binding → local-only config → dev fixture. The dev fixture
 * keeps the public deployment demonstrable for an unprovisioned visitor.
 */

export interface ProviderDeps {
  repo?: RepoClient;
  now?: number;
  staleHours?: number;
  binding?: Binding | null;
}

export interface ResolvedGarden {
  gate: Gate;
  inclusion: InclusionEntry[];
}

/** Wrap the Phase-1 dev inclusion list as a config for the unprovisioned demo. */
export function devConfig(): SkyliteConfig {
  return {
    version: 1,
    paused: false,
    updatedAt: '',
    channels: [
      { id: 'dev', name: 'Skylite demo', enabled: true, accounts: DEV_INCLUSION.entries.map((e) => ({ actor: e.actor, displayName: e.displayName })) },
    ],
  };
}

function inclusionFor(gate: Gate): InclusionEntry[] {
  return gate.kind === 'active' ? effectiveInclusion(gate.config) : [];
}

async function pollPds(repo: RepoClient, binding: Binding): Promise<PollResult> {
  try {
    const pdsHost = binding.pdsHost ?? (await repo.resolvePds(binding.guardianDid));
    const rec = await repo.getRecord(pdsHost, {
      repo: binding.guardianDid,
      collection: SKYLITE_CONFIG_NSID,
      rkey: binding.rkey,
    });
    const config = parseConfig(rec.value);
    return config ? { status: 'ok', config } : { status: 'unreachable' };
  } catch {
    return { status: 'unreachable' };
  }
}

export async function resolveGarden(deps: ProviderDeps = {}): Promise<ResolvedGarden> {
  const now = deps.now ?? Date.now();
  const binding = deps.binding !== undefined ? deps.binding : getBinding();

  if (binding) {
    const repo = deps.repo ?? new RepoClient();
    const poll = await pollPds(repo, binding);
    if (poll.status === 'ok') {
      const cache: CachedConfig = { config: poll.config, fetchedAt: now };
      setCachedConfig(cache);
    }
    const gate = resolvePdsGate(poll, getCachedConfig(), now, deps.staleHours);
    return { gate, inclusion: inclusionFor(gate) };
  }

  const local = getLocalConfig();
  if (local) {
    const gate = resolveLocalGate(local, 'local');
    return { gate, inclusion: inclusionFor(gate) };
  }

  const gate = resolveLocalGate(devConfig(), 'dev-fixture');
  return { gate, inclusion: inclusionFor(gate) };
}
