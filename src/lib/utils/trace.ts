/**
 * Trace ID system — v16.0 Observability
 *
 * Generates unique trace IDs for request/app lifecycles, enabling
 * correlation of log entries across modules and async operations.
 *
 * Architecture:
 *   - Session trace ID: one per app session (stable across navigation)
 *   - Child spans: scoped trace IDs for specific operations
 *   - Auto-incrementing counters for ordered correlation
 *
 * Completely eliminated in production builds (tree-shaken when unused).
 * Trace IDs are only attached to log entries in development mode via logger.ts.
 */

/** Generate a short random ID (8 chars, URL-safe). */
function randomId(): string {
	const bytes = new Uint8Array(6); // 48 bits → ~8 base64 chars
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.slice(0, 8);
}

/** Global counter for ordering within a session. */
let _counter = 0;

/**
 * Get the next sequential trace number.
 * Used for ordering correlation between log entries.
 */
export function nextTraceSeq(): number {
	return ++_counter;
}

// ── Session Trace ──

let _sessionTraceId: string | null = null;

/**
 * Get or create the session-level trace ID.
 * Stable for the entire app session (until page reload).
 * Format: `sess-{random8}`
 */
export function getSessionTraceId(): string {
	if (!_sessionTraceId) {
		_sessionTraceId = `sess-${randomId()}`;
	}
	return _sessionTraceId;
}

// ── Operation Spans ──

interface ActiveSpan {
	/** Parent trace context (null for root spans) */
	parentId: string | null;
	/** This span's unique ID */
	spanId: string;
	/** Human-readable operation name */
	name: string;
	/** Monotonic timestamp (ms) */
	startTime: number;
}

/** Stack of active spans (for nested operations). */
const _spanStack: ActiveSpan[] = [];

/**
 * Start a new trace span for an operation.
 *
 * @param name - Human-readable operation name (e.g., 'storage.init', 'crypto.encrypt')
 * @returns Span ID for passing to `endSpan()` or attaching to logs
 *
 * Usage:
 *   const spanId = startSpan('storage.init');
 *   // ... do work ...
 *   endSpan(spanId);
 *
 *   // Or with logger:
 *   logger.info('storage', 'init', 'Storage initialized', { spanId });
 */
export function startSpan(name: string): string {
	const parentId = _spanStack.length > 0 ? _spanStack[_spanStack.length - 1].spanId : null;
	const spanId = `${name.slice(0, 12)}-${randomId()}`;

	_spanStack.push({
		parentId,
		spanId,
		name,
		startTime: performance.now(),
	});

	return spanId;
}

/**
 * End a trace span and log its duration via console.debug in dev mode.
 *
 * @param spanId - The span ID returned by `startSpan()`
 * @returns Duration in milliseconds, or -1 if span not found
 */
export function endSpan(spanId: string): number {
	const idx = _spanStack.findIndex((s) => s.spanId === spanId);
	if (idx === -1) return -1;

	const span = _spanStack.splice(idx, 1)[0];
	const duration = performance.now() - span.startTime;

	if (!import.meta.env.PROD) {
		const parentInfo = span.parentId ? ` parent=${span.parentId}` : '';
		console.debug(
			`%c[trace] %c${span.spanId}${parentInfo} %c${duration.toFixed(1)}ms`,
			'color:#06b6d4;font-weight:bold',
			'color:#8b5cf6',
			'color:#22c55e'
		);
	}

	return duration;
}

/**
 * Get the current (innermost) active span ID.
 * Returns null if no spans are active.
 */
export function getCurrentSpanId(): string | null {
	if (_spanStack.length === 0) return null;
	return _spanStack[_spanStack.length - 1].spanId;
}

/**
 * Get trace context object for attaching to log entries.
 *
 * @returns Object with sessionTraceId, spanId (if active), and seq number
 */
export function getTraceContext(): {
	sessionTraceId: string;
	spanId: string | null;
	seq: number;
} {
	return {
		sessionTraceId: getSessionTraceId(),
		spanId: getCurrentSpanId(),
		seq: nextTraceSeq(),
	};
}

/**
 * Reset trace state. For testing only.
 */
export function _resetTraceState(): void {
	_sessionTraceId = null;
	_counter = 0;
	_spanStack.length = 0;
}
