import type { InclusionEntry } from '../feed/inclusion.js';

/**
 * §3 garden-change transparency. The explorer device diffs its config polls
 * locally and shows plain notices ("3 accounts were added to your garden"). This
 * is honesty toward the explorer AND the sponsor-account-compromise tripwire —
 * always on, never switchable.
 *
 * Pure and case-insensitive on the actor; the reported names prefer the display
 * name the config carried.
 */

export interface InclusionChange {
  added: string[];
  removed: string[];
}

function nameOf(e: InclusionEntry): string {
  return e.displayName?.trim() || e.actor;
}

/** Compare a previous inclusion list against the next one. */
export function diffInclusion(prev: InclusionEntry[], next: InclusionEntry[]): InclusionChange {
  const prevKeys = new Map(prev.map((e) => [e.actor.toLowerCase(), e]));
  const nextKeys = new Map(next.map((e) => [e.actor.toLowerCase(), e]));

  const added: string[] = [];
  for (const [key, entry] of nextKeys) if (!prevKeys.has(key)) added.push(nameOf(entry));

  const removed: string[] = [];
  for (const [key, entry] of prevKeys) if (!nextKeys.has(key)) removed.push(nameOf(entry));

  return { added, removed };
}

export function hasChanges(change: InclusionChange | undefined): change is InclusionChange {
  return !!change && (change.added.length > 0 || change.removed.length > 0);
}

/** A plain-words summary of a garden change, or null when nothing changed. */
export function changeSentence(change: InclusionChange | undefined): string | null {
  if (!hasChanges(change)) return null;
  const nounVerb = (n: number): string => (n === 1 ? 'account was' : 'accounts were');
  const verb = (n: number): string => (n === 1 ? 'was' : 'were');
  const both = change.added.length > 0 && change.removed.length > 0;

  const parts: string[] = [];
  if (change.added.length) {
    parts.push(`${change.added.length} ${nounVerb(change.added.length)} added to your garden`);
  }
  if (change.removed.length) {
    // Drop the repeated "account(s)" when it follows the added clause.
    const lead = both ? verb(change.removed.length) : nounVerb(change.removed.length);
    parts.push(`${change.removed.length} ${lead} removed`);
  }
  // "3 accounts were added to your garden." /
  // "1 account was added to your garden and 1 was removed."
  return `${parts.join(' and ')}.`;
}
