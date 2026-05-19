// Copyright (c) 2025 - 2026 rezky_nightky
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { promptPwaInstall, pwaInstallState, registerPwaInstallPrompt } from '../pwa-install';

function installMatchMedia(matches = false) {
	Object.defineProperty(window, 'matchMedia', {
		value: vi.fn().mockReturnValue({ matches }),
		configurable: true
	});
}

function createInstallEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
	const event = new Event('beforeinstallprompt') as Event & {
		prompt: ReturnType<typeof vi.fn>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	};
	event.prompt = vi.fn().mockResolvedValue(undefined);
	event.userChoice = Promise.resolve({ outcome });
	vi.spyOn(event, 'preventDefault');
	return event;
}

describe('pwa install prompt store', () => {
	beforeEach(() => {
		installMatchMedia(false);
		pwaInstallState.set({ checked: false, canInstall: false, isInstalled: false });
	});

	it('does not suppress the native install banner globally', () => {
		const event = createInstallEvent();

		registerPwaInstallPrompt(event);

		expect(event.preventDefault).not.toHaveBeenCalled();
		expect(get(pwaInstallState).canInstall).toBe(true);
	});

	it('calls prompt from the custom install action when an event is available', async () => {
		const event = createInstallEvent('accepted');
		registerPwaInstallPrompt(event);

		await expect(promptPwaInstall()).resolves.toBe(true);

		expect(event.prompt).toHaveBeenCalledTimes(1);
		expect(get(pwaInstallState)).toMatchObject({ canInstall: false, isInstalled: true });
	});

	it('clears custom install availability after dismissal', async () => {
		registerPwaInstallPrompt(createInstallEvent('dismissed'));

		await expect(promptPwaInstall()).resolves.toBe(true);

		expect(get(pwaInstallState)).toMatchObject({ canInstall: false, isInstalled: false });
	});

	it('clears availability when the native prompt flow is dismissed', async () => {
		registerPwaInstallPrompt(createInstallEvent('dismissed'));

		await Promise.resolve();

		expect(get(pwaInstallState)).toMatchObject({ canInstall: false, isInstalled: false });
	});
});
