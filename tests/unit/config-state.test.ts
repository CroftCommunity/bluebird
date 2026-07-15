import { describe, it, expect } from 'vitest';
import { resolvePdsGate, resolveLocalGate, type CachedConfig } from '../../src/config/state.js';
import { newExplorerConfig } from '../../src/config/parse.js';
import type { SkyliteConfig } from '../../src/config/types.js';

function cfg(paused: boolean): SkyliteConfig {
  return { ...newExplorerConfig(), paused };
}

const NOW = Date.parse('2026-07-14T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('resolvePdsGate', () => {
  it('active when poll ok and not paused', () => {
    expect(resolvePdsGate({ status: 'ok', config: cfg(false) }, null, NOW)).toEqual({
      kind: 'active',
      config: cfg(false),
      source: 'pds',
      offline: false,
    });
  });

  it('paused when poll ok and paused', () => {
    expect(resolvePdsGate({ status: 'ok', config: cfg(true) }, null, NOW)).toEqual({
      kind: 'paused',
      source: 'pds',
    });
  });

  it('stale-locked when unreachable and no cache', () => {
    expect(resolvePdsGate({ status: 'unreachable' }, null, NOW)).toEqual({
      kind: 'stale-locked',
      lastFetchedAt: null,
    });
  });

  it('pause persists from cache while offline', () => {
    const cache: CachedConfig = { config: cfg(true), fetchedAt: NOW - HOUR };
    expect(resolvePdsGate({ status: 'unreachable' }, cache, NOW)).toEqual({
      kind: 'paused',
      source: 'pds-cached',
    });
  });

  it('fails open for fresh cached content with the offline flag', () => {
    const cache: CachedConfig = { config: cfg(false), fetchedAt: NOW - HOUR };
    expect(resolvePdsGate({ status: 'unreachable' }, cache, NOW)).toEqual({
      kind: 'active',
      config: cfg(false),
      source: 'pds-cached',
      offline: true,
    });
  });

  it('fails closed once the cache is older than the staleness window', () => {
    const cache: CachedConfig = { config: cfg(false), fetchedAt: NOW - 73 * HOUR };
    expect(resolvePdsGate({ status: 'unreachable' }, cache, NOW)).toEqual({
      kind: 'stale-locked',
      lastFetchedAt: NOW - 73 * HOUR,
    });
  });

  it('honors a custom staleness window', () => {
    const cache: CachedConfig = { config: cfg(false), fetchedAt: NOW - 2 * HOUR };
    expect(resolvePdsGate({ status: 'unreachable' }, cache, NOW, 1).kind).toBe('stale-locked');
  });
});

describe('resolveLocalGate', () => {
  it('active when not paused', () => {
    expect(resolveLocalGate(cfg(false), 'local')).toEqual({
      kind: 'active',
      config: cfg(false),
      source: 'local',
      offline: false,
    });
  });
  it('paused when paused', () => {
    expect(resolveLocalGate(cfg(true), 'dev-fixture')).toEqual({ kind: 'paused', source: 'dev-fixture' });
  });
});
