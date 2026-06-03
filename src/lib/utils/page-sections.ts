// Copyright (c) 2025 - 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
import type { SECTIONS } from './animation-config';

export type PageSection = (typeof SECTIONS)[number];

export function clampSectionIndex(next: number, sectionCount: number): number {
	return Math.min(sectionCount - 1, Math.max(0, next));
}

export function indexFromSectionHash(
	hash: string,
	sections: readonly PageSection[]
): number | null {
	const clean = hash.replace(/^#/, '').trim().toLowerCase();
	const idx = sections.findIndex((section) => section.id === clean);
	return idx >= 0 ? idx : null;
}

export function findSectionScroller(
	root: ParentNode | null | undefined,
	sectionId: string
): HTMLElement | null {
	return (
		root?.querySelector<HTMLElement>(
			`[data-pager-scroll="true"][data-section-id="${sectionId}"]`
		) ?? null
	);
}

export function replaceSectionHash(id: string): void {
	location.replace(`#${id}`);
}
