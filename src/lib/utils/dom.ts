// Copyright (c) 2025 - 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
/** Check if an event target is an editable form element */
export function isEditableTarget(el: EventTarget | null): boolean {
	const t = el as HTMLElement | null;
	if (!t) return false;
	const tag = t.tagName;
	return (
		tag === 'INPUT' ||
		tag === 'TEXTAREA' ||
		tag === 'SELECT' ||
		t.isContentEditable ||
		Boolean(t.closest('input, textarea, select, [contenteditable="true"]'))
	);
}
