<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import type { EncryptionMode } from '$lib/types/encryption-modal';

	interface Props {
		mode: EncryptionMode;
		loading: boolean;
		cancelLabel: string;
		exportLabel: string;
		unlockImportLabel: string;
		processingLabel: string;
		onCancel: () => void;
	}

	let {
		mode,
		loading,
		cancelLabel,
		exportLabel,
		unlockImportLabel,
		processingLabel,
		onCancel
	}: Props = $props();
</script>

<div class="encrypt-actions">
	<button type="button" class="encrypt-btn btn-cancel" onclick={onCancel} disabled={loading}>
		{cancelLabel}
	</button>
	<button type="submit" class="encrypt-btn btn-confirm" disabled={loading}>
		{#if loading}
			<span class="btn-spinner"></span>
			{processingLabel}
		{:else}
			{mode === 'export' ? exportLabel : unlockImportLabel}
		{/if}
	</button>
</div>

<style>
	.encrypt-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		margin-top: var(--space-3);
	}

	.encrypt-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0 1.5rem;
		height: var(--btn-height);
		font-size: 0.95rem;
		font-weight: 600;
		border: 1px solid rgba(130, 130, 130, 0.3);
		border-radius: var(--btn-radius);
		cursor: pointer;
		transition:
			transform var(--dur-micro) ease,
			background var(--dur-micro) ease,
			border-color var(--dur-micro) ease;
		min-width: 100px;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}

	.btn-cancel {
		background: var(--btn-bg);
		color: var(--stellar-white);
		border: 1px solid rgba(130, 130, 130, 0.3);
	}

	.btn-cancel:hover {
		background: var(--btn-bg-hover);
		color: var(--stellar-white);
		transform: translateY(-1px);
		border-color: rgba(130, 130, 130, 0.45);
	}

	.btn-confirm {
		background: var(--bg-by-rezky);
		color: var(--stellar-white);
		border: 1px solid rgba(139, 92, 246, 0.45);
	}

	.btn-confirm:hover {
		background: var(--bg-last-by-rezky);
		border-color: rgba(139, 92, 246, 0.6);
		transform: translateY(-1px);
	}

	.btn-confirm:disabled,
	.btn-cancel:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: var(--stellar-white);
		border-radius: 50%;
		animation: spin var(--dur-spin-fast) linear infinite;
		margin-right: 6px;
	}

	@media (max-width: 480px) {
		.encrypt-actions {
			flex-direction: column;
		}

		.encrypt-btn {
			width: 100%;
		}
	}

	@media (hover: none) and (pointer: coarse) {
		.encrypt-btn {
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
			transition: none !important;
			transform: none !important;
			filter: none !important;
			text-shadow: none !important;
			touch-action: manipulation;
		}

		.encrypt-btn:active {
			transform: none !important;
		}
	}
</style>
