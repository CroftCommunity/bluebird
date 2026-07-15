import type { Page } from '@playwright/test';

/**
 * Seed a "set-up" explorer device by writing a local config into localStorage
 * before the app boots. Without this, `/` shows the S1 landing (an un-set-up
 * device never sees the garden). The three accounts match the shared garden
 * fixtures (authorFeed.ts / embeds.ts).
 */
export async function seedExplorer(
  page: Page,
  overrides: Partial<{
    showReposts: boolean;
    skin: 'simple' | 'full';
    paused: boolean;
    friends: { did: string; displayName?: string }[];
    showFriendsHearts: boolean;
    approvedFeeds: { uri: string; name: string }[];
    search: Record<string, unknown>;
  }> = {},
): Promise<void> {
  const config = {
    version: 2,
    displayName: 'Test Explorer',
    localOnly: true,
    skin: overrides.skin ?? 'simple',
    paused: overrides.paused ?? false,
    updatedAt: '2026-07-15T00:00:00.000Z',
    channels: [
      {
        id: 'dev',
        name: 'Garden',
        enabled: true,
        accounts: [{ actor: 'bsky.app' }, { actor: 'atproto.com' }, { actor: 'safety.bsky.app' }],
      },
    ],
    friends: overrides.friends ?? [],
    showFriendsHearts: overrides.showFriendsHearts ?? false,
    approvedFeeds: overrides.approvedFeeds ?? [],
    search: overrides.search ?? {
      tier: 'off',
      useAllowlist: false,
      allowlistExtra: [],
      useBlocklist: true,
      blocklistExtra: [],
      logHistory: true,
    },
    showReposts: overrides.showReposts ?? false,
    staleHours: 72,
  };
  await page.addInitScript((c) => {
    window.localStorage.setItem('skylite.config.local', JSON.stringify(c));
  }, config);
}
