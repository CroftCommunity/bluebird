import { installTheme } from './brand/theme.js';
import { skyliteVersion } from './version.js';
import { el, clear } from './render/dom.js';
import { registerServiceWorker } from './pwa/register.js';
import { listExplorers, getExplorerHandle, setExplorerHandle, type ExplorerEntry } from './sponsor/store.js';
import { effectiveInclusion } from './config/inclusion.js';
import { fetchAudit, LABEL_MEANINGS, type AccountAudit, type AuditResult } from './audit/audit.js';
import { unlockAuditKey, auditVault } from './sponsor/audit-key.js';
import { resolveHandleToDid, fetchSealedHistory, decryptHistory } from './search/audit-read.js';
import { relativeTime } from './render/time.js';

/**
 * S7 sponsor label-audit page. (a) Meanings: what Skylite does with each label
 * it acts on. (b) Effectiveness: replays the exact garden fetch+filter on the
 * sponsor's device over public data, counting what the label floor hid per label
 * per account plus label-excluded embeds — with expandable examples. Nothing is
 * collected from the explorer's device.
 */

let root: HTMLElement | null = null;

function meaningsSection(): HTMLElement {
  const rows = LABEL_MEANINGS.map((m) =>
    el('tr', {}, [
      el('td', { class: 'audit__label' }, [m.value]),
      el('td', {}, [m.description]),
      el('td', { class: 'audit__action' }, [m.action]),
    ]),
  );
  return el('section', { class: 'g-card', 'data-audit-meanings': 'true' }, [
    el('h2', {}, ['What each label means']),
    el('p', { class: 'g-hint' }, [
      'These are the labels Skylite acts on, and what it does. Label meanings come from the moderation services in play (Bluesky’s default service at minimum).',
    ]),
    el('table', { class: 'audit__table' }, [
      el('thead', {}, [el('tr', {}, [el('th', {}, ['Label']), el('th', {}, ['Meaning']), el('th', {}, ['What Skylite does'])])]),
      el('tbody', {}, rows),
    ]),
  ]);
}

function examples(list: { text: string; labels: string[]; actor: string }[]): HTMLElement | null {
  if (list.length === 0) return null;
  return el('details', { class: 'audit__examples' }, [
    el('summary', {}, [`Examples (${list.length})`]),
    ...list.map((ex) =>
      el('div', { class: 'audit__example' }, [
        el('span', { class: 'audit__example-labels' }, [ex.labels.join(', ')]),
        el('p', { class: 'audit__example-text' }, [ex.text.slice(0, 200) || '(no text)']),
      ]),
    ),
  ]);
}

function accountRow(a: AccountAudit): HTMLElement {
  const byLabel = Object.entries(a.byLabel)
    .map(([label, n]) => `${label}: ${n}`)
    .join(' · ');
  return el('div', { class: 'audit__account', 'data-audit-account': a.actor }, [
    el('div', { class: 'audit__account-head' }, [
      el('span', { class: 'audit__account-name' }, [a.displayName || a.actor]),
      el('span', { class: 'audit__account-count', 'data-audit-hidden': a.actor }, [
        a.hidden === 0 ? 'nothing hidden' : `${a.hidden} hidden`,
      ]),
    ]),
    el('span', { class: 'g-hint' }, [`${a.fetched} posts checked${byLabel ? ` — ${byLabel}` : ''}`]),
    examples(a.examples),
  ]);
}

function effectivenessSection(result: AuditResult): HTMLElement {
  return el('section', { class: 'g-card', 'data-audit-results': 'true' }, [
    el('h2', {}, ['What the garden hid']),
    el('p', { class: 'g-hint' }, [
      `Checked ${result.totalFetched} recent posts. Hidden by the label floor: `,
      el('strong', { 'data-audit-total': 'true' }, [String(result.totalHidden)]),
      '. Label-excluded embeds: ',
      el('strong', { 'data-audit-embeds': 'true' }, [String(result.embedExclusions.count)]),
      '.',
    ]),
    ...result.perAccount.map(accountRow),
    result.embedExclusions.count > 0
      ? el('div', { class: 'audit__account' }, [
          el('div', { class: 'audit__account-head' }, [
            el('span', { class: 'audit__account-name' }, ['Quoted / embedded posts']),
            el('span', { class: 'audit__account-count' }, [`${result.embedExclusions.count} excluded`]),
          ]),
          examples(result.embedExclusions.examples),
        ])
      : null,
  ]);
}

/**
 * §Phase 3B — the encrypted search-history section. Reads the explorer's sealed
 * records (public listRecords), unlocks the sponsor's audit key on THIS device,
 * and decrypts locally. Only this device can read them.
 */
function searchHistorySection(explorer: ExplorerEntry): HTMLElement | null {
  if (!explorer.config.search.auditPubKeyJwk) return null; // archive not on for this explorer

  const handleInput = el('input', {
    type: 'text',
    class: 'g-input',
    placeholder: 'explorer’s handle, e.g. kid.bsky.social',
    'data-history-handle': 'true',
  });
  handleInput.value = getExplorerHandle(explorer.rkey) ?? '';
  handleInput.addEventListener('input', () => setExplorerHandle(explorer.rkey, handleInput.value));

  // A passkey vault unlocks with the platform authenticator (no passphrase field).
  const usesPasskey = auditVault()?.method === 'webauthn-prf';
  const pass = el('input', {
    type: 'password',
    class: 'g-input',
    placeholder: 'your history passphrase',
    'data-history-pass': 'true',
  });

  const msg = el('span', { class: 'g-msg', role: 'status', 'data-history-msg': 'true' });
  const list = el('div', { class: 'audit__history', 'data-history-list': 'true' });

  const show = el('button', { type: 'button', class: 'g-btn g-btn--primary', 'data-history-show': 'true' }, [
    usesPasskey ? 'Unlock with passkey & show history' : 'Show search history',
  ]);
  show.addEventListener('click', () => {
    const handle = handleInput.value.trim();
    if (!handle) {
      msg.textContent = 'Enter the explorer’s handle.';
      return;
    }
    msg.textContent = usesPasskey ? 'Waiting for your passkey…' : 'Unlocking and reading…';
    clear(list);
    void (async () => {
      let priv: JsonWebKey;
      try {
        priv = await unlockAuditKey(usesPasskey ? {} : { passphrase: pass.value });
      } catch {
        msg.textContent = usesPasskey
          ? 'Couldn’t unlock with your passkey on this device.'
          : 'That passphrase didn’t work on this device.';
        return;
      }
      try {
        const did = await resolveHandleToDid(handle);
        const sealed = await fetchSealedHistory(did);
        const entries = await decryptHistory(sealed, priv);
        msg.textContent = '';
        if (entries.length === 0) {
          list.append(el('p', { class: 'g-hint' }, ['No search history yet.']));
          return;
        }
        for (const e of entries) {
          list.append(
            el('div', { class: 'audit__history-row', ...(e.blocked ? { 'data-blocked': 'true' } : {}) }, [
              el('span', { class: 'audit__history-q' }, [e.q]),
              el('span', { class: 'g-hint' }, [
                `${e.blocked ? 'blocked · ' : ''}${e.tier} · ${relativeTime(e.at)}`,
              ]),
            ]),
          );
        }
      } catch {
        msg.textContent = 'Couldn’t read the history (is the handle right, and are they online?).';
      }
    })();
  });

  return el('section', { class: 'g-card', 'data-history-section': 'true' }, [
    el('h2', {}, ['Search history (encrypted)']),
    el('p', { class: 'g-hint' }, [
      usesPasskey
        ? 'Bank-grade encryption keeps these scrambled everywhere else — only this device can read them. Enter the explorer’s handle, then unlock with your passkey.'
        : 'Bank-grade encryption keeps these scrambled everywhere else — only this device can read them. Enter the explorer’s handle and your history passphrase.',
    ]),
    el('label', { class: 'g-field' }, [el('span', { class: 'g-field__label' }, ['Explorer’s handle']), handleInput]),
    ...(usesPasskey
      ? []
      : [el('label', { class: 'g-field' }, [el('span', { class: 'g-field__label' }, ['History passphrase']), pass])]),
    show,
    msg,
    list,
  ]);
}

async function render(): Promise<void> {
  if (!root) return;
  const rkey = new URLSearchParams(window.location.search).get('r') ?? '';
  const explorer = listExplorers().find((e) => e.rkey === rkey);

  clear(root);
  if (!explorer) {
    root.append(
      el('p', { class: 'garden__status', 'data-audit-missing': 'true' }, [
        'No explorer to audit. Open this from an explorer’s card on the sponsor page.',
      ]),
    );
    return;
  }

  root.append(
    el('h1', { class: 'audit__title' }, [`What the garden hid — ${explorer.config.displayName || 'this explorer'}`]),
    el('p', { class: 'g-hint' }, [
      'This audits the filter using public data. Nothing is collected from the explorer’s device.',
    ]),
    meaningsSection(),
    el('section', { class: 'g-card', 'data-audit-status': 'loading' }, [
      el('p', { class: 'garden__status' }, ['Replaying the garden…']),
    ]),
  );

  const history = searchHistorySection(explorer);
  if (history) root.append(history);

  const inclusion = effectiveInclusion(explorer.config);
  try {
    const result = await fetchAudit(inclusion);
    const status = root.querySelector('[data-audit-status]');
    status?.replaceWith(effectivenessSection(result));
  } catch {
    const status = root.querySelector('[data-audit-status]');
    if (status) {
      clear(status);
      status.append(el('p', { class: 'garden__status' }, ['Couldn’t reach the network to replay the garden. Try again online.']));
    }
  }
}

function boot(): void {
  installTheme();
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();
  registerServiceWorker();
  root = document.querySelector<HTMLElement>('[data-audit]');
  void render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
