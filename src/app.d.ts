// Copyright (c) 2025 - 2026 rezky_nightky
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Global constants injected by Vite at build time
	const __GIT_COMMIT_ID__: string;
	const __GIT_BRANCH__: string;
	const __BUILD_TIME__: string;
	const __IS_VERCEL_DEPLOYMENT__: boolean;
}

export { };
