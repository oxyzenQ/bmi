<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { AlertCircle, AlertTriangle, ShieldX } from 'lucide-svelte';
	import type { EncryptionErrorSeverity } from '$lib/types/encryption-modal';

	interface Props {
		message: string;
		description?: string;
		severity: EncryptionErrorSeverity;
	}

	let { message, description = '', severity }: Props = $props();
</script>

<div class="encrypt-error encrypt-error--{severity}">
	{#if severity === 'danger'}
		<ShieldX size={16} />
	{:else if severity === 'warning'}
		<AlertTriangle size={16} />
	{:else}
		<AlertCircle size={16} />
	{/if}
	<div class="encrypt-error__content">
		<span class="encrypt-error__msg">{message}</span>
		{#if description}
			<span class="encrypt-error__desc">{description}</span>
		{/if}
	</div>
</div>

<style>
	.encrypt-error {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem;
		margin-bottom: 1.25rem;
		background: var(--error-bg-default);
		border: 1px solid var(--error-border-default);
		border-radius: var(--control-radius);
		color: var(--red-500-solid);
		font-size: var(--text-base);
	}

	.encrypt-error__content {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.encrypt-error__msg {
		font-weight: 600;
	}

	.encrypt-error__desc {
		font-size: 0.78rem;
		font-weight: 400;
		opacity: 0.85;
		line-height: 1.4;
	}

	.encrypt-error--warning {
		background: var(--error-bg-warning);
		border-color: var(--error-border-warning);
		color: var(--amber-gold-60);
	}

	.encrypt-error--danger {
		background: var(--error-bg-danger);
		border-color: var(--error-border-danger);
		color: var(--red-500-solid);
	}

	@media (hover: none) and (pointer: coarse) {
		.encrypt-error {
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
			transition: none !important;
			transform: none !important;
			filter: none !important;
			text-shadow: none !important;
		}
	}
</style>
