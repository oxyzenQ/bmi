// Copyright (c) 2025 - 2026 rezky_nightky
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const adapterOptions = process.env.VERCEL_NODE_RUNTIME
	? { runtime: process.env.VERCEL_NODE_RUNTIME }
	: {};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(adapterOptions),
		serviceWorker: {
			register: false // We register manually for better control
		}
	}
};

export default config;
