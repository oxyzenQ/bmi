// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * The application version, injected as the __APP_VERSION__ build-time
 * constant. A JSON import of package.json would inline the whole
 * manifest - author, signature field, contact URLs - into the client
 * bundle, so the version is the only manifest value that leaves the
 * build config (night-netrunner-Z1).
 */
export function getAppVersionRaw(): string {
	return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__.trim() : '';
}

export function getAppVersionDisplay(): string {
	return getAppVersionRaw() || '0.0.0';
}

export function getStellarVersionLabel(): string {
	return `Stellar v${getAppVersionDisplay()}`;
}
