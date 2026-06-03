<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import type { EncryptionImportMeta } from '$lib/types/encryption-modal';

	interface Props {
		meta: EncryptionImportMeta;
		statusLabel: string;
		encryptedLabel: string;
		unencryptedLabel: string;
		dateLabel: string;
		recordsLabel: string;
		versionLabel: string;
	}

	let {
		meta,
		statusLabel,
		encryptedLabel,
		unencryptedLabel,
		dateLabel,
		recordsLabel,
		versionLabel
	}: Props = $props();
</script>

<div class="import-meta">
	{#if meta.encrypted}
		<div class="meta-row">
			<span class="meta-key">{statusLabel}</span>
			<span class="meta-val meta-encrypted">{encryptedLabel}</span>
		</div>
	{:else}
		<div class="meta-row">
			<span class="meta-key">{statusLabel}</span>
			<span class="meta-val">{unencryptedLabel}</span>
		</div>
	{/if}
	{#if meta.exportedAt}
		<div class="meta-row">
			<span class="meta-key">{dateLabel}</span>
			<span class="meta-val">{meta.exportedAt}</span>
		</div>
	{/if}
	{#if meta.recordCount != null}
		<div class="meta-row">
			<span class="meta-key">{recordsLabel}</span>
			<span class="meta-val">{meta.recordCount}</span>
		</div>
	{/if}
	{#if meta.version != null}
		<div class="meta-row">
			<span class="meta-key">{versionLabel}</span>
			<span class="meta-val">v{meta.version}</span>
		</div>
	{/if}
</div>

<style>
	.import-meta {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		background: var(--w-8);
		border: 1px solid var(--w-15);
		border-radius: var(--radius-lg);
	}

	.meta-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: var(--text-base);
	}

	.meta-key {
		color: var(--w-50);
		font-weight: 500;
	}

	.meta-val {
		color: var(--w-80);
		font-weight: 600;
	}

	.meta-encrypted {
		color: var(--cosmic-purple);
	}

	@media (hover: none) and (pointer: coarse) {
		.import-meta {
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
			transition: none !important;
			transform: none !important;
			filter: none !important;
			text-shadow: none !important;
		}
	}
</style>
