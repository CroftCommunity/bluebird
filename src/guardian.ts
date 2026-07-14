import { skyliteVersion } from './version.js';
import { el, clear } from './render/dom.js';
import { SKYLITE_CONFIG_NSID, SKYLITE_CONFIG_RKEY } from './config/types.js';
import type { SkyliteChannel, SkyliteConfig } from './config/types.js';
import { parseConfig } from './config/parse.js';
import { provisioningUrl, setLocalConfig, getLocalConfig } from './config/binding.js';

/**
 * Guardian setup — the guardian's own device. Phase 2 / D2 supports authoring
 * config **locally** (no account needed) with export/import, saving it to this
 * device (local-only mode), and generating a provisioning link for the child's
 * device. Writing the record straight into the guardian's PDS over OAuth is the
 * deferred RUN-04 convenience; the exported JSON is the record body to store.
 */

function starterConfig(): SkyliteConfig {
  return {
    version: 1,
    paused: false,
    updatedAt: '',
    channels: [{ id: 'channel-1', name: 'My channel', enabled: true, accounts: [{ actor: '' }] }],
  };
}

let config: SkyliteConfig = getLocalConfig() ?? starterConfig();

function withType(c: SkyliteConfig): SkyliteConfig {
  return { $type: SKYLITE_CONFIG_NSID, ...c, updatedAt: new Date().toISOString() };
}

function labeled(labelText: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'g-field' }, [el('span', { class: 'g-field__label' }, [labelText]), control]);
}

function textInput(value: string, placeholder: string, onInput: (v: string) => void): HTMLInputElement {
  const input = el('input', { type: 'text', value, placeholder, class: 'g-input' });
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

function button(text: string, cls: string, onClick: () => void, attrs: Record<string, string> = {}): HTMLButtonElement {
  const b = el('button', { type: 'button', class: cls, ...attrs }, [text]);
  b.addEventListener('click', onClick);
  return b;
}

function renderAccount(channel: SkyliteChannel, index: number): HTMLElement {
  const acct = channel.accounts[index];
  if (!acct) return el('div');
  return el('div', { class: 'g-account' }, [
    textInput(acct.actor, 'handle or did:…', (v) => (acct.actor = v.trim())),
    textInput(acct.displayName ?? '', 'name (optional)', (v) => {
      if (v.trim()) acct.displayName = v;
      else delete acct.displayName;
    }),
    button('✕', 'g-btn g-btn--icon', () => {
      channel.accounts.splice(index, 1);
      render();
    }, { 'aria-label': 'Remove account' }),
  ]);
}

function renderChannel(channel: SkyliteChannel, index: number): HTMLElement {
  const enabled = el('input', { type: 'checkbox', class: 'g-check', ...(channel.enabled ? { checked: 'checked' } : {}) });
  enabled.addEventListener('change', () => {
    channel.enabled = enabled.checked;
  });

  return el('section', { class: 'g-channel', 'data-channel': channel.id }, [
    el('div', { class: 'g-channel__head' }, [
      textInput(channel.name, 'Channel name', (v) => (channel.name = v)),
      el('label', { class: 'g-toggle' }, [enabled, el('span', {}, ['On'])]),
      button('Remove', 'g-btn g-btn--ghost', () => {
        config.channels.splice(index, 1);
        render();
      }),
    ]),
    ...channel.accounts.map((_, i) => renderAccount(channel, i)),
    button('+ Add account', 'g-btn g-btn--ghost', () => {
      channel.accounts.push({ actor: '' });
      render();
    }),
  ]);
}

function renderConfigJson(): string {
  return JSON.stringify(withType(config), null, 2);
}

let root: HTMLElement | null = null;
let exportAreaRef: HTMLTextAreaElement | null = null;

function render(): void {
  if (!root) return;
  clear(root);

  const pause = el('input', { type: 'checkbox', class: 'g-check', ...(config.paused ? { checked: 'checked' } : {}) });
  pause.addEventListener('change', () => {
    config.paused = pause.checked;
  });

  const exportArea = el('textarea', { class: 'g-json', readonly: 'readonly', rows: 10 });
  exportArea.value = renderConfigJson();
  exportAreaRef = exportArea;

  const importArea = el('textarea', { class: 'g-json', rows: 6, placeholder: 'Paste a config JSON to load…' });
  const importMsg = el('span', { class: 'g-msg' });

  const didInput = el('input', { type: 'text', class: 'g-input', placeholder: 'did:plc:… (guardian DID)' });
  const pdsInput = el('input', { type: 'text', class: 'g-input', placeholder: 'PDS host (optional, e.g. https://…)' });
  const linkOut = el('input', { type: 'text', class: 'g-input', readonly: 'readonly', placeholder: 'device link appears here' });
  const saveMsg = el('span', { class: 'g-msg' });

  root.append(
    el('div', { class: 'g-card' }, [
      el('h2', {}, ['1 · Pause switch']),
      el('label', { class: 'g-toggle g-toggle--big' }, [pause, el('span', {}, ['Pause Skylite for the child'])]),
    ]),

    el('div', { class: 'g-card' }, [
      el('h2', {}, ['2 · Channels']),
      el('p', { class: 'g-hint' }, ['The child sees the accounts in every channel that is On.']),
      ...config.channels.map((c, i) => renderChannel(c, i)),
      button('+ Add channel', 'g-btn', () => {
        config.channels.push({ id: `channel-${config.channels.length + 1}`, name: 'New channel', enabled: true, accounts: [{ actor: '' }] });
        render();
      }),
    ]),

    el('div', { class: 'g-card' }, [
      el('h2', {}, ['3 · Use it']),
      el('p', { class: 'g-hint' }, ['Save to this device to run Skylite locally (no account needed), or copy the JSON to store as your ', el('code', {}, [`${SKYLITE_CONFIG_NSID}/${SKYLITE_CONFIG_RKEY}`]), ' record.']),
      el('div', { class: 'g-row' }, [
        button('Save to this device', 'g-btn g-btn--primary', () => {
          setLocalConfig(withType(config));
          saveMsg.textContent = 'Saved. Open Skylite on this device to see it.';
        }),
        saveMsg,
      ]),
      labeled('Config JSON (your record body)', exportArea),
    ]),

    el('div', { class: 'g-card' }, [
      el('h2', {}, ['4 · Set up the child’s device']),
      el('p', { class: 'g-hint' }, ['Store the JSON above as a record in your repo, then make a link for the child’s device.']),
      labeled('Guardian DID', didInput),
      labeled('PDS host', pdsInput),
      el('div', { class: 'g-row' }, [
        button('Make device link', 'g-btn g-btn--primary', () => {
          const did = didInput.value.trim();
          if (!did.startsWith('did:')) {
            linkOut.value = '';
            saveMsg.textContent = 'Enter a valid DID (did:plc:… or did:web:…).';
            return;
          }
          const origin = `${window.location.origin}/`;
          linkOut.value = provisioningUrl(origin, {
            guardianDid: did,
            rkey: SKYLITE_CONFIG_RKEY,
            ...(pdsInput.value.trim() ? { pdsHost: pdsInput.value.trim() } : {}),
          });
        }),
      ]),
      labeled('Device link', linkOut),
    ]),

    el('div', { class: 'g-card' }, [
      el('h2', {}, ['Load an existing config']),
      importArea,
      el('div', { class: 'g-row' }, [
        button('Load', 'g-btn', () => {
          try {
            const parsed = parseConfig(JSON.parse(importArea.value));
            if (!parsed) throw new Error('not a config');
            config = parsed;
            importMsg.textContent = 'Loaded.';
            render();
          } catch {
            importMsg.textContent = "That doesn't look like a Skylite config.";
          }
        }),
        importMsg,
      ]),
    ]),
  );
}

function boot(): void {
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();
  root = document.querySelector<HTMLElement>('[data-guardian]');
  // Keep the exported JSON live as any field is edited, without a full re-render
  // (which would steal input focus). Delegated listeners fire in the bubble phase,
  // after each control's own target-phase handler has updated the model — so
  // 'change' (checkboxes) and 'input' (text) both see fresh state.
  const refresh = (): void => {
    if (exportAreaRef) exportAreaRef.value = renderConfigJson();
  };
  root?.addEventListener('input', refresh);
  root?.addEventListener('change', refresh);
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
