// Copyright (c) 2025 - 2026 rezky_nightky
import { dev } from '$app/environment';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const isDev = dev;
	const isHttpsRequest = event.url.protocol === 'https:';
	const isVercelHost = event.url.hostname.endsWith('.vercel.app');
	const allowVercelToolbar = isVercelHost && process.env.VERCEL_ENV !== 'production';
	const vercelLiveOrigin = 'https://vercel.live';
	const vercelInsightsOrigin = 'https://vitals.vercel-insights.com';
	const vercelLiveSrc = allowVercelToolbar ? ` ${vercelLiveOrigin}` : '';
	const vercelToolbarConnectSrc = allowVercelToolbar
		? ` ${vercelLiveOrigin} wss://ws-us3.pusher.com`
		: '';
	const vercelToolbarStyleSrc = allowVercelToolbar ? ` ${vercelLiveOrigin}` : '';
	const vercelToolbarFontSrc = allowVercelToolbar
		? ` ${vercelLiveOrigin} https://assets.vercel.com`
		: '';
	const vercelToolbarImgSrc = allowVercelToolbar ? ` ${vercelLiveOrigin} https://vercel.com` : '';

	const response = await resolve(event, {
		preload: ({ type }) => {
			// CSS is still emitted as normal <link rel="stylesheet"> tags.
			// Skipping CSS Link-header preloads avoids Chromium's noisy
			// "preloaded but not used" warnings for lazy route/component CSS.
			return type === 'js' || type === 'font';
		},
		filterSerializedResponseHeaders: (name) => {
			// Allow specific headers to be sent to the client
			return name === 'content-type' || name === 'cache-control';
		}
	});

	// Content Security Policy (CSP) - Protects against XSS attacks
	// More permissive in dev mode for Vite HMR
	const cspDirectives = isDev
		? [
				"default-src 'self' 'unsafe-inline' 'unsafe-eval'",
				"script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
				"style-src 'self' 'unsafe-inline'",
				"font-src 'self' data:",
				"img-src 'self' data: blob: https:",
				"connect-src 'self' ws: wss: https: http://localhost:5173",
				"frame-ancestors 'none'",
				"base-uri 'self'",
				"form-action 'self'",
				"object-src 'none'"
			]
		: [
				"default-src 'self'",
				// 'unsafe-inline' REQUIRED for SvelteKit hydration (<script> in HTML)
				// Without this, production deployments (Vercel) render blank pages
				// because the browser blocks inline __sveltekit bootstrap scripts.
				// Vercel preview hosts also need vercel.live for the feedback toolbar.
				`script-src 'self' 'unsafe-inline'${vercelLiveSrc}`,
				// 'unsafe-inline' needed for Svelte style:xxx directives and style={...} bindings
				`style-src 'self' 'unsafe-inline'${vercelToolbarStyleSrc}`,
				`font-src 'self' data:${vercelToolbarFontSrc}`,
				`img-src 'self' data: blob: https:${vercelToolbarImgSrc}`,
				"media-src 'self'",
				`connect-src 'self' https://raw.githubusercontent.com https://api.github.com ${vercelInsightsOrigin}${vercelToolbarConnectSrc}`,
				"manifest-src 'self'",
				"worker-src 'self' blob:",
				`frame-src 'self'${vercelLiveSrc}`,
				"frame-ancestors 'none'",
				"base-uri 'self'",
				"form-action 'self'",
				"object-src 'none'",
				...(isHttpsRequest ? ['upgrade-insecure-requests'] : [])
			];

	if (!isDev && !response.headers.has('content-security-policy')) {
		response.headers.set('Content-Security-Policy', cspDirectives.join('; '));
	}

	// Ensure dev mode does not emit CSP headers (including report-only) to avoid noisy console logs
	if (isDev) {
		response.headers.delete('Content-Security-Policy');
		response.headers.delete('Content-Security-Policy-Report-Only');
		response.headers.delete('content-security-policy');
		response.headers.delete('content-security-policy-report-only');
	}

	// Skip HTTPS-only headers in development
	if (!isDev && isHttpsRequest) {
		// HTTP Strict Transport Security (HSTS) - Forces HTTPS
		response.headers.set(
			'Strict-Transport-Security',
			'max-age=63072000; includeSubDomains; preload'
		);
	}

	// Cross-Origin-Opener-Policy (COOP) - Isolates browsing context
	response.headers.set('Cross-Origin-Opener-Policy', isDev ? 'unsafe-none' : 'same-origin');

	// Cross-Origin-Resource-Policy (CORP) - Protects resources
	response.headers.set('Cross-Origin-Resource-Policy', isDev ? 'cross-origin' : 'same-origin');

	// Cross-Origin-Embedder-Policy (COEP) - credentialless allows cross-origin
	// resources without CORP headers. Vercel Toolbar preview requests rely on
	// Vercel auth/session behavior, so avoid credentialless there to prevent
	// noisy 401 toolbar failures in branch previews.
	if (!isDev && !allowVercelToolbar) {
		response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
	}

	// Permissions Policy - Controls browser features
	response.headers.set(
		'Permissions-Policy',
		'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
	);

	// X-Content-Type-Options - Prevents MIME sniffing
	response.headers.set('X-Content-Type-Options', 'nosniff');

	// X-Frame-Options - Prevents clickjacking (backup for CSP frame-ancestors)
	response.headers.set('X-Frame-Options', 'DENY');

	// X-XSS-Protection - Enables XSS filter (legacy browsers)
	response.headers.set('X-XSS-Protection', '1; mode=block');

	// Referrer-Policy - Controls referrer information
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	// Cache control: keep HTML/service worker fresh; long-cache hashed assets only.
	const contentType = response.headers.get('content-type') ?? '';
	if (event.url.pathname === '/service-worker.js' || event.url.pathname === '/manifest.json') {
		response.headers.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
	} else if (contentType.includes('text/html')) {
		response.headers.set('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
	} else if (event.url.pathname.startsWith('/_app/immutable/')) {
		// Immutable assets - cache for 1 year
		response.headers.set('Cache-Control', 'public, immutable, max-age=31536000');
	} else if (event.url.pathname.startsWith('/assets/')) {
		// Static assets - cache for 1 month
		response.headers.set('Cache-Control', 'public, max-age=2592000');
	} else if (
		event.url.pathname.endsWith('.woff2') ||
		event.url.pathname.endsWith('.woff') ||
		event.url.pathname.endsWith('.webp') ||
		event.url.pathname.endsWith('.jpg') ||
		event.url.pathname.endsWith('.png')
	) {
		// Fonts and images - cache for 1 year
		response.headers.set('Cache-Control', 'public, max-age=31536000');
	}

	return response;
};
