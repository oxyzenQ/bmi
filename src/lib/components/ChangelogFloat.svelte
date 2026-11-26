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

	// Resolved at build time from CHANGELOG.md: only the section the
	// ledger records for the shipped version - never Unreleased, never
	// the latest-commit churn. No network, works offline.
	const section = changelogLatest.section;
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

		{#if section}
			<div class="changelog-body">
				{#each section.groups as group (group.title)}
					<div class="changelog-group">
						{#if group.title}
							<h3 class="changelog-group-title">{group.title}</h3>
						{/if}
						<ul class="changelog-entries">
							{#each group.entries as entry, i (i)}
								<li class="changelog-entry">
									<span class="changelog-entry-text">{entry.text}</span>
									{#if entry.sha}
										<span class="changelog-entry-sha">
											<GitCommitHorizontal size={12} aria-hidden="true" />
											{entry.sha}
										</span>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
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
	}
	.changelog-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
	}
	.changelog-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--w-70);
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
	}
	.changelog-group-title {
		font-size: var(--text-base);
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
		font-size: var(--text-sm);
		line-height: 1.5;
		color: var(--w-70);
	}
	.changelog-entry-sha {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--w-50);
	}
	.changelog-empty {
		font-size: var(--text-sm);
		color: var(--w-50);
		text-align: center;
		margin: 0;
	}
	.changelog-actions {
		display: flex;
		justify-content: center;
	}
	@media (max-width: 480px) {
		.changelog-title {
			font-size: 1.1rem;
		}
	}
</style>
