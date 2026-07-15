import { installTheme } from './brand/theme.js';
import { skyliteVersion } from './version.js';
import { registerServiceWorker } from './pwa/register.js';
import { getCachedConfig, getLocalConfig } from './config/binding.js';
import { showHelpHandoff, type HelpContact } from './care/handoff.js';

/** The honest "how Skylite works" page. Static content + the help handoff. */
function helpContact(): HelpContact {
  return (getCachedConfig()?.config ?? getLocalConfig())?.help ?? {};
}

function boot(): void {
  installTheme();
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();
  registerServiceWorker();
  const helpBtn = document.querySelector<HTMLElement>('[data-help-btn]');
  if (helpBtn) helpBtn.addEventListener('click', () => showHelpHandoff(helpContact()));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
