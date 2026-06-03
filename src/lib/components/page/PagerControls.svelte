<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { ChevronLeft, ChevronRight, ChevronUp } from 'lucide-svelte';

	interface Props {
		activeIndex: number;
		sectionCount: number;
		showScrollTopFab: boolean;
		onPrev: () => void;
		onNext: () => void;
		onScrollTop: () => void;
	}

	let { activeIndex, sectionCount, showScrollTopFab, onPrev, onNext, onScrollTop }: Props =
		$props();
</script>

<div class="pager-controls-shell">
	<div class="pager-controls" aria-label="Section navigation">
		{#if activeIndex > 0}
			<button
				type="button"
				class="pager-btn-futuristic pager-btn-prev"
				aria-label="Previous section"
				onclick={onPrev}
			>
				<ChevronLeft aria-hidden="true" size={44} />
			</button>
		{:else}
			<div class="pager-btn-spacer" aria-hidden="true"></div>
		{/if}

		<button
			type="button"
			class="pager-btn-futuristic pager-btn-scroll-top"
			class:fab-visible={showScrollTopFab}
			aria-label="Scroll to top"
			onclick={onScrollTop}
		>
			<ChevronUp aria-hidden="true" size={36} />
		</button>

		{#if activeIndex < sectionCount - 1}
			<button
				type="button"
				class="pager-btn-futuristic pager-btn-next"
				aria-label="Next section"
				onclick={onNext}
			>
				<ChevronRight aria-hidden="true" size={44} />
			</button>
		{:else}
			<div class="pager-arrow-spacer" aria-hidden="true"></div>
		{/if}
	</div>
</div>
