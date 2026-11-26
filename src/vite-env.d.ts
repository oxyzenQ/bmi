// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/// <reference types="vite/client" />

declare module 'virtual:changelog-latest' {
	import type { ChangelogSection } from '$lib/utils/changelog';

	export interface ChangelogLatest {
		/** The app version the payload was resolved for at build time. */
		version: string;
		/** Every release section the ledger records, newest first. */
		history: ChangelogSection[];
	}

	export const changelogLatest: ChangelogLatest;
}

declare module '*?worker&inline' {
	const workerConstructor: new () => Worker;
	export default workerConstructor;
}
