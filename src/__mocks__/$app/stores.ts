// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

// Mock for SvelteKit's $app/stores (used by vitest)
import { readable } from 'svelte/store';
export const page = readable({ url: new URL('http://localhost'), params: {}, route: { id: null } });
export const navigating = readable(null);
export const updated = readable(false);
