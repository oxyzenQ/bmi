/**
 * Unit tests for trace.ts — v16.0 Observability
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';

// Mock performance.now for consistent test results
vi.stubGlobal('performance', { now: vi.fn(() => 0) });

// Mock crypto.getRandomValues
vi.stubGlobal('crypto', {
	getRandomValues: (arr: Uint8Array) => {
		for (let i = 0; i < arr.length; i++) arr[i] = (i * 37 + 13) % 256;
		return arr;
	},
});

describe('trace', () => {
	beforeEach(async () => {
		const { _resetTraceState } = await import('$lib/utils/trace');
		_resetTraceState();
	});

	it('getSessionTraceId returns a stable ID across calls', async () => {
		const { getSessionTraceId } = await import('$lib/utils/trace');
		const id1 = getSessionTraceId();
		const id2 = getSessionTraceId();
		expect(id1).toBe(id2);
		expect(typeof id1).toBe('string');
		expect(id1).toMatch(/^sess-[a-zA-Z0-9_-]{8}$/);
	});

	it('nextTraceSeq returns incrementing numbers', async () => {
		const { nextTraceSeq } = await import('$lib/utils/trace');
		const seq1 = nextTraceSeq();
		const seq2 = nextTraceSeq();
		const seq3 = nextTraceSeq();
		expect(seq1).toBe(1);
		expect(seq2).toBe(2);
		expect(seq3).toBe(3);
	});

	it('startSpan returns a unique span ID', async () => {
		const { startSpan } = await import('$lib/utils/trace');
		const id1 = startSpan('test-operation');
		const id2 = startSpan('another-operation');
		expect(id1).not.toBe(id2);
		expect(id1).toContain('test-oper');
		expect(id2).toContain('another-ope');
	});

	it('getCurrentSpanId returns innermost span', async () => {
		const { startSpan, getCurrentSpanId } = await import('$lib/utils/trace');
		expect(getCurrentSpanId()).toBeNull();

		const span1 = startSpan('outer');
		expect(getCurrentSpanId()).toBe(span1);

		const span2 = startSpan('inner');
		expect(getCurrentSpanId()).toBe(span2);
	});

	it('endSpan removes span from stack and returns duration', async () => {
		const { startSpan, endSpan, getCurrentSpanId } = await import('$lib/utils/trace');

		const span1 = startSpan('outer');
		const span2 = startSpan('inner');

		// End inner span
		const dur2 = endSpan(span2);
		expect(dur2).toBeGreaterThanOrEqual(0);
		expect(getCurrentSpanId()).toBe(span1);

		// End outer span
		const dur1 = endSpan(span1);
		expect(dur1).toBeGreaterThanOrEqual(0);
		expect(getCurrentSpanId()).toBeNull();
	});

	it('endSpan returns -1 for unknown span', async () => {
		const { endSpan } = await import('$lib/utils/trace');
		expect(endSpan('nonexistent-span-id')).toBe(-1);
	});

	it('getTraceContext returns full context object', async () => {
		const { getTraceContext, getSessionTraceId, startSpan } = await import('$lib/utils/trace');

		const sessionId = getSessionTraceId();
		const ctx = getTraceContext();

		expect(ctx.sessionTraceId).toBe(sessionId);
		expect(ctx.spanId).toBeNull();
		expect(ctx.seq).toBeGreaterThan(0);

		// With active span
		const spanId = startSpan('test');
		const ctx2 = getTraceContext();
		expect(ctx2.spanId).toBe(spanId);
		expect(ctx2.seq).toBeGreaterThan(ctx.seq);
	});
});
