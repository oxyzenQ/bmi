import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) => {
			// Allow specific headers to be sent to the client
			return name === 'content-type' || name === 'cache-control';
		}
	});

	// Add performance and security headers
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-XSS-Protection', '1; mode=block');
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
