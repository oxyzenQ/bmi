// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * Dev-only diagnostics helpers — v16.0 Observability
 *
 * Exposes `window.__bmi_dev` in development mode with utilities for
 * inspecting storage, encryption status, backup state, and structured logs.
 * Completely eliminated in production builds.
 *
 * Usage (dev console):
 *   __bmi_dev.storage()       // Show all stored keys + values
 *   __bmi_dev.encryption()    // Show encryption status
 *   __bmi_dev.backups()       // Show backup status
 *   __bmi_dev.env()           // Show environment info
 *   __bmi_dev.logs()          // Show structured logger ring buffer
 *   __bmi_dev.trace()         // Show current session trace ID
 */

import { browser } from '$app/environment';
import { STORAGE_KEYS, storageGet, isStorageAvailable } from './storage';
import { isIndexedDbAvailable } from './db';
import { getEncryptionStatus } from './crypto';
import { getBackupStatus } from './backup';
import { logger } from './logger';
import { getSessionTraceId } from './trace';

export interface DevDiagnostics {
  /** Show all stored key-value pairs */
  storage: () => Record<string, unknown>;
  /** Show encryption status */
  encryption: () => Promise<unknown>;
  /** Show backup status */
  backups: () => Promise<unknown>;
  /** Show environment info */
  env: () => Record<string, unknown>;
  /** Show structured logger entries from ring buffer */
  logs: () => unknown[];
  /** Show current session trace ID and active spans */
  trace: () => Record<string, unknown>;
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

    /** v16.0: Show all structured log entries from ring buffer */
    logs(): unknown[] {
      return logger.getEntries().map((e) => ({
        time: e.timestamp,
        level: e.level,
        module: e.module,
        fn: e.fn,
        message: e.message,
        traceId: e.traceId,
        spanId: e.spanId,
        seq: e.seq,
        ...(e.error ? { error: `${e.error.name}: ${e.error.message}` } : {}),
        ...(e.data ? { data: e.data } : {}),
      }));
    },

    /** v16.0: Show current trace context */
    trace(): Record<string, unknown> {
      return {
        sessionTraceId: getSessionTraceId(),
        logCount: logger.getEntries().length,
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
      '%c  Methods: %c.storage() %c.encryption() %c.backups() %c.env() %c.logs() %c.trace()',
      'color:#666',
      'color:#22c55e',
      'color:#22c55e',
      'color:#22c55e',
      'color:#22c55e',
      'color:#06b6d4',
      'color:#06b6d4'
    );
  }
}