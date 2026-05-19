<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
	import { Trash2, Zap } from 'lucide-svelte';

	interface Props {
		calculating: boolean;
		canCalculate: boolean;
		calculateAria: string;
		clearAria: string;
		calculatingLabel: string;
		calculateLabel: string;
		clearLabel: string;
		onClear: () => void;
	}

	let {
		calculating,
		canCalculate,
		calculateAria,
		clearAria,
		calculatingLabel,
		calculateLabel,
		clearLabel,
		onClear
	}: Props = $props();
</script>

<div class="button-group main-actions">
	<button
		type="submit"
		class="btn btn-primary"
		class:is-calculating={calculating}
		aria-label={calculateAria}
		aria-disabled={!canCalculate || calculating}
		aria-busy={calculating}
		disabled={!canCalculate || calculating}
	>
		<Zap class="Zap" />
		{#if calculating}
			{calculatingLabel}
			<span class="btn-dots" aria-hidden="true">
				<span class="btn-dot"></span>
				<span class="btn-dot"></span>
				<span class="btn-dot"></span>
			</span>
		{:else}
			{calculateLabel}
		{/if}
	</button>

	<button
		type="button"
		onclick={onClear}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onClear()}
		class="btn btn-danger"
		aria-label={clearAria}
	>
		<Trash2 class="Trash2" />
		{clearLabel}
	</button>
</div>

<style>
	.main-actions {
		display: flex;
		flex-direction: row;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		width: 100%;
	}

	.main-actions .btn {
		width: auto;
		min-width: 120px;
		flex: 0 0 auto;
	}

	@media (hover: none) and (pointer: coarse) {
		.main-actions {
			contain: layout style;
		}
	}
</style>
