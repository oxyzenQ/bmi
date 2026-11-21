// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/// <reference types="vite/client" />

declare module '*?worker&inline' {
	const workerConstructor: new () => Worker;
	export default workerConstructor;
}
