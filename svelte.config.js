import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			runtime: 'nodejs22.x'
		}),
		...(isDev
			? {}
			: {
				csp: {
					mode: 'auto',
					directives: {
						'default-src': ['self'],
						'base-uri': ['self'],
						'object-src': ['none'],
						'frame-ancestors': ['none'],
						'form-action': ['self'],
						'img-src': ['self', 'data:', 'blob:', 'https:'],
						'font-src': ['self', 'data:'],
						'connect-src': ['self', 'https:'],
						'manifest-src': ['self'],
						'script-src': ['self'],
						'script-src-attr': ['none'],
						'style-src': ['self', 'unsafe-inline'],
						'upgrade-insecure-requests': true
					}
				}
			}),
		serviceWorker: {
			register: false // We register manually for better control
		},
		prerender: {
			handleMissingId: 'warn'
		}
	}
};

export default config;
