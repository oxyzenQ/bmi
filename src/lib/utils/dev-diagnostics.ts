/**
 * Dev-only diagnostics helpers — v15.2 Observability
 *
 * Exposes `window.__bmi_dev` in development mode with utilities for
 * inspecting storage, encryption status, and backup state.
 * Completely eliminated in production builds.
 *
 * Usage (dev console):
 *   __bmi_dev.storage()       // Show all stored keys + values
 *   __bmi_dev.encryption()    // Show encryption status
 *   __bmi_dev.backups()       // Show backup status
 *   __bmi_dev.warnings()      // Show warnDev dedup counters
 */

import { browser } from '$app/environment';
import { STORAGE_KEYS, storageGet, isStorageAvailable } from './storage';
import { isIndexedDbAvailable } from './db';
import { getEncryptionStatus } from './crypto';
import { getBackupStatus } from './backup';

export interface DevDiagnostics {
  /** Show all stored key-value pairs */
  storage: () => Record<string, unknown>;
  /** Show encryption status */
  encryption: () => Promise<unknown>;
  /** Show backup status */
  backups: () => Promise<unknown>;
  /** Show environment info */
  env: () => Record<string, unknown>;
}

/**
 * Initialize dev diagnostics on `window.__bmi_dev`.
 * No-op in production.
 */
export function initDevDiagnostics(): void {
  if (import.meta.env.PROD || !browser) return;

  const diagnostics: DevDiagnostics = {
    storage(): Record<string, unknown> {
      const result: Record<string, unknown> = {};

      // Core storage keys
      for (const key of Object.values(STORAGE_KEYS)) {
        result[key] = storageGet(key);
      }

      // Environment info
      result.__meta = {
        localStorageAvailable: isStorageAvailable(),
        indexedDbAvailable: isIndexedDbAvailable(),
      };

      return result;
    },

    async encryption(): Promise<unknown> {
      return getEncryptionStatus();
    },

    async backups(): Promise<unknown> {
      return getBackupStatus();
    },

    env(): Record<string, unknown> {
      return {
        browser: true,
        localStorage: isStorageAvailable(),
        indexedDB: isIndexedDbAvailable(),
        timestamp: new Date().toISOString(),
      };
    },
  };

  // Expose on window for dev console access
  (window as unknown as Record<string, DevDiagnostics>).__bmi_dev = diagnostics;

  if (import.meta.env.DEV) {
    console.log(
      '%c[dev] %cBMI Stellar diagnostics available: window.__bmi_dev',
      'color:#f59e0b;font-weight:bold',
      'color:#a78bfa;font-weight:bold'
    );
    console.log(
      '%c  Methods: %c.storage() %c.encryption() %c.backups() %c.env()',
      'color:#666',
      'color:#22c55e',
      'color:#22c55e',
      'color:#22c55e',
      'color:#22c55e'
    );
  }
}
