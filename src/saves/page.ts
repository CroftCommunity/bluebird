import { skyliteVersion } from '../version.js';
import { el, clear } from '../render/dom.js';
import { registerServiceWorker } from '../pwa/register.js';
import type { Clip } from './clip.js';
import { listClips, saveClip, removeClip } from './store.js';
import { exportBackup, importBackupFile } from '../backup/ui.js';

/**
 * The Saves page (D4): the explorer's private, on-device saves. Each clip keeps
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

  const remove = el('button', { class: 'clip__remove', type: 'button', 'aria-label': 'Remove from saves' }, ['Remove']);
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
      el('p', { class: 'garden__status', 'data-saves-empty': 'true' }, [
        'Nothing saved yet. Tap ☆ Save on a post to keep it here.',
      ]),
    );
    return;
  }
  const list = el('div', { class: 'clip__list', 'data-clip-list': 'true' });
  for (const clip of clips) list.append(renderClip(clip));
  root.append(list);
}

/**
 * S5 backup & restore controls. Lives outside `root` so a list re-render never
 * wipes it. Export goes to the OS share sheet or a download; import restores a
 * chosen file. Copy is plain about what the file holds and that, in localOnly
 * mode, it is the only copy.
 */
function renderBackup(): HTMLElement {
  const msg = el('span', { class: 'g-msg', 'data-backup-msg': 'true', role: 'status' });

  const exportBtn = el('button', { type: 'button', class: 'g-btn g-btn--primary', 'data-backup-export': 'true' }, [
    'Back up my saves',
  ]);
  exportBtn.addEventListener('click', () => {
    msg.textContent = 'Preparing your backup…';
    void exportBackup()
      .then((how) => {
        msg.textContent = how === 'shared' ? 'Shared your backup.' : 'Saved a backup file to your device.';
      })
      .catch(() => {
        msg.textContent = "Couldn't make a backup just now.";
      });
  });

  const fileInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'g-visually-hidden',
    'data-backup-import': 'true',
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    msg.textContent = 'Restoring…';
    void importBackupFile(file)
      .then((s) => {
        msg.textContent = `Restored ${s.saves} saved ${s.saves === 1 ? 'post' : 'posts'}.`;
        void render();
      })
      .catch((e: unknown) => {
        msg.textContent = e instanceof Error ? e.message : 'That file is not a Skylite backup.';
      })
      .finally(() => {
        fileInput.value = '';
      });
  });

  const importBtn = el('button', { type: 'button', class: 'g-btn g-btn--ghost', 'data-backup-restore': 'true' }, [
    'Restore from a backup',
  ]);
  importBtn.addEventListener('click', () => fileInput.click());

  return el('section', { class: 'saves-backup', 'data-backup': 'true' }, [
    el('h2', { class: 'saves-backup__title' }, ['Back up & restore']),
    el('p', { class: 'g-hint' }, [
      'A backup is one file with your saved posts and notes, your follows, and this device’s settings. ',
      'Saves live only on this device — while “on this device only” is on, a backup is the only copy. Keep it somewhere safe.',
    ]),
    el('div', { class: 'g-row' }, [exportBtn, importBtn, fileInput]),
    msg,
  ]);
}

function boot(): void {
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();
  registerServiceWorker();
  root = document.querySelector<HTMLElement>('[data-saves]');
  if (root) root.before(renderBackup());
  void render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
