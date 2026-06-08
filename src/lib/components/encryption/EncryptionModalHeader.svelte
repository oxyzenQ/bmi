<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { Lock, Unlock } from 'lucide-svelte';
	import type { EncryptionMode } from '$lib/types/encryption-modal';

	interface Props {
		mode: EncryptionMode;
		title: string;
		iconColor: string;
	}

	let { mode, title, iconColor }: Props = $props();
</script>

<div class="encrypt-header">
	<div class="encrypt-icon" style="color: {iconColor}">
		{#if mode === 'export'}
			<Lock size={32} strokeWidth={1.5} />
		{:else}
			<Unlock size={32} strokeWidth={1.5} />
		{/if}
	</div>
	<h2 class="encrypt-title">{title}</h2>
</div>

<style>
	.encrypt-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: var(--space-3);
	}

	.encrypt-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.encrypt-title {
		font-size: var(--text-2xl);
		font-weight: 600;
		color: var(--w-95);
		margin: 0;
	}

	@media (max-width: 480px) {
		.encrypt-title {
			font-size: 1.1rem;
		}
	}
</style>
