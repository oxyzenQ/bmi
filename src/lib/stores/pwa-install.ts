// Copyright (c) 2025 - 2026 rezky_nightky
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallState {
	checked: boolean;
	canInstall: boolean;
	isInstalled: boolean;
}

const initialState: PwaInstallState = {
	checked: false,
	canInstall: false,
	isInstalled: false
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export const pwaInstallState = writable<PwaInstallState>(initialState);

function isStandaloneDisplay(): boolean {
	if (!browser) return false;
	const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		standaloneNavigator.standalone === true
	);
}

export function hydratePwaInstallState(): void {
	if (!browser) return;
	pwaInstallState.update((state) => ({
		...state,
		checked: true,
		isInstalled: isStandaloneDisplay()
	}));
}

export function markPwaInstalled(): void {
	pwaInstallState.set({
		checked: true,
		canInstall: false,
		isInstalled: true
	});
}

export function registerPwaInstallPrompt(event: Event): void {
	deferredPrompt = event as BeforeInstallPromptEvent;
	pwaInstallState.update((state) => ({
		...state,
		checked: true,
		canInstall: true,
		isInstalled: isStandaloneDisplay()
	}));
}

export async function promptPwaInstall(): Promise<boolean> {
	if (!deferredPrompt) return false;

	const promptEvent = deferredPrompt;
	deferredPrompt = null;

	try {
		await promptEvent.prompt();
		const { outcome } = await promptEvent.userChoice;

		if (outcome === 'accepted') {
			markPwaInstalled();
		} else {
			pwaInstallState.update((state) => ({
				...state,
				checked: true,
				canInstall: false,
				isInstalled: isStandaloneDisplay()
			}));
		}

		return true;
	} catch {
		pwaInstallState.update((state) => ({
			...state,
			checked: true,
			canInstall: false,
			isInstalled: isStandaloneDisplay()
		}));
		return false;
	}
}
