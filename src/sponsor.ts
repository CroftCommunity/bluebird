import { installTheme } from './brand/theme.js';
import { bluebirdVersion } from './version.js';
import { el, clear } from './render/dom.js';
import { BLUEBIRD_CONFIG_NSID } from './config/types.js';
import type { BluebirdChannel, BluebirdConfig } from './config/types.js';
import { newExplorerConfig } from './config/parse.js';
import { provisioningUrl } from './config/binding.js';
import { registerServiceWorker } from './pwa/register.js';
import { randomRkey } from './atproto/tid.js';
import {
  listExplorers,
  upsertExplorer,
  removeExplorer,
  getSponsorIdentity,
  setSponsorIdentity,
  type SponsorIdentity,
} from './sponsor/store.js';
import { ensureAuditVault } from './sponsor/audit-key.js';
import {
  startSignIn,
  finishSignInFromUrl,
  getSession,
  clearSession,
  publishRecord,
} from './sponsor/oauth.js';
import type { OAuthSession } from './atproto/oauth/client.js';

/**
 * S2 sponsor dashboard — the sponsor's own device. Multi-explorer local
 * authoring: one card per explorer, each a config record at a RANDOM rkey.
 * Create/edit/remove; per-explorer provisioning link (sponsorDid + rkey, no
 * secrets). Public-record hygiene is enforced inline. App passwords are rejected
 * everywhere (BLUEBIRD-DIRECTIVES §S2) — the old app-password publish path is
 * gone; records go into the sponsor's PDS out of band (or over OAuth, a
 * verify-in-run item) using the exported JSON below.
 */

let root: HTMLElement | null = null;

// --- small DOM helpers -------------------------------------------------------

function textInput(value: string, placeholder: string, onInput: (v: string) => void, type = 'text'): HTMLInputElement {
  const input = el('input', { type, value, placeholder, class: 'g-input' });
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

function button(text: string, cls: string, onClick: () => void, attrs: Record<string, string> = {}): HTMLButtonElement {
  const b = el('button', { type: 'button', class: cls, ...attrs }, [text]);
  b.addEventListener('click', onClick);
  return b;
}

function toggle(label: string, checked: boolean, onChange: (v: boolean) => void, big = false): HTMLElement {
  const box = el('input', { type: 'checkbox', class: 'g-check', ...(checked ? { checked: 'checked' } : {}) });
  box.addEventListener('change', () => onChange(box.checked));
  return el('label', { class: `g-toggle${big ? ' g-toggle--big' : ''}` }, [box, el('span', {}, [label])]);
}

function field(labelText: string, control: HTMLElement, hint?: string): HTMLElement {
  return el('label', { class: 'g-field' }, [
    el('span', { class: 'g-field__label' }, [labelText]),
    control,
    ...(hint ? [el('span', { class: 'g-hint' }, [hint])] : []),
  ]);
}

/** A plain sub-section within the explorer column — a heading, optional intro,
 *  then its controls. Deliberately NOT a raised card: the explorer card is one
 *  flat column of fields, not a stack of nested bubbles. */
function section(title: string, children: HTMLElement[], intro?: string): HTMLElement {
  return el('section', { class: 'g-section' }, [
    el('h3', {}, [title]),
    ...(intro ? [el('p', { class: 'g-hint' }, [intro])] : []),
    ...children,
  ]);
}

// --- record shaping ----------------------------------------------------------

function recordBody(config: BluebirdConfig): BluebirdConfig {
  return { $type: BLUEBIRD_CONFIG_NSID, ...config, updatedAt: new Date().toISOString() };
}

// --- explorer card -----------------------------------------------------------

function renderChannel(config: BluebirdConfig, channel: BluebirdChannel, index: number, save: () => void): HTMLElement {
  const accounts = channel.accounts.map((acct, i) =>
    el('div', { class: 'g-account' }, [
      textInput(acct.actor, 'handle or did:…', (v) => {
        acct.actor = v.trim();
        save();
      }),
      textInput(acct.displayName ?? '', 'name (optional)', (v) => {
        if (v.trim()) acct.displayName = v;
        else delete acct.displayName;
        save();
      }),
      button('✕', 'g-btn g-btn--icon', () => {
        channel.accounts.splice(i, 1);
        save();
        rerender();
      }, { 'aria-label': 'Remove account' }),
    ]),
  );

  return el('section', { class: 'g-channel', 'data-channel': channel.id }, [
    el('div', { class: 'g-channel__head' }, [
      textInput(channel.name, 'Channel name', (v) => {
        channel.name = v;
        save();
      }),
      toggle('On', channel.enabled, (v) => {
        channel.enabled = v;
        save();
      }),
      button('Remove', 'g-btn g-btn--ghost', () => {
        config.channels.splice(index, 1);
        save();
        rerender();
      }),
    ]),
    ...accounts,
    button('+ Add account', 'g-btn g-btn--ghost', () => {
      channel.accounts.push({ actor: '' });
      save();
      rerender();
    }),
  ]);
}

function renderFriends(config: BluebirdConfig, save: () => void): HTMLElement {
  const rows = config.friends.map((f, i) =>
    el('div', { class: 'g-account' }, [
      textInput(f.did, 'did:plc:… (friend, reciprocal)', (v) => {
        f.did = v.trim();
        save();
      }),
      textInput(f.displayName ?? '', 'name (optional)', (v) => {
        if (v.trim()) f.displayName = v;
        else delete f.displayName;
        save();
      }),
      button('✕', 'g-btn g-btn--icon', () => {
        config.friends.splice(i, 1);
        save();
        rerender();
      }, { 'aria-label': 'Remove friend' }),
    ]),
  );
  return el('div', {}, [
    ...rows,
    button('+ Add friend', 'g-btn g-btn--ghost', () => {
      config.friends.push({ did: '' });
      save();
      rerender();
    }),
  ]);
}

function renderFeeds(config: BluebirdConfig, save: () => void): HTMLElement {
  const rows = config.approvedFeeds.map((feed, i) =>
    el('div', { class: 'g-account' }, [
      textInput(feed.uri, 'at://…/app.bsky.feed.generator/…', (v) => {
        feed.uri = v.trim();
        save();
      }),
      textInput(feed.name, 'feed name', (v) => {
        feed.name = v;
        save();
      }),
      button('✕', 'g-btn g-btn--icon', () => {
        config.approvedFeeds.splice(i, 1);
        save();
        rerender();
      }, { 'aria-label': 'Remove feed' }),
    ]),
  );
  return el('div', {}, [
    ...rows,
    button('+ Add feed', 'g-btn g-btn--ghost', () => {
      config.approvedFeeds.push({ uri: '', name: '' });
      save();
      rerender();
    }),
  ]);
}

function skinSelect(config: BluebirdConfig, save: () => void): HTMLSelectElement {
  const sel = el('select', { class: 'g-input' }, [
    el('option', { value: 'simple', ...(config.skin === 'simple' ? { selected: 'selected' } : {}) }, ['Simple']),
    el('option', { value: 'full', ...(config.skin === 'full' ? { selected: 'selected' } : {}) }, ['Full']),
  ]);
  sel.addEventListener('change', () => {
    config.skin = sel.value === 'full' ? 'full' : 'simple';
    save();
  });
  return sel;
}

/** §Telescope rung 2 — the search trust-gradient controls (docs/trail-map-search.md). */
function searchSettings(config: BluebirdConfig, save: () => void): HTMLElement {
  const s = config.search;
  const tierSel = el('select', { class: 'g-input', 'data-search-tier': 'true' }, [
    el('option', { value: 'off', ...(s.tier === 'off' ? { selected: 'selected' } : {}) }, ['Off — approved feeds only']),
    el('option', { value: 'discovery', ...(s.tier === 'discovery' ? { selected: 'selected' } : {}) }, [
      'Within discovery — search only the authors your approved feeds surface',
    ]),
    el('option', { value: 'open', ...(s.tier === 'open' ? { selected: 'selected' } : {}) }, [
      'Open — search the whole sky (under the safeguards below)',
    ]),
  ]);
  tierSel.addEventListener('change', () => {
    s.tier = tierSel.value === 'discovery' ? 'discovery' : tierSel.value === 'open' ? 'open' : 'off';
    save();
  });

  const commaList = (label: string, values: string[], onSet: (v: string[]) => void, placeholder: string): HTMLElement =>
    field(
      label,
      textInput(values.join(', '), placeholder, (v) => {
        onSet(v.split(',').map((t) => t.trim()).filter(Boolean));
        save();
      }),
    );

  return el('section', { class: 'g-section' }, [
    el('h3', {}, ['Search (Telescope rung 2)']),
    el('p', { class: 'g-hint' }, [
      'A trust gradient, not a locked room. The label floor (no adult or graphic content) always applies. See the safeguards below.',
    ]),
    field('How far search can reach', tierSel),
    toggle('Block unsafe search terms (recommended)', s.useBlocklist, (v) => {
      s.useBlocklist = v;
      save();
    }),
    commaList('Extra blocked words (comma-separated)', s.blocklistExtra, (v) => (s.blocklistExtra = v), 'e.g. word1, word2'),
    toggle('Only allow searches about approved topics', s.useAllowlist, (v) => {
      s.useAllowlist = v;
      save();
    }),
    commaList('Extra allowed topics (comma-separated)', s.allowlistExtra, (v) => (s.allowlistExtra = v), 'e.g. astronomy, chess'),
    toggle('Let me see what was searched (search history)', s.logHistory, (v) => {
      s.logHistory = v;
      save();
    }),
    el('p', { class: 'g-hint' }, [
      'With the allowlist off, searches are open except for blocked words. With it on, a search must match an allowed topic. Both can be on together.',
    ]),
    encryptedArchiveControl(config, save),
  ]);
}

/**
 * §Phase 3 — turn on the ENCRYPTED search-history archive. Creates (or reuses)
 * this device's audit keypair, protected by a passphrase, and publishes its
 * PUBLIC key into the config so the explorer device seals history to it. Only
 * this device's private key can ever read it (docs/trail-map-search.md).
 */
function encryptedArchiveControl(config: BluebirdConfig, save: () => void): HTMLElement {
  const msg = el('span', { class: 'g-msg', role: 'status', 'data-archive-msg': 'true' });
  const wrap = el('div', { class: 'g-subcard', 'data-archive-control': 'true' });

  const render = (): void => {
    clear(wrap);
    if (config.search.auditPubKeyJwk) {
      wrap.append(
        el('p', { class: 'g-hint' }, [
          'Encrypted history is ON. Searches are stored scrambled and only this device can read them. Keep this device — lose it and the history becomes unreadable.',
        ]),
        button('Turn off encrypted history', 'g-btn g-btn--ghost', () => {
          delete config.search.auditPubKeyJwk;
          save();
          render();
        }, { 'data-archive-off': 'true' }),
        msg,
      );
      return;
    }
    const enableWith = (opts: { method: 'passphrase' | 'webauthn-prf'; passphrase?: string }): void => {
      msg.textContent = 'Setting up the encryption key…';
      void ensureAuditVault(opts)
        .then((pubKeyJwk) => {
          config.search.auditPubKeyJwk = pubKeyJwk;
          save();
          render();
        })
        .catch(() => {
          msg.textContent =
            opts.method === 'webauthn-prf'
              ? "Couldn't set up a passkey on this device. Try a passphrase instead."
              : "Couldn't set up the key on this device.";
        });
    };

    const pass = textInput('', 'a passphrase only you know', () => {}, 'password');
    pass.setAttribute('data-archive-pass', 'true');
    wrap.append(
      el('p', { class: 'g-hint' }, [
        'Store search history with bank-grade encryption (the same AES-256 + P-256 as banking apps) so no one but you can read it — not even on the public network. Lock the key to this device with a passphrase, or this device’s passkey / fingerprint.',
      ]),
      field('Passphrase for the history key', pass),
      button('Turn on with a passphrase', 'g-btn g-btn--primary', () => {
        if (pass.value.length < 8) {
          msg.textContent = 'Use at least 8 characters.';
          return;
        }
        enableWith({ method: 'passphrase', passphrase: pass.value });
      }, { 'data-archive-on': 'true' }),
      button('Use this device’s passkey / fingerprint', 'g-btn g-btn--ghost', () => {
        enableWith({ method: 'webauthn-prf' });
      }, { 'data-archive-on-passkey': 'true' }),
      msg,
    );
  };
  render();
  return wrap;
}

function helpFields(config: BluebirdConfig, save: () => void): HTMLElement {
  const wrap = el('div', {});
  wrap.append(
    textInput(config.help?.contactName ?? '', 'e.g. Mum', (v) => {
      config.help = { ...config.help, contactName: v };
      save();
    }),
    textInput(config.help?.contactEmail ?? '', 'name@example.com', (v) => {
      config.help = { ...config.help, contactEmail: v };
      save();
    }, 'email'),
  );
  return wrap;
}

function staleField(config: BluebirdConfig, save: () => void): HTMLInputElement {
  const n = el('input', { type: 'number', min: '1', class: 'g-input', value: String(config.staleHours) });
  n.addEventListener('input', () => {
    const v = Number(n.value);
    if (Number.isFinite(v) && v > 0) {
      config.staleHours = Math.floor(v);
      save();
    }
  });
  return n;
}

function renderExplorerCard(rkey: string, config: BluebirdConfig, identity: SponsorIdentity): HTMLElement {
  const name = config.displayName || 'Unnamed explorer';

  const jsonArea = el('textarea', { class: 'g-json', readonly: 'readonly', rows: 8, 'data-record-json': rkey });
  jsonArea.value = JSON.stringify(recordBody(config), null, 2);

  // Persist on every edit AND keep the exported record body live (text edits
  // don't re-render the card, so refresh the JSON here).
  const save = (): void => {
    upsertExplorer(rkey, config);
    jsonArea.value = JSON.stringify(recordBody(config), null, 2);
  };

  const link = identity.did
    ? provisioningUrl(`${window.location.origin}/`, {
        sponsorDid: identity.did,
        rkey,
        ...(identity.pdsHost ? { pdsHost: identity.pdsHost } : {}),
      })
    : '';
  const linkInput = el('input', { type: 'text', class: 'g-input', readonly: 'readonly', value: link, 'data-provision-link': rkey });
  const copyMsg = el('span', { class: 'g-msg' });

  return el('article', { class: 'g-card g-explorer', 'data-explorer': rkey }, [
    el('div', { class: 'g-explorer__head' }, [
      el('h2', { 'data-explorer-name': rkey }, [name]),
      button('Remove explorer', 'g-btn g-btn--ghost', () => {
        if (window.confirm(`Remove ${name}? This only removes it from this device.`)) {
          removeExplorer(rkey);
          rerender();
        }
      }, { 'data-remove-explorer': rkey }),
    ]),

    field(
      'Nickname',
      textInput(config.displayName, 'e.g. Little Bear', (v) => {
        config.displayName = v;
        save();
        const h = root?.querySelector(`[data-explorer-name="${rkey}"]`);
        if (h) h.textContent = v || 'Unnamed explorer';
      }),
      'A nickname — never a real or legal name, school, or age. This record is public.',
    ),

    section('Sharing', [
      toggle('Cabin Mode — on this device only, no account', config.localOnly, (v) => {
        config.localOnly = v;
        save();
        rerender();
      }, true),
      el('p', { class: 'g-hint' }, [
        config.localOnly
          ? 'On: what happens in the cabin stays in the cabin — the explorer has no account and nothing about them leaves their device. Turn this off (together, when the time is right) to give them hearts and shared follows — that creates a public account.'
          : 'Off: the explorer has an account, so their hearts and follows exist as public records.',
      ]),
      field('Look (cosmetic only — never changes what the device can do)', skinSelect(config, save)),
      toggle('Pause Bluebird for this explorer', config.paused, (v) => {
        config.paused = v;
        save();
      }, true),
    ]),

    section(
      'Channels',
      [
        ...config.channels.map((c, i) => renderChannel(config, c, i, save)),
        button('+ Add channel', 'g-btn', () => {
          config.channels.push({ id: `channel-${config.channels.length + 1}`, name: 'New channel', enabled: true, accounts: [{ actor: '' }] });
          save();
          rerender();
        }),
      ],
      'The explorer sees the accounts in every channel that is On.',
    ),

    section('Reposts & discovery', [
      toggle('Show reposts', config.showReposts, (v) => {
        config.showReposts = v;
        save();
      }),
      el('p', { class: 'g-hint' }, [
        'Reposts pull in whole posts from outside the garden. Labels are the only safety layer for those outside authors. Turn off for the tightest garden.',
      ]),
      toggle('Let a Cabin Mode explorer see friends’ hearts', config.showFriendsHearts, (v) => {
        config.showFriendsHearts = v;
        save();
      }),
    ]),

    section(
      'Friends (reciprocal, curated)',
      [renderFriends(config, save)],
      'Friends, by DID, whose hearts may show among friends. Add only people you both trust.',
    ),

    section('Approved feeds (Telescope)', [renderFeeds(config, save)]),

    searchSettings(config, save),

    section('Extras', [
      field('Contact for the “Get help” button (optional)', helpFields(config, save)),
      field('Check-in window (hours unreachable before the garden locks)', staleField(config, save)),
    ]),

    el('section', { class: 'g-section g-provision' }, [
      el('h3', {}, ['Send this explorer their link']),
      el('p', { class: 'g-hint' }, [
        'Copy this link and send it to the explorer. When they open it on their device, that device becomes their garden. The link carries only public information — never a password.',
      ]),
      identity.did
        ? el('div', { class: 'g-row' }, [
            linkInput,
            button('Copy link', 'g-btn g-btn--primary', () => {
              linkInput.select();
              void navigator.clipboard?.writeText(link).then(
                () => (copyMsg.textContent = 'Copied.'),
                () => (copyMsg.textContent = 'Select and copy the link above.'),
              );
            }, { 'data-copy-link': rkey }),
            copyMsg,
          ])
        : el('p', { class: 'g-msg' }, ['Sign in (or set your account below) to make a device link.']),
      publishRow(rkey, config),
      el('details', { class: 'g-details' }, [
        el('summary', {}, ['Advanced: the raw record']),
        el('p', { class: 'g-hint' }, [
          'Record key (random, not a name): ',
          el('code', {}, [rkey]),
          '. This record is public, like everything on the network.',
        ]),
        field(`Record body (store as ${BLUEBIRD_CONFIG_NSID}/${rkey})`, jsonArea),
      ]),
      el('p', {}, [
        el('a', { class: 'g-btn g-btn--ghost', href: `audit.html?r=${encodeURIComponent(rkey)}`, 'data-audit-link': rkey }, [
          'See what the garden hid, and why',
        ]),
      ]),
    ]),
  ]);
}

/** Publish-to-PDS control for one explorer — only when signed in over OAuth. */
function publishRow(rkey: string, config: BluebirdConfig): HTMLElement {
  const session = getSession();
  if (!session) {
    return el('p', { class: 'g-hint', 'data-publish-signedout': rkey }, [
      'Sign in with Bluesky above to publish this record to your PDS.',
    ]);
  }
  const msg = el('span', { class: 'g-msg', 'data-publish-msg': rkey });
  return el('div', { class: 'g-row' }, [
    button('Publish to my PDS', 'g-btn g-btn--primary', () => {
      msg.textContent = 'Publishing…';
      void publishRecord(session, rkey, recordBody(config)).then(
        (uri) => (msg.textContent = `Published. ${uri}`),
        (e: unknown) => (msg.textContent = e instanceof Error ? e.message : 'Publish failed.'),
      );
    }, { 'data-publish-btn': rkey }),
    msg,
  ]);
}

// --- top-level sections ------------------------------------------------------

/** Signed-in view: who you are (by handle when known) + sign out. */
function renderSignedIn(session: OAuthSession): HTMLElement {
  const who = session.handle ? `@${session.handle}` : session.did;
  return el('div', { class: 'g-signin', 'data-signin': 'in' }, [
    el('p', { class: 'g-msg', 'data-signed-in-as': 'true' }, ['Signed in as ', el('strong', {}, [who]), '.']),
    el('p', { class: 'g-hint' }, [
      'Your explorers’ links are ready below. Use “Publish to my PDS” on any explorer to save its settings to your account.',
    ]),
    button('Sign out', 'g-btn g-btn--ghost', () => {
      clearSession();
      rerender();
    }, { 'data-signout': 'true' }),
  ]);
}

/** Signed-out view: the primary sign-in path + an advanced no-account path. */
function renderSignedOut(identity: SponsorIdentity): HTMLElement {
  const handle = textInput('', 'your handle, e.g. you.bsky.social', () => undefined);
  handle.setAttribute('data-signin-handle', 'true');
  const msg = el('span', { class: 'g-msg', 'data-signin-msg': 'true' });

  const advancedMsg = el('span', { class: 'g-msg', 'data-apply-msg': 'true' });
  const advanced = el('details', { class: 'g-details', 'data-advanced-identity': 'true' }, [
    el('summary', {}, ['Set up without signing in']),
    el('p', { class: 'g-hint' }, [
      'Have your account (DID) and save each explorer’s record to your account yourself. Signing in above does this for you.',
    ]),
    field(
      'Your account (DID)',
      textInput(identity.did ?? '', 'did:plc:…', (v) => {
        setSponsorIdentity({ ...getSponsorIdentity(), did: v.trim() });
      }),
    ),
    field(
      'PDS host (optional)',
      textInput(identity.pdsHost ?? '', 'e.g. https://…', (v) => {
        setSponsorIdentity({ ...getSponsorIdentity(), pdsHost: v.trim() });
      }),
    ),
    el('div', { class: 'g-row' }, [
      button('Apply', 'g-btn g-btn--primary', () => {
        if (!getSponsorIdentity().did) {
          advancedMsg.textContent = 'Enter your account DID first.';
          return;
        }
        rerender();
      }, { 'data-apply-identity': 'true' }),
      advancedMsg,
    ]),
  ]);

  return el('div', { class: 'g-signin', 'data-signin': 'out' }, [
    field('Sign in with Bluesky', handle, 'Opens Bluesky in this window, then brings you right back here. No app passwords.'),
    el('div', { class: 'g-row' }, [
      button('Sign in with Bluesky', 'g-btn g-btn--primary', () => {
        if (!handle.value.trim()) {
          msg.textContent = 'Enter your handle or DID.';
          return;
        }
        msg.textContent = 'Redirecting to Bluesky…';
        void startSignIn(handle.value).catch((e: unknown) => {
          msg.textContent = e instanceof Error ? e.message : 'Sign-in failed.';
        });
      }, { 'data-signin-btn': 'true' }),
      msg,
    ]),
    advanced,
  ]);
}

function renderIdentity(identity: SponsorIdentity): HTMLElement {
  const session = getSession();
  return el('div', { class: 'g-card' }, [
    el('h2', {}, ['You (the sponsor)']),
    el('p', { class: 'g-hint' }, [
      'Explorer records live under your account. Provisioning links carry only your public information.',
    ]),
    session ? renderSignedIn(session) : renderSignedOut(identity),
  ]);
}

/** The one-time flow orientation + a link to the fuller sponsor guide. */
function renderIntro(): HTMLElement {
  return el('div', { class: 'g-card g-intro', 'data-intro': 'true' }, [
    el('h2', {}, ['Set up a garden']),
    el('p', { class: 'g-hint' }, [
      'You build gardens here, on your own device — you don’t need the explorer’s device. For each explorer, pick what they see, then copy their link and send it. They open it on their device to start their garden.',
    ]),
    el('p', {}, [
      el('a', { class: 'g-btn g-btn--ghost', href: 'ski-school.html', 'data-guide-link': 'true' }, [
        'Ski School — setup + securing your account',
      ]),
    ]),
  ]);
}

function render(): void {
  if (!root) return;
  clear(root);
  const identity = getSponsorIdentity();
  const explorers = listExplorers();

  root.append(
    renderIntro(),
    renderIdentity(identity),
    el('div', { class: 'g-explorers', 'data-explorers': 'true' }, [
      el('div', { class: 'g-explorers__head' }, [
        el('h2', {}, [explorers.length ? `Explorers (${explorers.length})` : 'Explorers']),
        button('+ Add explorer', 'g-btn g-btn--primary', () => {
          const rkey = randomRkey();
          upsertExplorer(rkey, newExplorerConfig());
          rerender();
        }, { 'data-add-explorer': 'true' }),
      ]),
      ...(explorers.length
        ? explorers.map((e) => renderExplorerCard(e.rkey, e.config, identity))
        : [el('p', { class: 'g-hint', 'data-no-explorers': 'true' }, ['No explorers yet. Add one to start a garden.'])]),
    ]),
  );
}

function rerender(): void {
  render();
}

function applySession(session: OAuthSession): void {
  // A signed-in sponsor's identity drives provisioning links; persist it.
  setSponsorIdentity({ ...getSponsorIdentity(), did: session.did, pdsHost: session.pds });
}

function boot(): void {
  installTheme();
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = bluebirdVersion();
  registerServiceWorker();
  root = document.querySelector<HTMLElement>('[data-sponsor]');
  render();

  // If this load is an OAuth callback, finish it, adopt the identity, re-render.
  void finishSignInFromUrl()
    .then((session) => {
      if (session) {
        applySession(session);
        rerender();
      }
    })
    .catch(() => {
      /* stale/failed callback — leave the dashboard as-is */
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
