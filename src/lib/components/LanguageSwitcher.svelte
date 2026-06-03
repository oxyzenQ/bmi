<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Languages } from 'lucide-svelte';
	import { browser } from '$app/environment';
	import { t as _t, locales, setLocale, localeVersion, locale } from '$lib/i18n';
	import type { Locale, TParams } from '$lib/i18n';
	import { portal } from '$lib/actions/portal';

	// Reactive dependency on locale version so t() re-evaluates on locale change
	let _rv = $derived($localeVersion);

	// Shadow t() — reading _rv creates a reactive dependency
	// so every template {t('key')} call re-runs when locale changes
	function t(key: string, params?: TParams): string {
		void _rv;
		return _t(key, params);
	}

	let open = $state(false);
	let visible = $state(false);
	let mounted = $state(false);
	let panelEl: HTMLDivElement | undefined = $state(undefined);

	function handleToggle() {
		open = !open;
	}

	async function handleSelect(code: Locale) {
		await setLocale(code);
		closePanel();
	}

	let closePanelTimer: ReturnType<typeof setTimeout> | null = null;

	function closePanel() {
		visible = false;
		if (closePanelTimer) clearTimeout(closePanelTimer);
		closePanelTimer = setTimeout(() => {
			open = false;
		}, 200);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open || e.defaultPrevented) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			closePanel();
			return;
		}
		// Tab focus trap — prevents focus from escaping the dialog
		if (e.key === 'Tab' && panelEl) {
			const focusable = Array.from(
				panelEl.querySelectorAll<HTMLElement>(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
				)
			).filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	onMount(() => {
		mounted = true;
	});

	onDestroy(() => {
		// Clean up the closePanel timeout to prevent state updates after unmount
		if (closePanelTimer) clearTimeout(closePanelTimer);
	});

	// Sync visibility with open state (with animation delay)
	$effect(() => {
		if (open && mounted) {
			const tm = setTimeout(() => {
				visible = true;
			}, 30);
			return () => clearTimeout(tm);
		} else {
			visible = false;
		}
	});

	// Reactive current locale label
	let currentLabel = $derived(locales.find((l) => l.code === $locale)?.shortLabel ?? 'EN');
</script>

<svelte:window onkeydown={handleKeydown} />

<button
	type="button"
	class="btn btn-ghost pager-tab"
	aria-label={t('lang.aria')}
	aria-expanded={open}
	onclick={handleToggle}
>
	<Languages size={14} aria-hidden="true" />
	{currentLabel}
</button>

{#if open}
	<div use:portal class="lang-backdrop" class:visible role="presentation">
		<div
			bind:this={panelEl}
			class="lang-panel"
			role="dialog"
			aria-label={t('lang.select')}
			tabindex="-1"
		>
			<button type="button" class="lang-close" onclick={closePanel} aria-label={t('lang.close')}>
				<span class="close-icon-text" aria-hidden="true">×</span>
			</button>

			<div class="lang-panel-icon">
				<Languages size={32} aria-hidden="true" />
			</div>

			<h3 class="lang-panel-title">{t('lang.title')}</h3>

			<div class="lang-options">
				{#each locales as loc (loc.code)}
					<button
						type="button"
						class="lang-option"
						class:active={$locale === loc.code}
						role="menuitem"
						onclick={() => handleSelect(loc.code)}
					>
						<span class="lang-flag">{loc.flag}</span>
						<span class="lang-name">{loc.label}</span>
						<span class="lang-code">{loc.shortLabel}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	/* All portaled panel styles moved to src/styles/lang-switcher.css (global)
     to guarantee they apply to elements portaled to document.body. */
</style>
