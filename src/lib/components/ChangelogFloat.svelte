<!-- SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ) -->
<!-- SPDX-License-Identifier: AGPL-3.0-only OR Commercial -->

<script lang="ts">
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { ScrollText, GitCommitHorizontal } from 'lucide-svelte';
	import { t as _t, localeVersion } from '$lib/i18n';
	import { changelogLatest } from 'virtual:changelog-latest';

	interface Props {
		show: boolean;
		onclose: () => void;
	}

	let { show, onclose }: Props = $props();

	let _rv = $derived($localeVersion);
	function t(key: string): string {
		void _rv;
		return _t(key);
	}

	// Resolved at build time from CHANGELOG.md: every release section
	// the ledger records, newest first - the honest history from the
	// old releases up to the latest bump. No network, works offline.
	const history = changelogLatest.history;
	const versionTag = `v${changelogLatest.version}`;

	// Scroll-edge fades: the history dissolves into the well near its
	// rounded ends instead of being cut off hard mid-line. Each fade
	// only appears when there is more history in that direction, so at
	// rest both edges read calm.
	let bodyEl: HTMLDivElement | null = $state(null);
	let showFadeTop = $state(false);
	let showFadeBottom = $state(false);

	function syncFades(): void {
		const el = bodyEl;
		if (!el) return;
		showFadeTop = el.scrollTop > 1;
		showFadeBottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
	}

	$effect(() => {
		// Re-measure when the modal opens and when the locale flips while
		// it is open - both change the laid-out height of the history.
		void _rv;
		if (show) {
			requestAnimationFrame(syncFades);
		}
	});
</script>

<ModalShell
	{show}
	{onclose}
	panelMinWidth="min(520px, 92vw)"
	panelClass="changelog-panel"
	ariaLabel={t('changelog.title')}
>
	<div class="changelog-float">
		<div class="changelog-header">
			<div class="changelog-icon" aria-hidden="true">
				<ScrollText size={28} strokeWidth={1.5} />
			</div>
			<h2 class="changelog-title">{t('changelog.title')}</h2>
			<p class="changelog-version">{versionTag}</p>
		</div>

		{#if history.length > 0}
			<div class="changelog-body" bind:this={bodyEl} onscroll={syncFades}>
				<div
					class="changelog-fade changelog-fade-top"
					class:visible={showFadeTop}
					aria-hidden="true"
				></div>
				<div class="changelog-stack">
					{#each history as release, i (i)}
						<section class="changelog-release">
							<h3 class="changelog-release-version">v{release.version}</h3>
							{#each release.groups as group, g (g)}
								<div class="changelog-group">
									{#if group.title}
										<h4 class="changelog-group-title">{group.title}</h4>
									{/if}
									<ul class="changelog-entries">
										{#each group.entries as entry, j (j)}
											<li class="changelog-entry">
												<span class="changelog-entry-text">{entry.text}</span>
												{#if entry.sha}
													<span class="changelog-entry-sha">
														<GitCommitHorizontal size={13} aria-hidden="true" />
														{entry.sha}
													</span>
												{/if}
											</li>
										{/each}
									</ul>
								</div>
							{/each}
						</section>
					{/each}
				</div>
				<div
					class="changelog-fade changelog-fade-bottom"
					class:visible={showFadeBottom}
					aria-hidden="true"
				></div>
			</div>
		{:else}
			<p class="changelog-empty">{t('changelog.empty')}</p>
		{/if}

		<div class="changelog-actions">
			<button class="pwa-install-action" onclick={onclose}>
				<span>{t('notify.ok')}</span>
			</button>
		</div>
	</div>
</ModalShell>

<style>
	.changelog-float {
		display: flex;
		flex-direction: column;
		/* One boundary language: the panel frame draws the only lines,
		   the well is a bare surface - no header, action or well edges
		   (nested lines read as a box inside a box). The gap keeps the
		   three zones breathing apart. */
		gap: var(--space-4);
		/* The frame owns the height: header and actions stay pinned
		   while only the history body scrolls between them. The cap
		   subtracts the modal shell's own padding (2rem top + 2rem
		   bottom on desktop) and its 3px frame border on each side,
		   so the float always fits the panel's content box - the
		   shell's overflow never engages and the float is the only
		   scrolling surface. Adaptive: it tracks the viewport
		   through dvh instead of a fixed bulk size. */
		max-height: min(calc(100dvh - 6rem - 6px), 640px);
		min-height: 0;
	}
	/* The float leases the shell's panel: scrolling stays inside the
	   history body, the shell itself must never gain a scrollbar.
	   Night-cafe-10 spaceship monitor: a near-black grey gradient falls
	   down the frame like a dark instrument screen, a faint top inset
	   light reads as the bezel highlight, and a deep shadow grounds the
	   well. The background needs !important because ModalShell strips
	   panel backgrounds on coarse-pointer devices with its own
	   !important; the two-class selector out-weighs it everywhere. */
	:global(.modal-shell-panel.changelog-panel) {
		overflow: hidden;
		background:
			linear-gradient(
				168deg,
				rgba(255, 255, 255, 0.05) 0%,
				rgba(255, 255, 255, 0.012) 38%,
				rgba(255, 255, 255, 0) 62%
			),
			linear-gradient(180deg, #16181d 0%, #0d0e11 52%, #070809 100%) !important;
		border-color: rgba(255, 255, 255, 0.14);
	}
	/* The bezel light: a 1px seam across the panel's top edge. base.css
	   bans box-shadows globally (the flat design law), so the monitor
	   highlight is drawn by a positioned seam element instead. */
	:global(.modal-shell-panel.changelog-panel)::before {
		content: '';
		position: absolute;
		top: 0;
		left: 1rem;
		right: 1rem;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.24), transparent);
		pointer-events: none;
		z-index: 1;
	}
	.changelog-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
		flex-shrink: 0;
	}
	.changelog-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--violet-300-solid);
	}
	.changelog-title {
		font-size: var(--text-2xl);
		font-weight: 600;
		color: var(--w-95);
		margin: 0;
	}
	.changelog-version {
		/* The current release as a quiet pill: the build the reader is
		   on, stated once, not a heading competing with the history. */
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.75rem;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--w-70);
		background: var(--w-10);
		border-radius: 9999px;
		margin: 0;
	}
	.changelog-body {
		/* The one scrolling region: the frame above and the action
		   below never move, the history moves under them. */
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: thin;
		scrollbar-color: var(--w-20) transparent;
		/* The scroll well: a bare rounded surface, the faint fill
		   alone bounds the scrollable area. It draws no border - a
		   line around the well while the panel frame already has
		   one reads as a box inside a box. The surface is the
		   boundary; the frame keeps its single line. */
		background: var(--w-5);
		border-radius: var(--radius-lg);
	}
	.changelog-body::-webkit-scrollbar {
		width: 6px;
	}
	.changelog-body::-webkit-scrollbar-track {
		background: transparent;
	}
	.changelog-body::-webkit-scrollbar-thumb {
		background: var(--w-20);
		border-radius: 9999px;
	}
	.changelog-stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
	}
	/* Scroll-edge fades: pinned to the well's rounded ends, they veil
	   the history as it passes the cut so no line of text is sliced
	   hard mid-glyph. Zero-height sticky anchors - they take no room,
	   ease in with a short opacity fade, and the script only lights
	   them when there is more history in that direction. The gradient
	   starts at the well's own composite fill (--w-5 over the black
	   panel) so the veil and the surface blend into one plane. */
	.changelog-fade {
		position: sticky;
		height: 0;
		z-index: 1;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	.changelog-fade.visible {
		opacity: 1;
	}
	.changelog-fade-top {
		top: 0;
	}
	.changelog-fade-top::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 20px;
		background: linear-gradient(to bottom, color-mix(in srgb, white 5%, black), transparent);
	}
	.changelog-fade-bottom {
		bottom: 0;
	}
	.changelog-fade-bottom::before {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 20px;
		background: linear-gradient(to top, color-mix(in srgb, white 5%, black), transparent);
	}
	.changelog-release + .changelog-release {
		border-top: 1px solid var(--w-10);
		padding-top: var(--space-3);
	}
	.changelog-release-version {
		font-family: var(--font-mono);
		font-size: var(--text-xl);
		font-weight: 600;
		color: var(--violet-300-solid);
		margin: 0 0 0.5rem;
	}
	.changelog-group-title {
		/* Editorial ledger label: small caps with a wide track, the
		   group reads as a label above its entries, not a heading
		   competing with the release version above it. */
		font-size: var(--text-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--w-50);
		margin: 0 0 0.625rem;
	}
	.changelog-group + .changelog-group {
		margin-top: var(--space-3);
	}
	.changelog-entries {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.changelog-entry {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding-left: 1rem;
		border-left: 2px solid var(--w-10);
	}
	.changelog-entry-text {
		font-size: var(--text-lg);
		line-height: 1.55;
		color: var(--w-95);
	}
	.changelog-entry-sha {
		/* The sha as a quiet pill: the commit ref reads as metadata,
		   not as a second line of the entry text. */
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		gap: 0.3rem;
		padding: 0.15rem 0.5rem;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--w-50);
		background: var(--w-10);
		border-radius: 9999px;
	}
	.changelog-empty {
		font-size: var(--text-lg);
		color: var(--w-50);
		text-align: center;
		margin: 0;
	}
	.changelog-actions {
		display: flex;
		justify-content: center;
		flex-shrink: 0;
	}
	@media (max-width: 480px) {
		.changelog-float {
			/* Mobile: the shell panel pads 1.5rem per side and frames
			   itself with a 3px border, so the float caps at exactly
			   the panel's content box. */
			max-height: calc(100dvh - 5rem - 6px);
		}
		.changelog-title {
			font-size: 1.1rem;
		}
		.changelog-release-version {
			font-size: var(--text-lg);
		}
		.changelog-entry-text {
			font-size: var(--text-base);
		}
	}
</style>
