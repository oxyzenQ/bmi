<!-- SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ) -->
<!-- SPDX-License-Identifier: AGPL-3.0-only OR Commercial -->

<script lang="ts">
	/**
	 * The DNA helix face (night-ux-orion-2) - BMI Stellar's one loading
	 * indicator, the masterclass face every large-data load shows.
	 *
	 * Thin glue on purpose: the frames, the lazy threshold, and the
	 * deterministic slot clock live in the pure core
	 * ($lib/utils/dna-helix) so the pins hold the exact bytes; this
	 * half only drives the poll loop and renders one text node - one
	 * dirty node per frame, no DOM churn, the same law the reference
	 * lane keeps on stderr. The poll slice mirrors the reference lane
	 * (25 ms, so a finish that lands mid-sleep never lags a verdict),
	 * while the rendered slot stays a pure function of elapsed time: a
	 * poll that lands late repeats a frame instead of skipping it, and
	 * an operation inside the lazy threshold draws nothing at all.
	 *
	 * Functional-indicator law (src/styles/animation.css): this face
	 * always animates, even under prefers-reduced-motion - a frozen
	 * "working" state is the exact hang the lane exists to prevent.
	 * The law holds by construction here: the face is slot-driven
	 * text, not CSS animation, so no reduced-motion rule can freeze
	 * it. The frame bytes are hidden from assistive tech (braille dots
	 * are not prose); the label carries the narration instead.
	 */
	import { onMount } from 'svelte';
	import { helixFrame, helixSlot } from '$lib/utils/dna-helix';

	/** The poll slice in ms: the slot clock's wake cadence. */
	const POLL_MS = 25;

	interface Props {
		/** Glyph size in px - the two braille cells scale with it. */
		size?: number;
		/** The narrated label for assistive tech; empty hides it. */
		label?: string;
	}

	let { size = 48, label = '' }: Props = $props();

	let frame = $state('');

	onMount(() => {
		const started = performance.now();
		let drawnSlot: number | null = null;

		const tick = () => {
			const slot = helixSlot(performance.now() - started);
			if (slot !== null && slot !== drawnSlot) {
				frame = helixFrame(slot);
				drawnSlot = slot;
			}
		};

		tick();
		const timer = setInterval(tick, POLL_MS);
		return () => clearInterval(timer);
	});
</script>

<span class="dna-helix" style="font-size: {size}px" role="status" aria-busy="true">
	<span class="dna-helix__frame" aria-hidden="true">{frame}</span>
	{#if label}
		<span class="sr-only">{label}</span>
	{/if}
</span>

<style>
	.dna-helix {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		color: var(--w-50);
		font-family: var(--font-mono);
		font-variant-ligatures: none;
		line-height: 1;
		letter-spacing: 0.2em;
		filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.3));
		user-select: none;
		pointer-events: none;
	}

	.dna-helix__frame {
		white-space: pre;
	}
</style>
