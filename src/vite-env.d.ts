// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/// <reference types="vite/client" />

declare module 'virtual:changelog-latest' {
	import type { ChangelogSection } from '$lib/utils/changelog';

	export interface ChangelogLatest {
		/** The app version the section was resolved for at build time. */
		version: string;
		/** The release section, or null when the ledger has none for it. */
		section: ChangelogSection | null;
	}

	export const changelogLatest: ChangelogLatest;
}

declare module '*?worker&inline' {
	const workerConstructor: new () => Worker;
	export default workerConstructor;
}
