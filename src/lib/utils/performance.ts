/**
 * Performance monitoring utilities
 */

export interface PerformanceMetrics {
	fcp?: number; // First Contentful Paint
	lcp?: number; // Largest Contentful Paint
	fid?: number; // First Input Delay
	cls?: number; // Cumulative Layout Shift
	ttfb?: number; // Time to First Byte
}

/**
 * Report Core Web Vitals for monitoring
 */
export function reportWebVitals(onReport: (metric: { name: string; value: number }) => void) {
	if (typeof window === 'undefined') return;

	let fcpObserver: PerformanceObserver | null = null;
	let lcpObserver: PerformanceObserver | null = null;
	let fidObserver: PerformanceObserver | null = null;
	let clsObserver: PerformanceObserver | null = null;

	let stopped = false;
	const stop = () => {
		stopped = true;
		try { fcpObserver?.disconnect(); } catch { }
		try { lcpObserver?.disconnect(); } catch { }
		try { fidObserver?.disconnect(); } catch { }
		try { clsObserver?.disconnect(); } catch { }
	};

	window.addEventListener('pagehide', stop, { once: true });

	// FCP - First Contentful Paint
	fcpObserver = new PerformanceObserver((list) => {
		const entries = list.getEntries();
		const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
		if (fcpEntry) {
			onReport({ name: 'FCP', value: fcpEntry.startTime });
			try { fcpObserver?.disconnect(); } catch { }
		}
	});

	try {
		fcpObserver.observe({ entryTypes: ['paint'] });
	} catch {
		// Paint timing not supported
	}

	// LCP - Largest Contentful Paint
	lcpObserver = new PerformanceObserver((list) => {
		if (stopped) return;
		const entries = list.getEntries();
		const lastEntry = entries[entries.length - 1];
		if (lastEntry) {
			onReport({ name: 'LCP', value: lastEntry.startTime });
		}
	});

	try {
		lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
	} catch {
		// LCP not supported
	}

	// FID - First Input Delay
	fidObserver = new PerformanceObserver((list) => {
		if (stopped) return;
		const entries = list.getEntries();
		const firstInput = entries[0] as PerformanceEntry & { processingStart?: number };
		if (firstInput && 'processingStart' in firstInput && firstInput.processingStart) {
			const fid = firstInput.processingStart - firstInput.startTime;
			onReport({ name: 'FID', value: fid });
			try { fidObserver?.disconnect(); } catch { }
		}
	});

	try {
		fidObserver.observe({ entryTypes: ['first-input'] });
	} catch {
		// FID not supported
	}

	// CLS - Cumulative Layout Shift
	let clsValue = 0;
	clsObserver = new PerformanceObserver((list) => {
		if (stopped) return;
		for (const entry of list.getEntries()) {
			const layoutShiftEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value: number };
			if (!layoutShiftEntry.hadRecentInput) {
				clsValue += layoutShiftEntry.value;
				onReport({ name: 'CLS', value: clsValue });
			}
		}
	});

	try {
		clsObserver.observe({ entryTypes: ['layout-shift'] });
	} catch {
		// CLS not supported
	}

	return stop;
}

/**
 * Lazy load component with loading state
 */
export async function lazyLoad<T>(
	importer: () => Promise<{ default: T }>,
	onLoading?: () => void,
	onLoaded?: () => void
): Promise<T> {
	onLoading?.();
	try {
		const module = await importer();
		onLoaded?.();
		return module.default;
	} catch (error) {
		console.error('Failed to lazy load component:', error);
		throw error;
	}
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: never[]) => unknown>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout> | null = null;

	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			timeout = null;
			func(...args);
		};

		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: never[]) => unknown>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;

	return function executedFunction(...args: Parameters<T>) {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

/**
 * Check if device prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get device performance tier (high, medium, low)
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

/**
 * Preload image for better perceived performance
 */
export function preloadImage(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve();
		img.onerror = reject;
		img.src = src;
	});
}
