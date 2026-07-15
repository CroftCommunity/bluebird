import { skyliteVersion } from './version.js';
import { el, clear } from './render/dom.js';
import { SKYLITE_CONFIG_NSID } from './config/types.js';
import type { SkyliteChannel, SkyliteConfig } from './config/types.js';
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
  getChecklist,
  setChecklistItem,
  type SponsorIdentity,
} from './sponsor/store.js';

/**
 * S2 sponsor dashboard — the sponsor's own device. Multi-explorer local
 * authoring: one card per explorer, each a config record at a RANDOM rkey.
 * Create/edit/remove; per-explorer provisioning link (sponsorDid + rkey, no
 * secrets). Public-record hygiene is enforced inline. App passwords are rejected
 * everywhere (SKYLITE-DIRECTIVES §S2) — the old app-password publish path is
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

// --- record shaping ----------------------------------------------------------

function recordBody(config: SkyliteConfig): SkyliteConfig {
  return { $type: SKYLITE_CONFIG_NSID, ...config, updatedAt: new Date().toISOString() };
}

// --- explorer card -----------------------------------------------------------

function renderChannel(config: SkyliteConfig, channel: SkyliteChannel, index: number, save: () => void): HTMLElement {
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

function renderFriends(config: SkyliteConfig, save: () => void): HTMLElement {
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

function renderFeeds(config: SkyliteConfig, save: () => void): HTMLElement {
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

function skinSelect(config: SkyliteConfig, save: () => void): HTMLSelectElement {
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

function helpFields(config: SkyliteConfig, save: () => void): HTMLElement {
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

function staleField(config: SkyliteConfig, save: () => void): HTMLInputElement {
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

function renderExplorerCard(rkey: string, config: SkyliteConfig, identity: SponsorIdentity): HTMLElement {
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

    el('div', { class: 'g-switches' }, [
      toggle('On this device only (no account)', config.localOnly, (v) => {
        config.localOnly = v;
        save();
        rerender();
      }, true),
      el('p', { class: 'g-hint' }, [
        config.localOnly
          ? 'On: no account, nothing about the explorer leaves the device. Turn off, together, to add hearts and shared follows.'
          : 'Off (sharing on): the explorer has an account; likes and follows exist as public records.',
      ]),
      field('Look (cosmetic only — never changes what the device can do)', skinSelect(config, save)),
      toggle('Pause Skylite for this explorer', config.paused, (v) => {
        config.paused = v;
        save();
      }, true),
    ]),

    el('div', { class: 'g-card' }, [
      el('h3', {}, ['Channels']),
      el('p', { class: 'g-hint' }, ['The explorer sees the accounts in every channel that is On.']),
      ...config.channels.map((c, i) => renderChannel(config, c, i, save)),
      button('+ Add channel', 'g-btn', () => {
        config.channels.push({ id: `channel-${config.channels.length + 1}`, name: 'New channel', enabled: true, accounts: [{ actor: '' }] });
        save();
        rerender();
      }),
    ]),

    el('div', { class: 'g-card' }, [
      el('h3', {}, ['Reposts & discovery']),
      toggle('Show reposts', config.showReposts, (v) => {
        config.showReposts = v;
        save();
      }),
      el('p', { class: 'g-hint' }, [
        'Reposts pull in whole posts from outside the garden. Labels are the only safety layer for those outside authors. Turn off for the tightest garden.',
      ]),
      toggle('Telescope: open search (points at the whole sky)', config.telescope, (v) => {
        config.telescope = v;
        save();
      }),
      toggle('Let a “this device only” explorer see friends’ hearts', config.showFriendsHearts, (v) => {
        config.showFriendsHearts = v;
        save();
      }),
    ]),

    el('div', { class: 'g-card' }, [
      el('h3', {}, ['Friends (reciprocal, curated)']),
      el('p', { class: 'g-hint' }, ['Friends, by DID, whose hearts may show among friends. Add only people you both trust.']),
      renderFriends(config, save),
    ]),

    el('div', { class: 'g-card' }, [
      el('h3', {}, ['Approved feeds (Telescope)']),
      renderFeeds(config, save),
    ]),

    field('Contact for the “Get help” button (optional)', helpFields(config, save)),
    field('Check-in window (hours unreachable before the garden locks)', staleField(config, save)),

    el('div', { class: 'g-card g-provision' }, [
      el('h3', {}, ['Set up this explorer’s device']),
      el('p', { class: 'g-hint' }, [
        'Record key (random, not a name): ',
        el('code', {}, [rkey]),
        '. This record is public, like everything on the network.',
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
        : el('p', { class: 'g-msg' }, ['Set your sponsor DID above to make a device link.']),
      field(`Record body (store as ${SKYLITE_CONFIG_NSID}/${rkey})`, jsonArea),
      el('p', {}, [
        el('a', { class: 'g-btn g-btn--ghost', href: `/audit.html?r=${encodeURIComponent(rkey)}`, 'data-audit-link': rkey }, [
          'See what the garden hid, and why',
        ]),
      ]),
    ]),
  ]);
}

// --- top-level sections ------------------------------------------------------

const CHECKLIST_ITEMS: { id: string; label: string }[] = [
  { id: 'email2fa', label: 'Turn on email 2FA for your Bluesky account (Settings, on bsky.social).' },
  { id: 'inbox', label: 'Harden the email inbox behind it (a strong, unique password and its own 2FA).' },
  { id: 'revoke', label: 'Know where to revoke device sessions (your PDS’s OAuth session page).' },
];

function renderChecklist(): HTMLElement {
  const state = getChecklist();
  const items = CHECKLIST_ITEMS.map((item) =>
    toggle(item.label, state[item.id] === true, (v) => setChecklistItem(item.id, v)),
  );
  return el('div', { class: 'g-card g-checklist', 'data-checklist': 'true' }, [
    el('h2', {}, ['First, secure your account']),
    el('p', { class: 'g-hint' }, [
      'A garden is only as safe as the account that tends it. Do these once before you invite an explorer:',
    ]),
    ...items,
  ]);
}

function renderIdentity(identity: SponsorIdentity): HTMLElement {
  return el('div', { class: 'g-card' }, [
    el('h2', {}, ['You (the sponsor)']),
    el('p', { class: 'g-hint' }, [
      'Your DID identifies where the explorer records live. Provisioning links carry only your DID and a record key — never a password or secret.',
    ]),
    field(
      'Sponsor DID',
      textInput(identity.did ?? '', 'did:plc:… (your sponsor DID)', (v) => {
        setSponsorIdentity({ ...getSponsorIdentity(), did: v.trim() });
      }),
    ),
    field(
      'PDS host',
      textInput(identity.pdsHost ?? '', 'PDS host (optional, e.g. https://…)', (v) => {
        setSponsorIdentity({ ...getSponsorIdentity(), pdsHost: v.trim() });
      }),
    ),
    el('div', { class: 'g-row' }, [button('Apply', 'g-btn g-btn--primary', () => rerender(), { 'data-apply-identity': 'true' })]),
    el('p', { class: 'g-hint' }, [
      'Publishing to your PDS uses Bluesky OAuth (app passwords are not used anywhere in Skylite). Until you publish, store each explorer’s record body (shown on its card) in your repo as ',
      el('code', {}, [SKYLITE_CONFIG_NSID]),
      ' at its record key.',
    ]),
  ]);
}

function render(): void {
  if (!root) return;
  clear(root);
  const identity = getSponsorIdentity();
  const explorers = listExplorers();

  root.append(
    renderChecklist(),
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

function boot(): void {
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();
  registerServiceWorker();
  root = document.querySelector<HTMLElement>('[data-sponsor]');
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
