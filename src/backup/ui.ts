import { buildBackup, parseBackup, restoreBackup, type RestoreSummary } from './backup.js';

/**
 * Browser wiring for S5. Export prefers the OS share sheet (Web Share with a
 * file) and falls back to a plain download; import reads a chosen file, parses
 * it defensively, and restores it. Kept apart from the pure backup logic so the
 * assembly is unit-tested without a DOM.
 */

function backupFilename(iso: string): string {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(iso)?.[0] ?? 'backup';
  return `skylite-backup-${day}.json`;
}

/** Build the backup and hand it to the OS share sheet, or download it. */
export async function exportBackup(): Promise<'shared' | 'downloaded'> {
  const file = await buildBackup();
  const text = JSON.stringify(file, null, 2);
  const name = backupFilename(file.exportedAt);
  const blob = new Blob([text], { type: 'application/json' });

  const shareFile = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & {
    canShare?: (data?: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [shareFile] }) && nav.share) {
    try {
      await nav.share({ files: [shareFile], title: 'Skylite backup' });
      return 'shared';
    } catch {
      // User cancelled or share failed — fall through to a download.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

/** Read, parse and restore a chosen backup file. Throws on an unrecognizable file. */
export async function importBackupFile(file: File): Promise<RestoreSummary> {
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('That file is not a Skylite backup.');
  }
  const parsed = parseBackup(json);
  if (!parsed) throw new Error('That file is not a Skylite backup.');
  return restoreBackup(parsed);
}
