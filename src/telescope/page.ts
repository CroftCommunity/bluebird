import { installTheme } from '../brand/theme.js';
import { skyliteVersion } from '../version.js';
import { el, clear } from '../render/dom.js';
import { registerServiceWorker } from '../pwa/register.js';
import { renderPausedLock, renderStaleLock } from '../render/locks.js';
import { resolveGarden } from '../config/provider.js';
import { renderGardenInto, type GardenResult } from '../garden.js';
import { renderPost } from '../render/post.js';
import { AuthorFeedClient } from '../atproto/client.js';
import { filterByLabels } from '../feed/labels.js';
import { queryAllowed } from '../search/policy.js';
import { showHelpHandoff } from '../care/handoff.js';
import { logSearch, getSearchHistory } from '../search/history.js';
import { archiveSearch } from '../search/archive.js';
import { makeFollowUi } from '../social/follow-ui.js';
import { getExplorerSession, persistExplorerSession } from '../social/explorer-auth.js';
import type { OAuthSession } from '../atproto/oauth/client.js';
import type { SkyliteApprovedFeed, SkyliteConfig } from '../config/types.js';

/**
 * §Telescope — sponsor-curated discovery. Two rungs on one page:
 *  · Rung 1: browse the sponsor's APPROVED feed generators.
 *  · Rung 2: SEARCH, shown only when the sponsor set a reach tier
 *    (config.search.tier: 'discovery' | 'open'). Queries are gated by the
 *    trust-gradient policy (src/search/policy.ts) BEFORE the read, results are
 *    label-floored AFTER, and — when logHistory is on — every attempt is recorded
 *    for the sponsor. See docs/telescope-search.md.
 * A discovery surface shows outside authors, so the same safety layers as the
 * garden apply, unchanged: label floor, no counts, gated links, navigation wall,
 * and the D1 follow control to pull a voice into My Sky.
 */

let explorerSession: OAuthSession | null = null;
let discoveryAuthorCache: Set<string> | null = null;

function followUi() {
  return makeFollowUi({
    getSession: () => explorerSession,
    setSession: (s) => {
      explorerSession = s;
      persistExplorerSession(s);
    },
  });
}

// --- rung 1: approved feeds ---------------------------------------------------

async function loadFeed(list: HTMLElement, feed: SkyliteApprovedFeed): Promise<void> {
  renderGardenInto(list, { posts: [], failedActors: [] }, 'loading');
  try {
    const res = await new AuthorFeedClient().getFeed(feed.uri, { limit: 30 });
    const posts = filterByLabels(res.feed.map((fv) => fv.post));
    const result: GardenResult = { posts, failedActors: [] };
    const status = posts.length > 0 ? 'ready' : 'empty';
    renderGardenInto(list, result, status, { follow: followUi() });
  } catch {
    renderGardenInto(list, { posts: [], failedActors: [feed.uri] }, 'error');
  }
}

function picker(feeds: SkyliteApprovedFeed[], onPick: (f: SkyliteApprovedFeed) => void): HTMLElement {
  const row = el('div', { class: 'telescope__picker', 'data-telescope-picker': 'true' });
  feeds.forEach((feed, i) => {
    const btn = el('button', {
      class: 'telescope__feed',
      type: 'button',
      'data-telescope-feed': feed.uri,
      ...(i === 0 ? { 'aria-current': 'true' } : {}),
    }, [feed.name || feed.uri]);
    btn.addEventListener('click', () => {
      row.querySelectorAll('[aria-current]').forEach((b) => b.removeAttribute('aria-current'));
      btn.setAttribute('aria-current', 'true');
      onPick(feed);
    });
    row.append(btn);
  });
  return row;
}

// --- rung 2: search -----------------------------------------------------------

/** The set of authors the sponsor's approved feeds surface — the ceiling for the
 *  'discovery' tier (search stays within these voices). Fetched once, cached. */
async function discoveryAuthors(feeds: SkyliteApprovedFeed[]): Promise<Set<string>> {
  if (discoveryAuthorCache) return discoveryAuthorCache;
  const set = new Set<string>();
  const client = new AuthorFeedClient();
  await Promise.allSettled(
    feeds.map(async (f) => {
      const res = await client.getFeed(f.uri, { limit: 50 });
      for (const fv of res.feed) set.add(fv.post.author.did);
    }),
  );
  discoveryAuthorCache = set;
  return set;
}

function renderResults(results: HTMLElement, status: string, posts: ReturnType<typeof filterByLabels>): void {
  clear(results);
  if (status === 'loading') {
    results.append(el('p', { class: 'garden__status', 'data-search-status': 'loading' }, ['Looking…']));
    return;
  }
  if (status === 'error') {
    results.append(el('p', { class: 'garden__status', 'data-search-status': 'error' }, ["Couldn't search just now. Try again in a little while."]));
    return;
  }
  if (posts.length === 0) {
    results.append(el('p', { class: 'garden__status', 'data-search-status': 'empty' }, ['Nothing found for that. Try another word.']));
    return;
  }
  const list = el('div', { class: 'garden__list', 'data-garden-list': 'true' });
  for (const post of posts) list.append(renderPost(post, { follow: followUi() }));
  results.append(list);
}

/**
 * §RUN-TRUEUP Phase 2 — the gentle supportive panel shown for a self-harm-category
 * refusal. No shame, no clinical language, no lecture: it names the feeling and
 * offers the EXISTING get-help handoff (prefilled to the sponsor). Copy v1
 * [confirm before publish — every line].
 */
function carePanel(config: SkyliteConfig): HTMLElement {
  const help = el(
    'button',
    { type: 'button', class: 'telescope__care-help', 'data-search-care-help': 'true' },
    ['Get help'],
  );
  help.addEventListener('click', () => showHelpHandoff(config.help ?? {}));
  return el('section', { class: 'telescope__care', role: 'note', 'data-search-care': 'true' }, [
    el('span', { class: 'telescope__care-glyph', 'aria-hidden': 'true' }, ['💛']),
    el('p', { class: 'telescope__care-body' }, [
      'Some things feel too heavy to carry alone. Your sponsor cares about you and wants to hear from you — this button reaches them right away.',
    ]),
    help,
  ]);
}

async function runSearch(query: string, config: SkyliteConfig, results: HTMLElement, msg: HTMLElement): Promise<void> {
  const verdict = queryAllowed(query, config.search);
  if (config.search.logHistory && query.trim()) {
    const now = Date.now();
    logSearch(query.trim(), !verdict.ok, now);
    // Encrypted archive: when the sponsor published an audit key and the explorer
    // has an account, seal this attempt to that key and sync it (best-effort).
    void archiveSearch(
      { q: query.trim(), blocked: !verdict.ok, tier: config.search.tier, at: now },
      {
        session: explorerSession,
        ...(config.search.auditPubKeyJwk ? { auditPubKeyJwk: config.search.auditPubKeyJwk } : {}),
        nowIso: new Date(now).toISOString(),
      },
    ).then((s) => {
      if (s && s !== explorerSession) {
        explorerSession = s;
        persistExplorerSession(s);
      }
    });
  }

  if (!verdict.ok) {
    clear(results);
    // Care-aware refusal: a self-harm-category block opens a door (the RUN-05
    // get-help handoff) instead of the flat refusal line (§RUN-TRUEUP Phase 2).
    if (verdict.reason === 'blocked' && verdict.category === 'self-harm') {
      msg.textContent = '';
      results.append(carePanel(config));
      return;
    }
    msg.textContent =
      verdict.reason === 'blocked'
        ? "That search isn't allowed here."
        : verdict.reason === 'not-allowlisted'
          ? 'Try a topic like animals, space, art, or sports.'
          : 'Type something to search.';
    return;
  }
  msg.textContent = '';
  renderResults(results, 'loading', []);
  try {
    const { posts } = await new AuthorFeedClient().searchPosts(query.trim(), { limit: 25 });
    let floored = filterByLabels(posts);
    if (config.search.tier === 'discovery') {
      const authors = await discoveryAuthors(config.approvedFeeds);
      floored = floored.filter((p) => authors.has(p.author.did));
    }
    renderResults(results, floored.length > 0 ? 'ready' : 'empty', floored);
  } catch {
    renderResults(results, 'error', []);
  }
}

function historyList(): HTMLElement | null {
  const entries = getSearchHistory();
  if (entries.length === 0) return null;
  return el('details', { class: 'telescope__history', 'data-search-history': 'true' }, [
    el('summary', {}, ['Recent searches (your sponsor can see these)']),
    el(
      'ul',
      { class: 'telescope__history-list' },
      entries.slice(0, 12).map((e) =>
        el('li', { ...(e.blocked ? { 'data-blocked': 'true' } : {}) }, [e.blocked ? `${e.q} (blocked)` : e.q]),
      ),
    ),
  ]);
}

function searchSection(config: SkyliteConfig): HTMLElement {
  const input = el('input', {
    type: 'search',
    class: 'telescope__search-input',
    placeholder: config.search.tier === 'discovery' ? 'Search your feeds…' : 'Search the sky…',
    'aria-label': 'Search',
    'data-search-input': 'true',
  });
  const msg = el('span', { class: 'telescope__search-msg', role: 'status', 'data-search-msg': 'true' });
  const results = el('div', { class: 'garden', 'data-search-results': 'true', 'aria-live': 'polite' });

  const go = el('button', { type: 'button', class: 'telescope__search-go', 'data-search-go': 'true' }, ['Search']);
  const submit = (): void => void runSearch(input.value, config, results, msg).then(() => {
    // refresh the recent-searches disclosure after a logged attempt
    const old = section.querySelector('[data-search-history]');
    const fresh = config.search.logHistory ? historyList() : null;
    if (old && fresh) old.replaceWith(fresh);
    else if (old && !fresh) old.remove();
    else if (!old && fresh) row.after(fresh);
  });
  go.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });

  const row = el('div', { class: 'telescope__search-row' }, [input, go]);
  const note =
    config.search.tier === 'discovery'
      ? 'Search stays within the feeds your sponsor approved.'
      : 'Search is open. The calm rules still apply — nothing unsafe gets through, and blocked words are turned away.';
  // Honesty copy for the encrypted archive (docs/telescope-search.md). The scope
  // is deliberately "what", not whether/when (§RUN-TRUEUP Phase 1).
  const archiveNote = config.search.auditPubKeyJwk
    ? 'Your sponsor can read what you search here. It is stored scrambled, so no one else can read what you searched.'
    : null;
  const section = el('section', { class: 'telescope__search', 'data-search': 'true' }, [
    row,
    el('p', { class: 'g-hint' }, [note]),
    ...(archiveNote ? [el('p', { class: 'g-hint', 'data-archive-note': 'true' }, [archiveNote])] : []),
    msg,
    results,
  ]);
  const hist = config.search.logHistory ? historyList() : null;
  if (hist) row.after(hist);
  return section;
}

// --- page ---------------------------------------------------------------------

function message(root: HTMLElement, text: string, kind: string): void {
  clear(root);
  root.append(el('p', { class: 'garden__status', 'data-telescope-status': kind }, [text]));
}

async function render(root: HTMLElement): Promise<void> {
  const { gate } = await resolveGarden();
  if (gate.kind === 'paused') return renderPausedLock(root);
  if (gate.kind === 'stale-locked') return renderStaleLock(root);

  const config = gate.config;
  const feeds = config.approvedFeeds;
  const searchOn = config.search.tier !== 'off';

  if (feeds.length === 0 && !searchOn) {
    message(
      root,
      'No discovery feeds yet. Someone who looks after you can add trusted feeds to open here.',
      'empty',
    );
    return;
  }

  clear(root);
  if (searchOn) root.append(searchSection(config));

  if (feeds.length > 0) {
    const list = el('main', { class: 'garden', 'data-telescope-list': 'true', 'aria-live': 'polite' });
    root.append(picker(feeds, (feed) => void loadFeed(list, feed)), list);
    const firstFeed = feeds[0];
    if (firstFeed) await loadFeed(list, firstFeed);
  }
}

function boot(): void {
  installTheme();
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();
  registerServiceWorker();
  explorerSession = getExplorerSession();

  const root = document.querySelector<HTMLElement>('[data-telescope]');
  if (root) void render(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
