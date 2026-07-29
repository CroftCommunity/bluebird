import { el } from '../render/dom.js';
import { hasPin, verifyPin } from './pin.js';

/**
 * D6 — lock on background, not just at open. When Bluebird is backgrounded (iPad
 * set down, handed to a friend) and a device PIN is set, re-entry requires the
 * PIN. `visibilitychange` is the reliable backgrounding signal on iOS; we also
 * lock on `pagehide`. (Plain window `blur` is intentionally not used — it fires
 * on incidental focus loss and would lock spuriously.)
 *
 * With no session behind it, this gate is exactly what IDEAS.md §5 describes: a
 * lock on Bluebird's own front door and nothing more.
 */

let overlay: HTMLElement | null = null;
let locked = false;

function hideOverlay(): void {
  locked = false;
  overlay?.remove();
  overlay = null;
}

function showOverlay(): void {
  if (overlay) return;

  const input = el('input', {
    type: 'password',
    inputmode: 'numeric',
    autocomplete: 'off',
    class: 'pinlock__input',
    'aria-label': 'PIN',
    'data-pin-input': 'true',
  });
  const err = el('span', { class: 'pinlock__err', 'data-pin-error': 'true' });

  const submit = async (): Promise<void> => {
    if (await verifyPin(input.value)) {
      hideOverlay();
    } else {
      err.textContent = 'Try again';
      input.value = '';
      input.focus();
    }
  };

  const btn = el('button', { type: 'button', class: 'pinlock__btn', 'data-pin-submit': 'true' }, ['Unlock']);
  btn.addEventListener('click', () => void submit());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void submit();
  });

  overlay = el('div', { class: 'pinlock', 'data-pinlock': 'true', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'pinlock__card' }, [
      el('span', { class: 'pinlock__glyph', 'aria-hidden': 'true' }, ['🔒']),
      el('h2', { class: 'pinlock__title' }, ['Enter your PIN']),
      input,
      err,
      btn,
    ]),
  ]);
  document.body.append(overlay);
  input.focus();
}

function lock(): void {
  if (!hasPin() || locked) return;
  locked = true;
  showOverlay();
}

export function installBackgroundLock(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) lock();
  });
  window.addEventListener('pagehide', () => lock());
}
