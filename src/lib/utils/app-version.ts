// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

import pkg from '../../../package.json';

export function getAppVersionRaw(): string {
	return typeof pkg.version === 'string' ? pkg.version.trim() : '';
}

export function getAppVersionDisplay(): string {
	return getAppVersionRaw() || '0.0.0';
}

export function getStellarVersionLabel(): string {
	return `Stellar v${getAppVersionDisplay()}`;
}
