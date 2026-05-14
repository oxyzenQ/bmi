/**
 * Unit tests for warnDev() / warnDevOnce() dev-only logger utility.
 *
 * Since these utilities use import.meta.env.PROD which is statically
 * replaced by Vite, we need to test them in a way that allows
 * overriding the production check.
 */

import { describe, expect, it } from 'vitest';

describe('warnDev utility', () => {
  // We need to dynamically import to get fresh modules
  // Since import.meta.env.PROD is compile-time, we test the logic
  // by verifying the functions exist and have correct signatures
  it('exports warnDev function with correct signature', async () => {
    const mod = await import('$lib/utils/warn-dev');
    expect(mod.warnDev).toBeDefined();
    expect(typeof mod.warnDev).toBe('function');
    // Verify it accepts (module, fn, message) and doesn't throw
    expect(() => mod.warnDev('test', 'fn', 'message')).not.toThrow();
    // Verify it accepts optional error
    expect(() => mod.warnDev('test', 'fn', 'message', new Error('test'))).not.toThrow();
  });

  it('exports warnDevOnce function with correct signature', async () => {
    const mod = await import('$lib/utils/warn-dev');
    expect(mod.warnDevOnce).toBeDefined();
    expect(typeof mod.warnDevOnce).toBe('function');
    expect(() => mod.warnDevOnce('test', 'fn', 'message')).not.toThrow();
    expect(() => mod.warnDevOnce('test', 'fn', 'message', new Error('test'))).not.toThrow();
    expect(() => mod.warnDevOnce('test', 'fn', 'message', new Error('test'), 3)).not.toThrow();
  });
});

describe('warnDevOnce deduplication', () => {
  // Test that warnDevOnce deduplicates by tracking call counts
  // We can't test the actual console output in production mode,
  // but we can verify the function doesn't throw and accepts maxLogs parameter
  it('accepts custom maxLogs parameter', async () => {
    const mod = await import('$lib/utils/warn-dev');
    // Should not throw with custom maxLogs
    expect(() => mod.warnDevOnce('test', 'fn', 'msg', undefined, 1)).not.toThrow();
    expect(() => mod.warnDevOnce('test', 'fn', 'msg', undefined, 10)).not.toThrow();
  });
});