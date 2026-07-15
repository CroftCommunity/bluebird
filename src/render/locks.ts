import { el, clear } from './dom.js';

/**
 * Calm, honest lock screens. Skylite is a safety tool, so these are gentle and
 * age-appropriate — never alarming, never blaming the explorer.
 */

/** Pause switch (D2/D5): the sponsor has paused the garden. */
export function renderPausedLock(container: HTMLElement): void {
  clear(container);
  container.append(
    el('div', { class: 'lock', 'data-lock': 'paused' }, [
      el('span', { class: 'lock__glyph', 'aria-hidden': 'true' }, ['🌙']),
      el('h2', { class: 'lock__title' }, ['Paused for now']),
      el('p', { class: 'lock__body' }, ['Your grown-up paused Skylite. It will come back on when they turn it on again.']),
    ]),
  );
}

/** Staleness lock (D5): config unreachable past the staleness window. */
export function renderStaleLock(container: HTMLElement): void {
  clear(container);
  container.append(
    el('div', { class: 'lock', 'data-lock': 'stale' }, [
      el('span', { class: 'lock__glyph', 'aria-hidden': 'true' }, ['☁️']),
      el('h2', { class: 'lock__title' }, ["Can't check in"]),
      el('p', { class: 'lock__body' }, ["Skylite needs to reach the internet to check with your grown-up before opening. Try again when you're back online."]),
    ]),
  );
}

/** The D5 "showing saved posts, you're offline" banner, prepended to the garden. */
export function offlineBanner(): HTMLElement {
  return el('div', { class: 'banner', 'data-offline-banner': 'true' }, [
    el('span', { class: 'banner__glyph', 'aria-hidden': 'true' }, ['✈️']),
    el('span', {}, ["Showing saved posts — you're offline."]),
  ]);
}
