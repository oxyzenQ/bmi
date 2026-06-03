<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	/* eslint-disable no-useless-assignment -- $bindable props are written for parent updates */
	import { ArrowLeftRight } from 'lucide-svelte';

	interface Props {
		unitSystem?: 'metric' | 'imperial';
		height?: string;
		weight?: string;
		ariaLabel: string;
		metricLabel: string;
		imperialLabel: string;
	}

	let {
		unitSystem = $bindable<'metric' | 'imperial'>('metric'),
		height = $bindable(''),
		weight = $bindable(''),
		ariaLabel,
		metricLabel,
		imperialLabel
	}: Props = $props();

	function selectUnit(nextUnitSystem: 'metric' | 'imperial') {
		unitSystem = nextUnitSystem;
		height = '';
		weight = '';
	}
</script>

<div class="unit-toggle" role="radiogroup" aria-label={ariaLabel}>
	<button
		type="button"
		class="unit-toggle-segment"
		class:active={unitSystem === 'metric'}
		role="radio"
		aria-checked={unitSystem === 'metric'}
		onclick={() => selectUnit('metric')}
	>
		<ArrowLeftRight size={14} aria-hidden="true" />
		{metricLabel}
	</button>
	<button
		type="button"
		class="unit-toggle-segment"
		class:active={unitSystem === 'imperial'}
		role="radio"
		aria-checked={unitSystem === 'imperial'}
		onclick={() => selectUnit('imperial')}
	>
		{imperialLabel}
	</button>
</div>

<style>
	.unit-toggle {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 2px;
		border: var(--btn-border);
		border-radius: var(--control-radius);
		padding: 2px;
		margin: 0 auto 1rem;
		width: fit-content;
	}

	.unit-toggle-segment {
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		border: none;
		border-radius: var(--control-radius);
		background: transparent;
		color: var(--w-50);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		transition:
			background var(--dur-interactive) ease,
			color var(--dur-interactive) ease;
		white-space: nowrap;
	}

	.unit-toggle-segment:hover {
		color: var(--w-70);
	}

	.unit-toggle-segment.active {
		background: var(--btn-bg-hover);
		color: var(--stellar-white);
	}

	@media (hover: none) and (pointer: coarse) {
		.unit-toggle {
			contain: layout style;
		}

		.unit-toggle-segment {
			animation: none !important;
			transition: none !important;
			transform: none !important;
			filter: none !important;
			text-shadow: none !important;
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
			touch-action: manipulation;
		}

		.unit-toggle-segment:hover {
			transform: none !important;
		}
	}
</style>
