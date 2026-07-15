import { el, clear } from './render/dom.js';
import { parseProvisioning, setBinding } from './config/binding.js';

/**
 * S1 landing + role funnel. Shown at `/` ONLY when the device is not yet set up
 * (no binding, no local config). A device arriving via a provisioning link is
 * bound before this runs, so it skips the landing and lands in the garden.
 *
 * The copy below is carried BYTE-VERBATIM from SKYLITE-DIRECTIVES §S1 and is
 * marked [confirm before publish — every line]. It is laid out, never rewritten.
 * Product surface and project docs never share navigation (§S1): the explorer
 * topbar/help chrome is hidden here; the footer carries the project docs.
 */

/** Try to bind this device from a pasted Skylite link/code, then open the garden. */
function openFromPasted(raw: string): string | null {
  const text = raw.trim();
  if (!text) return 'Paste the link or code you were given.';
  let params: URLSearchParams | null = null;
  try {
    // A full link — extract its query.
    params = new URL(text).searchParams;
  } catch {
    // Not a URL: accept a bare query string ("s=did:...&r=...") or "?s=...".
    try {
      params = new URLSearchParams(text.replace(/^\?/, ''));
    } catch {
      params = null;
    }
  }
  const binding = params ? parseProvisioning(params) : null;
  if (!binding) return "That doesn't look like a Skylite link.";
  setBinding(binding);
  // Reload at the app root — main.ts now sees a bound device and opens the garden.
  window.location.assign(window.location.origin + '/');
  return null;
}

function doorB(): HTMLElement {
  const panel = el('div', { class: 'landing__paste', hidden: 'hidden', 'data-paste-panel': 'true' });
  const input = el('input', {
    type: 'text',
    class: 'landing__paste-input',
    placeholder: 'Paste your link or code',
    'aria-label': 'Your Skylite link or code',
    'data-paste-input': 'true',
  });
  const msg = el('span', { class: 'landing__paste-msg', 'data-paste-msg': 'true', role: 'alert' });
  const go = el('button', { type: 'button', class: 'landing__btn landing__btn--go', 'data-paste-go': 'true' }, [
    'Open my garden',
  ]);
  go.addEventListener('click', () => {
    const err = openFromPasted(input.value);
    msg.textContent = err ?? 'Opening…';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go.click();
  });
  panel.append(input, go, msg);

  const btn = el('button', { type: 'button', class: 'landing__door', 'data-door': 'explorer' }, [
    'I was given a link or code',
  ]);
  btn.addEventListener('click', () => {
    const open = panel.hasAttribute('hidden');
    if (open) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', 'hidden');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) input.focus();
  });
  btn.setAttribute('aria-expanded', 'false');

  return el('div', { class: 'landing__door-wrap' }, [btn, panel]);
}

/** Render the landing into the given container (the app's main region). */
export function renderLanding(container: HTMLElement): void {
  clear(container);
  container.classList.add('landing');

  const doorA = el('a', { class: 'landing__door', href: '/sponsor.html', 'data-door': 'sponsor' }, [
    'I look after someone',
  ]);

  container.append(
    el('section', { class: 'landing__hero' }, [
      el('span', { class: 'landing__moon', 'aria-hidden': 'true' }),
      el('h1', { class: 'landing__title' }, ['Skylite']),
      el('p', { class: 'landing__subtitle' }, ['A window to the stars.']),
    ]),

    el('p', { class: 'landing__lede' }, [
      'A calm, read-first window into Bluesky, grown for you by someone who cares about you. No algorithm, no ads, no counts, no strangers.',
    ]),

    el('p', { class: 'landing__para' }, [
      el('strong', {}, ['How it works.']),
      ' A sponsor tends a garden: the set of voices an explorer sees. Explorers read, save, and share what they find. One switch matters: "on this device only." While it is on, nothing about the explorer ever leaves the device. Turning it off, together, when the time is right, adds hearts that friends can see.',
    ]),

    el('div', { class: 'landing__doors' }, [doorA, doorB()]),

    el('p', { class: 'landing__para landing__honesty' }, [
      el('strong', {}, ['Honesty, up front.']),
      ' Gardens are public records, like everything on this network. Saves and notes never leave the device, ever. Hearts, when enabled, are public records shown among friends.',
    ]),

    el('footer', { class: 'landing__footer' }, [
      el('a', { href: '/help.html', class: 'landing__foot-link' }, ['about the project']),
      el('span', { 'aria-hidden': 'true' }, ['·']),
      el('a', { href: '/LICENSE', class: 'landing__foot-link' }, ['license']),
    ]),
  );
}
