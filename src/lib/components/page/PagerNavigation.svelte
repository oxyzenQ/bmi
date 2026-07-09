<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { Wallpaper } from 'lucide-svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import { SECTIONS } from '$lib/utils/animation-config';
	import type { ThemeKey } from '$lib/utils/page-theme';

	interface Props {
		sections: typeof SECTIONS;
		activeIndex: number;
		currentTheme: ThemeKey;
		themeLabel: string;
		pagerNavCentered?: boolean;
		pagerNavEl?: HTMLElement | null;
		pagerNavShellEl?: HTMLElement | null;
		localeVersion: number;
		t: (key: string) => string;
		onSelect: (index: number) => void;
		onThemeToggle: () => void;
	}

	let {
		sections,
		activeIndex,
		currentTheme,
		themeLabel,
		pagerNavCentered = $bindable(false),
		pagerNavEl = $bindable<HTMLElement | null>(null),
		pagerNavShellEl = $bindable<HTMLElement | null>(null),
		localeVersion,
		t,
		onSelect,
		onThemeToggle
	}: Props = $props();
</script>

<div class="pager-nav-shell" bind:this={pagerNavShellEl}>
	<nav
		bind:this={pagerNavEl}
		class="pager-nav"
		class:centered={pagerNavCentered}
		aria-label={t('nav.sections_aria')}
	>
		{#key localeVersion}
			{#each sections as section, idx (section.id)}
				<button
					type="button"
					class="btn btn-ghost pager-tab"
					class:active={idx === activeIndex}
					aria-current={idx === activeIndex ? 'page' : undefined}
					onclick={() => onSelect(idx)}
				>
					{t(section.labelKey)}
				</button>
			{/each}

			<button
				type="button"
				class="btn btn-ghost pager-tab pager-theme"
				aria-label={t('nav.theme_aria')}
				aria-pressed={currentTheme !== 'blackhole'}
				onclick={onThemeToggle}
			>
				<Wallpaper class="render-wallpaper" aria-hidden="true" />
				{t('nav.theme')}
				<span
					class:theme-blackhole={currentTheme === 'blackhole'}
					class:theme-spaceship={currentTheme === 'spaceship'}
					class:theme-space={currentTheme === 'space'}
				>
					{themeLabel}
				</span>
			</button>
		{/key}

		<LanguageSwitcher />
	</nav>
</div>
