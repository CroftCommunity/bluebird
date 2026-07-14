// D6 — the device lock is a local gate, not a credential. There is no session
// behind it (Skylite reads are unauthenticated), so this is literally just a lock
// on Skylite's own door. The PIN is stored only as a SHA-256 hash, never plain.

const KEY = 'skylite.pin';

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`skylite:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export async function setPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  try {
    localStorage.setItem(KEY, hash);
  } catch {
    /* storage disabled — non-fatal */
  }
}

export function clearPin(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* non-fatal */
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return false;
    return (await hashPin(pin)) === stored;
  } catch {
    return false;
  }
}
