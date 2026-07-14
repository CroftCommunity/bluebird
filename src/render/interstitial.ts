import { el } from './dom.js';

/**
 * D7 — external links are gated. Tapping any link in a post opens a "this leaves
 * Skylite" interstitial naming the destination domain; only an explicit tap
 * continues. The walled garden shouldn't have unmarked doors.
 */

function domainOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return rawUrl;
  }
}

/** Whether a URL is safe to ever offer leaving to (http/https only). */
export function isExternalHttpUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

let openLauncher: (url: string) => void = (url) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

/** Test seam: override how a confirmed external link is actually opened. */
export function setExternalLauncher(fn: (url: string) => void): void {
  openLauncher = fn;
}

export function showLeaveInterstitial(url: string): void {
  if (!isExternalHttpUrl(url)) return;
  const domain = domainOf(url);

  const dismiss = (): void => overlay.remove();

  const stay = el('button', { class: 'leave__stay', type: 'button', 'data-leave-stay': 'true' }, [
    'Stay in Skylite',
  ]);
  stay.addEventListener('click', dismiss);

  const go = el('button', { class: 'leave__go', type: 'button', 'data-leave-continue': 'true' }, [
    'Continue',
  ]);
  go.addEventListener('click', () => {
    dismiss();
    openLauncher(url);
  });

  const dialog = el(
    'div',
    { class: 'leave__dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Leaving Skylite' },
    [
      el('p', { class: 'leave__title' }, ['This link leaves Skylite']),
      el('p', { class: 'leave__domain', 'data-leave-domain': 'true' }, [domain]),
      el('div', { class: 'leave__actions' }, [stay, go]),
    ],
  );

  const overlay = el('div', { class: 'leave', 'data-leave-overlay': 'true' }, [dialog]);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss();
  });

  document.body.append(overlay);
  stay.focus();
}
