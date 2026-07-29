import type { BluebirdConfig } from './types.js';

/**
 * What an explorer's device is *allowed to do*, derived ONLY from the two-switch
 * model's capability switch (`localOnly`) and related data switches — NEVER from
 * `skin` (BLUEBIRD-DIRECTIVES §2: "NO capability may key on skin"). The
 * `capabilities-key-on-localOnly-never-skin` invariant test asserts exactly this:
 * flipping `skin` leaves every field here unchanged.
 *
 * In RUN-STRUCT the only social objects are read paths; likes/follows land in
 * RUN-SOCIAL / RUN-DISCOVER. This model is defined now so the invariant guards
 * every future capability from the start.
 */
export interface Capabilities {
  /** Persisting likes to a repo requires an account (localOnly off). */
  canPersistLikes: boolean;
  /** Persisting follows to a repo requires an account (localOnly off). */
  canPersistFollows: boolean;
  /**
   * Seeing friends' hearts: an account-holding explorer sees them; a localOnly
   * explorer may lurk (see-but-not-be-seen) only when the sponsor enabled it.
   */
  canSeeFriendsHearts: boolean;
  /** Saves are local in EVERY mode — always available. */
  canSave: boolean;
  /** Native share works in ALL modes. */
  canShare: boolean;
  /** Local (device-only) follows exist in every mode; sharing them needs an account. */
  canFollowLocally: boolean;
}

export function capabilities(config: BluebirdConfig): Capabilities {
  const hasAccount = !config.localOnly;
  return {
    canPersistLikes: hasAccount,
    canPersistFollows: hasAccount,
    canSeeFriendsHearts: hasAccount || config.showFriendsHearts,
    canSave: true,
    canShare: true,
    canFollowLocally: true,
  };
}
