<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { AlertCircle, ShieldCheck } from 'lucide-svelte';

	interface Props {
		badgeLabel: string;
		warningLabel: string;
		warningHighlight?: string;
	}

	let { badgeLabel, warningLabel, warningHighlight = '' }: Props = $props();
</script>

<div class="encrypt-meta">
	<div class="bmi-encryption-badge">
		<span class="bmi-encryption-badge__icon"><ShieldCheck size={14} /></span>
		<span class="bmi-encryption-badge__label">{badgeLabel}</span>
		<span class="bmi-encryption-badge__algo">AES-256-GCM + Argon2id</span>
	</div>
	<div class="bmi-strong-warning">
		<span class="bmi-strong-warning__icon"><AlertCircle size={16} /></span>
		<span class="bmi-strong-warning__text"
			>{warningLabel}{#if warningHighlight}<strong> {warningHighlight}</strong>{/if}</span
		>
	</div>
</div>

<style>
	.encrypt-meta {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}

	@media (hover: none) and (pointer: coarse) {
		:global(.bmi-encryption-badge),
		:global(.bmi-strong-warning) {
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
			transition: none !important;
			transform: none !important;
			filter: none !important;
			text-shadow: none !important;
		}
	}
</style>
