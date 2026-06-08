// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only

export type ThemeKey = 'blackhole' | 'spaceship' | 'space';

export const THEMES: ThemeKey[] = ['blackhole', 'spaceship', 'space'];

export const THEME_URLS: Record<ThemeKey, string> = {
	blackhole: 'url("/images/blackhole.webp")',
	spaceship: 'url("/images/spaceshipx.webp")',
	space: 'url("/images/oxyzen-zenlysium.webp")'
};

export function nextTheme(currentTheme: ThemeKey): ThemeKey {
	return THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];
}
