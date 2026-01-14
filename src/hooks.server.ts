import { dev } from '$app/environment';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) => {
			// Allow specific headers to be sent to the client
			return name === 'content-type' || name === 'cache-control';
		}
	});

	// Content Security Policy (CSP) - Protects against XSS attacks
	// More permissive in dev mode for Vite HMR
	const isDev = dev;

	const cspDirectives = isDev
		? [
			"default-src 'self' 'unsafe-inline' 'unsafe-eval'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com data:",
			"img-src 'self' data: blob: https:",
			"connect-src 'self' ws: wss: https:",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"object-src 'none'"
		]
		: [
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline'",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com data:",
			"img-src 'self' data: blob: https:",
			"connect-src 'self' https:",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"object-src 'none'",
			"upgrade-insecure-requests"
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
	if (!isDev) {
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

	// Cross-Origin-Embedder-Policy (COEP) - Controls resource loading (skip in dev)
	if (!isDev) {
		response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
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

	// Cache control for static assets
	if (event.url.pathname.startsWith('/_app/immutable/')) {
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
