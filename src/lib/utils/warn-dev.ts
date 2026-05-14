/**
 * Development-only warning logger — v15.2 Observability
 *
 * Replaces all silent `catch {}` blocks across the codebase with
 * structured, context-rich warnings that only appear in development.
 *
 * Production behavior: completely eliminated by Vite/Rollup at build time
 * (import.meta.env.PROD is statically replaced). Zero runtime overhead,
 * zero bytes in the production bundle.
 *
 * Usage:
 *   warnDev('crypto', 'deriveKey', 'Argon2id unavailable, falling back to PBKDF2', err);
 *
 * Console output:
 *   [warn] [crypto:deriveKey] Argon2id unavailable, falling back to PBKDF2
 *         Error: <message>
 *         at <stack trace>
 */

/**
 * Log a warning with module/function context. No-op in production.
 *
 * @param module  - Source module name (e.g., 'crypto', 'storage', 'backup')
 * @param fn      - Function name where the error was caught
 * @param message - Human-readable description of what failed and why
 * @param error   - Optional caught value for stack trace / details
 */
export function warnDev(module: string, fn: string, message: string, error?: unknown): void {
  if (import.meta.env.PROD) return;

  const tag = `[${module}:${fn}]`;
  console.warn(`%c[warn] %c${tag}`, 'color:#f59e0b;font-weight:bold', 'color:#a78bfa;font-weight:bold', message);

  if (error !== undefined) {
    if (error instanceof Error) {
      console.groupCollapsed(`  ${error.message}`);
      console.trace('  Stack');
      console.groupEnd();
    } else if (typeof error === 'string') {
      console.warn('  Details:', error);
    } else {
      console.warn('  Details:', String(error));
    }
  }
}

/**
 * Counter for deduplicating recurring warnings (same module+fn+message).
 * After `maxLogs` emissions within a session, further warnings are suppressed.
 */
const _dedup = new Map<string, number>();
const MAX_LOGS_PER_SITE = 5;

/**
 * Like warnDev() but deduplicates — only logs the first N occurrences
 * of the same (module, fn, message) combination per session.
 * Useful for high-frequency catch blocks (e.g., IndexedDB writes, pointer capture).
 *
 * @param module  - Source module name
 * @param fn      - Function name
 * @param message - Human-readable description
 * @param error   - Optional caught value
 * @param maxLogs - Max occurrences before suppressing (default 5)
 */
export function warnDevOnce(module: string, fn: string, message: string, error?: unknown, maxLogs = MAX_LOGS_PER_SITE): void {
  if (import.meta.env.PROD) return;

  const key = `${module}:${fn}:${message}`;
  const count = (_dedup.get(key) ?? 0) + 1;
  _dedup.set(key, count);

  if (count <= maxLogs) {
    warnDev(module, fn, count === maxLogs ? `${message} (further warnings suppressed)` : message, error);
  }
}