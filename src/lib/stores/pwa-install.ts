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
  return window.matchMedia('(display-mode: standalone)').matches || standaloneNavigator.standalone === true;
}

export function hydratePwaInstallState(): void {
  if (!browser) return;
  pwaInstallState.update((state) => ({
    ...state,
    checked: true,
    isInstalled: isStandaloneDisplay()
  }));
}

export function registerPwaInstallPrompt(event: Event): void {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  pwaInstallState.update((state) => ({
    ...state,
    checked: true,
    canInstall: true,
    isInstalled: isStandaloneDisplay()
  }));
}

export async function promptPwaInstall(): Promise<void> {
  if (!deferredPrompt) return;

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === 'accepted') {
    pwaInstallState.set({
      checked: true,
      canInstall: false,
      isInstalled: true
    });
  }

  deferredPrompt = null;
}
