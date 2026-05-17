// Copyright (c) 2025 - 2026 rezky_nightky
import { browser, dev } from '$app/environment';

// Only inject Vercel telemetry on real Vercel deployments.
// Local production preview does not expose /_vercel/* endpoints.
if (!dev && browser && __IS_VERCEL_DEPLOYMENT__) {
	const { injectSpeedInsights } = await import('@vercel/speed-insights/sveltekit');
	const { injectAnalytics } = await import('@vercel/analytics/sveltekit');

	injectSpeedInsights();
	injectAnalytics({ mode: 'production' });
}
