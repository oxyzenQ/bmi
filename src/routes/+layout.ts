// Copyright (c) 2025 - 2026 rezky_nightky
import { dev } from '$app/environment';

// Only inject Vercel telemetry in production builds.
// Avoids unnecessary network requests and JS overhead in development.
if (!dev) {
	const { injectSpeedInsights } = await import('@vercel/speed-insights/sveltekit');
	const { injectAnalytics } = await import('@vercel/analytics/sveltekit');

	injectSpeedInsights();
	injectAnalytics({ mode: 'production' });
}