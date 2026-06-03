<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { Lightbulb } from 'lucide-svelte';

	interface Props {
		label: string;
		hint: string;
	}

	let { label, hint }: Props = $props();
</script>

<div class="hint-display">
	<Lightbulb size={14} />
	<span class="hint-display__label">{label}:</span>
	<span class="hint-display__text">{hint}</span>
</div>

<style>
	.hint-display {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.6rem 0.85rem;
		margin-bottom: 0.75rem;
		background: rgba(251, 191, 36, 0.08);
		border: 1px solid rgba(251, 191, 36, 0.2);
		border-radius: var(--control-radius);
		font-size: var(--text-base);
		color: var(--amber-gold-60);
	}

	.hint-display__label {
		font-weight: 600;
		white-space: nowrap;
	}

	.hint-display__text {
		color: var(--w-80);
		font-style: italic;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (hover: none) and (pointer: coarse) {
		.hint-display {
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
			transition: none !important;
			transform: none !important;
			filter: none !important;
			text-shadow: none !important;
		}
	}
</style>
