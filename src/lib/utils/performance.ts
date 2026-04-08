/**
 * Performance utilities — only exports that are actively used.
 *
 * Removed (dead code, 2026-04):
 *   reportWebVitals, lazyLoad, debounce, throttle, preloadImage
 *   — None were imported anywhere. If needed, restore from git history.
 */

/**
 * Check if device prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get device performance tier (high, medium, low).
 *
 * Uses hardwareConcurrency, deviceMemory, and connection.effectiveType.
 * Defaults to 'medium' when APIs are unavailable.
 */
export function getPerformanceTier(): 'high' | 'medium' | 'low' {
	if (typeof window === 'undefined') return 'medium';

	// Check for hardware concurrency (CPU cores)
	const cores = navigator.hardwareConcurrency || 2;

	// Check for device memory (if available)
	const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4; // Default to 4GB

	// Check for connection type
	const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
	const effectiveType = connection?.effectiveType || '4g';

	// Determine tier
	if (cores >= 8 && memory >= 8 && (effectiveType === '4g' || !connection)) {
		return 'high';
	} else if (cores >= 4 && memory >= 4) {
		return 'medium';
	} else {
		return 'low';
	}
}
