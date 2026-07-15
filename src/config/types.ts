// TypeScript mirror of the ing.croft.skylite.config lexicon (see
// lexicons/ing.croft.skylite.config.json). This is the guardian control record:
// pause switch + channel-grouped inclusion list + version. It is public and
// carries nothing about the child.

export const SKYLITE_CONFIG_NSID = 'ing.croft.skylite.config';
export const SKYLITE_CONFIG_RKEY = 'self';

export interface SkyliteAccount {
  actor: string;
  displayName?: string;
}

export interface SkyliteChannel {
  id: string;
  name: string;
  enabled: boolean;
  accounts: SkyliteAccount[];
}

export interface SkyliteHelp {
  contactName?: string;
  contactEmail?: string;
}

export interface SkyliteConfig {
  $type?: typeof SKYLITE_CONFIG_NSID;
  version: number;
  paused: boolean;
  updatedAt: string;
  channels: SkyliteChannel[];
  help?: SkyliteHelp;
}

/** Where the child device's config came from, for honest UI. */
export type ConfigSource = 'pds' | 'pds-cached' | 'local' | 'dev-fixture';
