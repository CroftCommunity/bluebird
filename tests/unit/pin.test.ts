import { describe, it, expect, beforeEach } from 'vitest';
import { hashPin, setPin, verifyPin, hasPin, clearPin } from '../../src/lock/pin.js';

// Minimal localStorage shim for the node test environment.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) ?? null) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
});

describe('hashPin', () => {
  it('is deterministic and hex SHA-256 (64 chars)', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for different PINs', async () => {
    expect(await hashPin('1234')).not.toBe(await hashPin('1235'));
  });

  it('never stores the PIN in plaintext', async () => {
    expect(await hashPin('1234')).not.toContain('1234');
  });
});

describe('setPin / verifyPin / hasPin / clearPin', () => {
  it('round-trips a PIN via its hash', async () => {
    expect(hasPin()).toBe(false);
    await setPin('2468');
    expect(hasPin()).toBe(true);
    expect(await verifyPin('2468')).toBe(true);
    expect(await verifyPin('0000')).toBe(false);
  });

  it('clears the PIN', async () => {
    await setPin('2468');
    clearPin();
    expect(hasPin()).toBe(false);
    expect(await verifyPin('2468')).toBe(false);
  });
});
