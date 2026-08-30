import { el } from '../render/dom.js';
import { ATMO_GLOSS, featuredProviders, otherProviders, canCreateAccount, type Provider } from './providers.js';

/**
 * The sign-in sheet — Bluebird's implementation of croft-pwa/docs/DESIGN.md
 * § Components › Sheet, § Flows › Sign in and § Copy › atmo (reference:
 * croft-pwa/src/signin/sheet.ts). Both surfaces that can start sign-in — Patrol
 * (the sponsor) and the Lodge's explorer banner — open this one sheet.
 *
 * Native <dialog> + showModal(), not a hand-rolled div: focus entry, Esc, focus
 * return and background inertness come free, and axe can see inside an open one.
 * This is the recorded exception to "pages, not modals": a choose-one step that
 * returns you where you were. Built FRESH per open and removed on close, so a
 * half-typed handle never carries from one visit into the next.
 */

export interface ChooseOptions {
  prompt?: 'create';
}

export interface SheetHandlers {
  /** `target` is a provider entryway (https origin) or a handle. */
  onChoose: (target: string, options?: ChooseOptions) => void;
  /** An empty handle submission; the sheet stays open. */
  onEmptyHandle: () => void;
}

// One row shape for both panels. Open offers Create; invite-only shows the WORDS
// in the create slot — a property of the provider, not the panel, so a provider
// that changes posture moves panels and changes controls in one registry edit.
function providerRow(p: Provider, h: SheetHandlers): HTMLElement {
  const actions = el('div', { class: 'sheet__actions' });
  if (canCreateAccount(p)) {
    // prompt=create lands in the registration wizard (driven end to end against
    // the open providers, forage Phase 0 D1); without that evidence this button
    // and the one beside it would be two routes to one page wearing different words.
    const create = el('button', { type: 'button', class: 'sheet__btn sheet__btn--primary', 'data-provider-create': 'true' }, ['Create account']);
    create.addEventListener('click', () => h.onChoose(p.entryway, { prompt: 'create' }));
    actions.append(create);
  } else {
    // An invite-only provider still ADVERTISES create; offering it would send
    // someone to a screen that then demands a code.
    actions.append(el('span', { class: 'sheet__invite' }, ['invite only']));
  }
  const go = el('button', { type: 'button', class: 'sheet__btn', 'data-provider-signin': 'true' }, ['Sign in']);
  go.addEventListener('click', () => h.onChoose(p.entryway));
  actions.append(go);
  return el('div', { class: 'sheet__row', 'data-provider-row': p.id }, [el('span', { class: 'sheet__provider' }, [p.label]), actions]);
}

export function signInSheet(h: SheetHandlers): HTMLDialogElement {
  const titleId = 'signin-sheet-title';
  const dialog = el('dialog', { class: 'sheet', 'data-signin-sheet': 'true', 'aria-labelledby': titleId });
  const close = el('button', { type: 'button', class: 'sheet__x', 'aria-label': 'Close' }, ['✕']);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());

  // The front page is the providers a newcomer can JOIN from here; invite-only
  // providers are one tap in, below (owner, 2026-08-29).
  const list = el('div', { class: 'sheet-list' }, featuredProviders().map((p) => providerRow(p, h)));

  // Everything not on the short list reaches the same seam by handle — the list
  // is an editorial convenience, not a boundary.
  const handle = el('input', {
    type: 'text', id: 'signin-sheet-handle', class: 'sheet__input', 'data-provider-handle': 'true',
    placeholder: 'you.example.com', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false',
  });
  const form = el('form', { class: 'sheet__form' }, [
    el('label', { for: 'signin-sheet-handle', class: 'sheet__label' }, ['Your handle on any atmo provider']),
    el('div', { class: 'sheet__handle-row' }, [handle, el('button', { type: 'submit', class: 'sheet__btn sheet__btn--primary', 'data-provider-handle-go': 'true' }, ['Continue'])]),
  ]);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = handle.value.trim().replace(/^@+/, '');
    if (!v) return h.onEmptyHandle();
    h.onChoose(v);
  });
  const panel = el('div', { class: 'sheet-other' }, [el('div', { class: 'sheet-list' }, otherProviders().map((p) => providerRow(p, h))), form]);
  panel.hidden = true;
  const other = el('button', { type: 'button', class: 'sheet__btn sheet__more', 'data-provider-other': 'true' }, ['Another provider']);
  other.addEventListener('click', () => {
    other.hidden = true;
    panel.hidden = false;
    handle.focus();
  });

  // "atmo" is the owner's word for a home on the open social Atmosphere. The
  // <abbr title> hovers on a desktop and assistive tech reads it; touch cannot
  // hover, so the sentence below repeats the definition in plain sight.
  const intro = `Bluebird has no accounts of its own. You sign in with an account from an atmo provider — ${ATMO_GLOSS.charAt(0).toLowerCase()}${ATMO_GLOSS.slice(1)}. Bluesky is one of many, and each sets its own rules.`;
  dialog.append(
    el('div', { class: 'sheet__head' }, [
      el('h2', { id: titleId, class: 'sheet__title' }, ['Choose your ', el('abbr', { class: 'sheet__gloss', title: ATMO_GLOSS }, ['atmo']), ' provider']),
      close,
    ]),
    el('p', { class: 'sheet__intro' }, [intro]),
    list,
    other,
    panel,
  );
  return dialog;
}

/** Mount a fresh sheet under `host` and open it modally. */
export function openSignInSheet(host: HTMLElement, h: SheetHandlers): HTMLDialogElement {
  const sheet = signInSheet(h);
  host.append(sheet);
  sheet.showModal();
  return sheet;
}
