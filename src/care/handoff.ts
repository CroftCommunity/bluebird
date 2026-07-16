import { el } from '../render/dom.js';

/**
 * The out-of-band "something's wrong" handoff (IDEAS.md §3). One tap reaches the
 * sponsor — a prefilled mailto, nothing more. NOT platform reporting, NOT
 * activity monitoring, NO telemetry. Distress routes to a person the explorer
 * chooses to reach. The honest inverse of surveillance.
 */

export interface HelpContact {
  contactName?: string;
  contactEmail?: string;
}

export function buildMailto(contact: HelpContact): string | null {
  const email = contact.contactEmail?.trim();
  if (!email) return null;
  const name = contact.contactName?.trim();
  const subject = encodeURIComponent('I want to talk');
  const body = encodeURIComponent(
    `Hi${name ? ' ' + name : ''}, I saw something on Skylite and I'd like to talk about it.`,
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

export function showHelpHandoff(contact: HelpContact = {}): void {
  const dismiss = (): void => overlay.remove();

  const mailto = buildMailto(contact);
  const who = contact.contactName?.trim();

  const primary = mailto
    ? el('a', { class: 'handoff__go', href: mailto, 'data-handoff-mailto': 'true' }, [
        who ? `Message ${who}` : 'Message your sponsor',
      ])
    : el('p', { class: 'handoff__hint' }, ['Find an adult you trust and tell them what happened.']);
  if (mailto) primary.addEventListener('click', dismiss);

  const close = el('button', { class: 'handoff__close', type: 'button', 'data-handoff-close': 'true' }, ['Never mind']);
  close.addEventListener('click', dismiss);

  const dialog = el(
    'div',
    { class: 'handoff__dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Get help' },
    [
      el('span', { class: 'handoff__glyph', 'aria-hidden': 'true' }, ['💛']),
      el('h2', { class: 'handoff__title' }, ['Want to talk to your sponsor?']),
      el('p', { class: 'handoff__body' }, ["It's always okay to ask for help. This will start a message — nothing is sent until you send it."]),
      primary,
      close,
    ],
  );

  const overlay = el('div', { class: 'handoff', 'data-handoff-overlay': 'true' }, [dialog]);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss();
  });
  document.body.append(overlay);
}
