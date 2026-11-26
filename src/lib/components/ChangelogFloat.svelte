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

<ModalShell {show} {onclose} panelMinWidth="min(520px, 92vw)" ariaLabel={t('changelog.title')}>
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
                   while only the history body scrolls between them. Capping
                   the float keeps the modal shell's own overflow from
                   engaging, so there is exactly one scrolling region. */
		max-height: min(calc(100dvh - 2rem), 760px);
		min-height: 0;
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
		padding-right: 0.35rem;
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
	}
	@media (max-width: 480px) {
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
