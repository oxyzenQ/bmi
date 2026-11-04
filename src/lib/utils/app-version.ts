// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
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
