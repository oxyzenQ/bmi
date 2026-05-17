// Copyright (c) 2025 - 2026 rezky_nightky
/**
 * Unit tests for logger.ts — v16.0 Observability
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// Stub browser globals needed by logger → trace
vi.stubGlobal('performance', { now: vi.fn(() => 0) });
vi.stubGlobal('crypto', {
        getRandomValues: (arr: Uint8Array) => {
                for (let i = 0; i < arr.length; i++) arr[i] = (i * 37 + 13) % 256;
                return arr;
        },
});

describe('logger', () => {
        let loggerModule: typeof import('$lib/utils/logger');
        let traceModule: typeof import('$lib/utils/trace');

        beforeEach(async () => {
                // Reset modules for fresh state
                vi.resetModules();
                traceModule = await import('$lib/utils/trace');
                traceModule._resetTraceState();
                loggerModule = await import('$lib/utils/logger');
        });

        afterEach(() => {
                loggerModule.logger.clear();
        });

        it('exports logger with correct methods', () => {
                expect(loggerModule.logger.debug).toBeDefined();
                expect(loggerModule.logger.info).toBeDefined();
                expect(loggerModule.logger.warn).toBeDefined();
                expect(loggerModule.logger.error).toBeDefined();
                expect(loggerModule.logger.getEntries).toBeDefined();
                expect(loggerModule.logger.getEntriesByLevel).toBeDefined();
                expect(loggerModule.logger.clear).toBeDefined();
                expect(loggerModule.logger.setMaxEntries).toBeDefined();
        });

        it('debug() creates an entry in the ring buffer', () => {
                loggerModule.logger.clear();
                loggerModule.logger.debug('test', 'fn', 'debug message', { key: 'val' });
                const entries = loggerModule.logger.getEntries();
                expect(entries).toHaveLength(1);
                expect(entries[0].level).toBe('DEBUG');
                expect(entries[0].module).toBe('test');
                expect(entries[0].fn).toBe('fn');
                expect(entries[0].message).toBe('debug message');
                expect(entries[0].data).toEqual({ key: 'val' });
                expect(entries[0].traceId).toMatch(/^sess-/);
        });

        it('info() creates an entry with INFO level', () => {
                loggerModule.logger.clear();
                loggerModule.logger.info('app', 'init', 'started');
                const entries = loggerModule.logger.getEntries();
                expect(entries).toHaveLength(1);
                expect(entries[0].level).toBe('INFO');
        });

        it('warn() creates an entry with WARN level and error info', () => {
                loggerModule.logger.clear();
                const err = new Error('test error');
                loggerModule.logger.warn('crypto', 'encrypt', 'encryption failed', err);
                const entries = loggerModule.logger.getEntries();
                expect(entries).toHaveLength(1);
                expect(entries[0].level).toBe('WARN');
                expect(entries[0].error).toBeDefined();
                expect(entries[0].error?.name).toBe('Error');
                expect(entries[0].error?.message).toBe('test error');
        });

        it('error() creates an entry with ERROR level and extracts stack', () => {
                loggerModule.logger.clear();
                const err = new TypeError('wrong type');
                loggerModule.logger.error('storage', 'read', 'read failed', err);
                const entries = loggerModule.logger.getEntries();
                expect(entries).toHaveLength(1);
                expect(entries[0].level).toBe('ERROR');
                expect(entries[0].error?.name).toBe('TypeError');
                expect(entries[0].error?.stack).toBeDefined();
        });

        it('error() handles non-Error values gracefully', () => {
                loggerModule.logger.clear();
                loggerModule.logger.error('mod', 'fn', 'string error', 'just a string');
                const entries = loggerModule.logger.getEntries();
                expect(entries).toHaveLength(1);
                expect(entries[0].error?.name).toBe('UnknownError');
                expect(entries[0].error?.message).toBe('just a string');
        });

        it('getEntriesByLevel filters correctly', () => {
                loggerModule.logger.clear();
                loggerModule.logger.debug('m', 'f', 'd');
                loggerModule.logger.info('m', 'f', 'i');
                loggerModule.logger.warn('m', 'f', 'w');
                loggerModule.logger.error('m', 'f', 'e');

                expect(loggerModule.logger.getEntriesByLevel('ALL')).toHaveLength(4);
                // Since import.meta.env.PROD is false in test, all levels work
                expect(loggerModule.logger.getEntriesByLevel('WARN')).toHaveLength(2); // WARN + ERROR
                expect(loggerModule.logger.getEntriesByLevel('ERROR')).toHaveLength(1);
        });

        it('clear() removes all entries', () => {
                loggerModule.logger.info('m', 'f', 'msg');
                loggerModule.logger.info('m', 'f', 'msg2');
                expect(loggerModule.logger.getEntries()).toHaveLength(2);
                loggerModule.logger.clear();
                expect(loggerModule.logger.getEntries()).toHaveLength(0);
        });

        it('setMaxEntries trims buffer when exceeded', () => {
                loggerModule.logger.clear();
                // setMaxEntries clamps to min 10, so use 12 with 20 entries
                loggerModule.logger.setMaxEntries(12);
                for (let i = 0; i < 20; i++) {
                        loggerModule.logger.info('m', 'f', `msg ${i}`);
                }
                expect(loggerModule.logger.getEntries()).toHaveLength(12);
                // Should have kept the last 12
                expect(loggerModule.logger.getEntries()[0].message).toBe('msg 8');
        });

        it('entries have auto-incrementing seq numbers', () => {
                loggerModule.logger.clear();
                loggerModule.logger.info('m', 'f', 'first');
                loggerModule.logger.info('m', 'f', 'second');
                loggerModule.logger.info('m', 'f', 'third');
                const entries = loggerModule.logger.getEntries();
                expect(entries[0].seq).toBeLessThan(entries[1].seq);
                expect(entries[1].seq).toBeLessThan(entries[2].seq);
        });

        it('entries include session trace ID', () => {
                loggerModule.logger.clear();
                loggerModule.logger.info('m', 'f', 'test');
                const entry = loggerModule.logger.getEntries()[0];
                expect(entry.traceId).toMatch(/^sess-[a-zA-Z0-9_-]{8}$/);
        });

        it('entries include span ID when a span is active', async () => {
                loggerModule.logger.clear();
                const spanId = traceModule.startSpan('test-op');
                loggerModule.logger.info('m', 'f', 'within span');
                const entry = loggerModule.logger.getEntries()[0];
                expect(entry.spanId).toBe(spanId);
        });
});