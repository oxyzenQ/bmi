// Copyright (c) 2025 - 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../animation-config';
import { clampSectionIndex, findSectionScroller, indexFromSectionHash } from '../page-sections';

describe('page section helpers', () => {
	it('clamps active section indexes', () => {
		expect(clampSectionIndex(-1, SECTIONS.length)).toBe(0);
		expect(clampSectionIndex(999, SECTIONS.length)).toBe(SECTIONS.length - 1);
		expect(clampSectionIndex(2, SECTIONS.length)).toBe(2);
	});

	it('parses section hashes case-insensitively', () => {
		expect(indexFromSectionHash('#Gauge', SECTIONS)).toBe(2);
		expect(indexFromSectionHash('#missing', SECTIONS)).toBeNull();
	});

	it('finds the active scroll container by section id', () => {
		const root = document.createElement('div');
		const section = document.createElement('section');
		section.dataset.pagerScroll = 'true';
		section.dataset.sectionId = 'gauge';
		root.append(section);

		expect(findSectionScroller(root, 'gauge')).toBe(section);
		expect(findSectionScroller(root, 'about')).toBeNull();
	});
});
