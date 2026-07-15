import { skyliteVersion } from '../version.js';
import { el, clear } from '../render/dom.js';
import { registerServiceWorker } from '../pwa/register.js';
import type { Clip } from './clip.js';
import { listClips, saveClip, removeClip } from './store.js';

/**
 * The Scrapbook page (D4): the child's private, on-device saves. Each clip keeps
 * a private note. Local only — the page says so plainly (anti-decoy).
 */

let root: HTMLElement | null = null;

function renderClip(clip: Clip): HTMLElement {
  const note = el('textarea', {
    class: 'clip__note',
    rows: 2,
    placeholder: 'Add a private note…',
    'data-clip-note': clip.uri,
  });
  note.value = clip.note;
  note.addEventListener('input', () => void saveClip({ ...clip, note: note.value }));

  const remove = el('button', { class: 'clip__remove', type: 'button', 'aria-label': 'Remove from scrapbook' }, ['Remove']);
  remove.addEventListener('click', () => {
    void removeClip(clip.uri).then(render);
  });

  return el('article', { class: 'clip', 'data-clip': clip.uri }, [
    el('div', { class: 'clip__head' }, [
      clip.thumb ? el('img', { class: 'clip__thumb', src: clip.thumb, alt: '', loading: 'lazy' }) : null,
      el('div', {}, [
        el('span', { class: 'clip__author' }, [clip.authorName]),
        clip.text ? el('p', { class: 'clip__text' }, [clip.text]) : null,
      ]),
    ]),
    note,
    el('div', { class: 'clip__actions' }, [remove]),
  ]);
}

async function render(): Promise<void> {
  if (!root) return;
  const clips = await listClips();
  clear(root);
  if (clips.length === 0) {
    root.append(
      el('p', { class: 'garden__status', 'data-scrapbook-empty': 'true' }, [
        'Nothing saved yet. Tap ☆ Save on a post to keep it here.',
      ]),
    );
    return;
  }
  const list = el('div', { class: 'clip__list', 'data-clip-list': 'true' });
  for (const clip of clips) list.append(renderClip(clip));
  root.append(list);
}

function boot(): void {
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();
  registerServiceWorker();
  root = document.querySelector<HTMLElement>('[data-scrapbook]');
  void render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
