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
			<div class="changelog-body">
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
		gap: var(--space-3);
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
           history body, the shell itself must never gain a scrollbar. */
	:global(.modal-shell-panel.changelog-panel) {
		overflow: hidden;
	}
	.changelog-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
		flex-shrink: 0;
		/* Frame divider: the line where the pinned header ends and
                   the scrolling history begins. */
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--w-20);
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
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--w-50);
		margin: 0;
	}
	.changelog-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		/* The one scrolling region: the frame above and the action
                   below never move, the history moves under them. */
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: thin;
		/* The scroll well: the history curves into rounded left
                   and right ends instead of ending sharp against the
                   panel wall, and the faint fill reads the scrollable
                   area as one bounded surface. */
		padding: var(--space-3);
		background: var(--w-2);
		border: 1px solid var(--w-10);
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
		border-radius: 3px;
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
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--w-70);
		margin: 0 0 0.5rem;
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
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--w-50);
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
		/* Frame divider: mirrors the header line so the scrollable
                   middle is visually bounded on both edges. */
		padding-top: var(--space-3);
		border-top: 1px solid var(--w-20);
	}
	@media (max-width: 480px) {
		.changelog-float {
			/* Mobile: the shell panel pads 1.5rem per side and
                           frames itself with a 3px border, so the float caps
                           at exactly the panel's content box. */
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
