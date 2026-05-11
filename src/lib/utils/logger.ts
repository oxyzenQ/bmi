/**
 * Structured Logger — v16.0 Observability
 *
 * Central logging system with log levels, ring buffer, trace ID integration,
 * and backward compatibility with warnDev().
 *
 * Log Levels:
 *   DEBUG (0) — Verbose dev-only output, stripped in production
 *   INFO  (1) — General operational messages
 *   WARN  (2) — Recoverable issues / degraded behavior
 *   ERROR (3) — Failures requiring attention
 *
 * Features:
 *   - In-memory ring buffer (configurable, default 200 entries)
 *   - Automatic trace ID attachment via getTraceContext()
 *   - Structured entry format for programmatic consumption
 *   - Production-safe: DEBUG logs are compile-time eliminated
 *   - warnDev() bridge: existing warnDev calls can be routed through logger
 *
 * Usage:
 *   import { logger } from '$lib/utils/logger';
 *   logger.debug('storage', 'init', 'Cache populated', { keyCount: 12 });
 *   logger.info('crypto', 'encrypt', 'Data encrypted successfully', { size: 1024 });
 *   logger.warn('storage', 'write', 'localStorage write failed, using cache only', err);
 *   logger.error('crypto', 'decrypt', 'Decryption failed — wrong passphrase?', err);
 */

import { getTraceContext } from './trace';

// ── Types ──

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
        /** Monotonic timestamp (Date.toISOString()) */
        timestamp: string;
        /** Log level */
        level: LogLevel;
        /** Source module name (e.g., 'storage', 'crypto') */
        module: string;
        /** Function name where the log originated */
        fn: string;
        /** Human-readable message */
        message: string;
        /** Session trace ID */
        traceId: string;
        /** Current span ID (if active) */
        spanId: string | null;
        /** Sequential number within session */
        seq: number;
        /** Optional additional context data */
        data?: Record<string, unknown>;
        /** Error object (if applicable) */
        error?: {
                name: string;
                message: string;
                stack?: string;
        };
}

// ── Ring Buffer ──

const DEFAULT_MAX_ENTRIES = 200;

let _maxEntries = DEFAULT_MAX_ENTRIES;
const _buffer: LogEntry[] = [];

/**
 * Add an entry to the ring buffer.
 * When buffer exceeds maxEntries, oldest entries are discarded.
 */
function pushToBuffer(entry: LogEntry): void {
        _buffer.push(entry);
        if (_buffer.length > _maxEntries) {
                _buffer.splice(0, _buffer.length - _maxEntries);
        }
}

// ── Console Formatting ──

const LEVEL_COLORS: Record<LogLevel, string> = {
        DEBUG: 'color:#06b6d4;font-weight:bold',
        INFO: 'color:#22c55e;font-weight:bold',
        WARN: 'color:#f59e0b;font-weight:bold',
        ERROR: 'color:#ef4444;font-weight:bold',
};

const LEVEL_BG: Record<LogLevel, string> = {
        DEBUG: '#164e63',
        INFO: '#14532d',
        WARN: '#713f12',
        ERROR: '#7f1d1d',
};

// ── Logger API ──

export interface Logger {
        debug(module: string, fn: string, message: string, data?: Record<string, unknown>): void;
        info(module: string, fn: string, message: string, data?: Record<string, unknown>): void;
        warn(module: string, fn: string, message: string, error?: unknown, data?: Record<string, unknown>): void;
        error(module: string, fn: string, message: string, error?: unknown, data?: Record<string, unknown>): void;
        /** Get all buffered log entries (for debug panel) */
        getEntries(): readonly LogEntry[];
        /** Get entries filtered by minimum level, or 'ALL' for no filter */
        getEntriesByLevel(minLevel: LogLevel | 'ALL'): readonly LogEntry[];
        /** Clear the ring buffer */
        clear(): void;
        /** Set max buffer size */
        setMaxEntries(max: number): void;
}

/**
 * Extract error info from unknown caught value.
 */
function extractError(error: unknown): LogEntry['error'] | undefined {
        if (error === undefined || error === null) return undefined;
        if (error instanceof Error) {
                return {
                        name: error.name,
                        message: error.message,
                        stack: error.stack,
                };
        }
        return {
                name: 'UnknownError',
                message: String(error),
        };
}

/**
 * Create a structured log entry and push to buffer + console.
 */
function logEntry(
        level: LogLevel,
        module: string,
        fn: string,
        message: string,
        error?: unknown,
        data?: Record<string, unknown>
): void {
        const trace = getTraceContext();
        const entry: LogEntry = {
                timestamp: new Date().toISOString(),
                level,
                module,
                fn,
                message,
                traceId: trace.sessionTraceId,
                spanId: trace.spanId,
                seq: trace.seq,
                ...(data && Object.keys(data).length > 0 ? { data } : {}),
                ...(error !== undefined ? { error: extractError(error) } : {}),
        };

        // Always buffer (for debug panel in dev)
        pushToBuffer(entry);

        // Console output (respects level gating)
        const consoleFn = level === 'DEBUG' ? 'debug' : level === 'INFO' ? 'info' : level === 'WARN' ? 'warn' : 'error';
        const ctx = trace.spanId ? ` → ${trace.spanId}` : '';

        console[consoleFn](
                `%c${level}%c [${module}:${fn}]${ctx} %c${message}`,
                `background:${LEVEL_BG[level]};color:white;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:bold`,
                LEVEL_COLORS[level],
                'color:inherit'
        );

        if (entry.error) {
                if (entry.error.stack) {
                        console.groupCollapsed(`  ${entry.error.name}: ${entry.error.message}`);
                        console.trace('  Stack');
                        console.groupEnd();
                } else {
                        console.warn('  Details:', entry.error.message);
                }
        }

        if (entry.data && Object.keys(entry.data).length > 0) {
                console.log('  Context:', entry.data);
        }
}

/**
 * The structured logger instance.
 * Use this throughout the app for consistent, traceable logging.
 *
 * In production: debug() is a no-op (compile-time via import.meta.env.PROD).
 * warn() and error() still log to console and buffer.
 */
export const logger: Logger = {
        debug(module: string, fn: string, message: string, data?: Record<string, unknown>): void {
                if (import.meta.env.PROD) return;
                logEntry('DEBUG', module, fn, message, undefined, data);
        },

        info(module: string, fn: string, message: string, data?: Record<string, unknown>): void {
                if (import.meta.env.PROD) return;
                logEntry('INFO', module, fn, message, undefined, data);
        },

        warn(module: string, fn: string, message: string, error?: unknown, data?: Record<string, unknown>): void {
                logEntry('WARN', module, fn, message, error, data);
        },

        error(module: string, fn: string, message: string, error?: unknown, data?: Record<string, unknown>): void {
                logEntry('ERROR', module, fn, message, error, data);
        },

        getEntries(): readonly LogEntry[] {
                return _buffer;
        },

        getEntriesByLevel(minLevel: LogLevel | 'ALL'): readonly LogEntry[] {
                if (minLevel === 'ALL') return _buffer;
                const levels: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
                const min = levels[minLevel] ?? 0;
                return _buffer.filter((e) => (levels[e.level] ?? 0) >= min);
        },

        clear(): void {
                _buffer.length = 0;
        },

        setMaxEntries(max: number): void {
                _maxEntries = Math.max(10, Math.min(1000, max));
                if (_buffer.length > _maxEntries) {
                        _buffer.splice(0, _buffer.length - _maxEntries);
                }
        },
};
