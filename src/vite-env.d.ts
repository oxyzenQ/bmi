// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/// <reference types="vite/client" />

declare module '*?worker&inline' {
	const workerConstructor: new () => Worker;
	export default workerConstructor;
}
