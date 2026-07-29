import type { InclusionEntry } from '../feed/inclusion.js';
import { DEV_INCLUSION } from '../feed/inclusion.js';
import { RepoClient } from '../atproto/repo.js';
import { BLUEBIRD_CONFIG_NSID } from './types.js';
import type { BluebirdConfig } from './types.js';
import { parseConfig, newExplorerConfig } from './parse.js';
import { effectiveInclusion } from './inclusion.js';
import { diffInclusion, hasChanges, type InclusionChange } from './diff.js';
import {
  getBinding,
  getCachedConfig,
  getLocalConfig,
  setCachedConfig,
  type Binding,
} from './binding.js';
import {
  DEFAULT_STALE_HOURS,
  resolveLocalGate,
  resolvePdsGate,
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
  /** §3 garden-change transparency: what this poll changed vs. the last one. */
  changes?: InclusionChange;
}

/** Wrap the Phase-1 dev inclusion list as a config for the unprovisioned demo. */
export function devConfig(): BluebirdConfig {
  return {
    ...newExplorerConfig('Bluebird demo'),
    // The public demo keeps the tightest possible ceiling — only the included
    // accounts, no injected outside reposts. The showReposts switch itself
    // defaults true for real explorers (§2); this is just the demo's choice.
    showReposts: false,
    channels: [
      { id: 'dev', name: 'Bluebird demo', enabled: true, accounts: DEV_INCLUSION.entries.map((e) => ({ actor: e.actor, displayName: e.displayName })) },
    ],
  };
}

function inclusionFor(gate: Gate): InclusionEntry[] {
  return gate.kind === 'active' ? effectiveInclusion(gate.config) : [];
}

async function pollPds(repo: RepoClient, binding: Binding): Promise<PollResult> {
  try {
    const pdsHost = binding.pdsHost ?? (await repo.resolvePds(binding.sponsorDid));
    const rec = await repo.getRecord(pdsHost, {
      repo: binding.sponsorDid,
      collection: BLUEBIRD_CONFIG_NSID,
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
    // Read the prior cache BEFORE the poll overwrites it, to diff the garden.
    const prior = getCachedConfig();
    const poll = await pollPds(repo, binding);
    let changes: InclusionChange | undefined;
    if (poll.status === 'ok') {
      if (prior) {
        const diff = diffInclusion(effectiveInclusion(prior.config), effectiveInclusion(poll.config));
        if (hasChanges(diff)) changes = diff;
      }
      setCachedConfig({ config: poll.config, fetchedAt: now });
    }
    const cached = getCachedConfig();
    // Per-explorer staleness window (§2, default 72h). Prefer an explicit dep,
    // else the freshest config we hold (poll result was just cached above).
    const staleHours = deps.staleHours ?? cached?.config.staleHours ?? DEFAULT_STALE_HOURS;
    const gate = resolvePdsGate(poll, cached, now, staleHours);
    return { gate, inclusion: inclusionFor(gate), ...(changes ? { changes } : {}) };
  }

  const local = getLocalConfig();
  if (local) {
    const gate = resolveLocalGate(local, 'local');
    return { gate, inclusion: inclusionFor(gate) };
  }

  const gate = resolveLocalGate(devConfig(), 'dev-fixture');
  return { gate, inclusion: inclusionFor(gate) };
}
