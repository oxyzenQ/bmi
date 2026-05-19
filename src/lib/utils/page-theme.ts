// Copyright (c) 2025 - 2026 rezky_nightky

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
