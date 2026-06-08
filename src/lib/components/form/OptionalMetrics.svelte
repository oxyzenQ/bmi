<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { Flame, PersonStanding } from 'lucide-svelte';
	import type { Activity, ActivityLevel, Gender } from '$lib/types/bmi-form';

	interface Props {
		gender?: Gender;
		activity?: Activity;
		activityLevels: ActivityLevel[];
		genderLabel: string;
		activityLabel: string;
		optionalLabel: string;
		genderAria: string;
		activityAria: string;
		maleLabel: string;
		femaleLabel: string;
	}

	let {
		gender = $bindable<Gender>(''),
		activity = $bindable<Activity>(''),
		activityLevels,
		genderLabel,
		activityLabel,
		optionalLabel,
		genderAria,
		activityAria,
		maleLabel,
		femaleLabel
	}: Props = $props();
</script>

<div class="input-group">
	<label class="input-label">
		<PersonStanding size={16} />
		{genderLabel} <span class="optional-tag">{optionalLabel}</span>
	</label>
	<div class="segmented-control" role="radiogroup" aria-label={genderAria}>
		<button
			type="button"
			class="seg-btn"
			class:seg-active={gender === 'male'}
			role="radio"
			aria-checked={gender === 'male'}
			onclick={() => {
				gender = gender === 'male' ? '' : 'male';
			}}
		>
			{maleLabel}
		</button>
		<button
			type="button"
			class="seg-btn"
			class:seg-active={gender === 'female'}
			role="radio"
			aria-checked={gender === 'female'}
			onclick={() => {
				gender = gender === 'female' ? '' : 'female';
			}}
		>
			{femaleLabel}
		</button>
	</div>
</div>

<div class="input-group">
	<label class="input-label">
		<Flame size={16} />
		{activityLabel} <span class="optional-tag">{optionalLabel}</span>
	</label>
	<div class="activity-grid" role="radiogroup" aria-label={activityAria}>
		{#each activityLevels as lvl (lvl.value)}
			<button
				type="button"
				class="act-btn"
				class:act-active={activity === lvl.value}
				role="radio"
				aria-checked={activity === lvl.value}
				onclick={() => {
					activity = activity === lvl.value ? '' : lvl.value;
				}}
			>
				<span class="act-label">{lvl.label}</span>
				<span class="act-factor">{lvl.factor}x</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.segmented-control {
		display: flex;
		justify-content: center;
		gap: 2px;
		border: var(--btn-border);
		border-radius: var(--control-radius);
		padding: 2px;
		width: fit-content;
		max-width: 320px;
	}

	.seg-btn {
		flex: 1;
		font-size: 0.8rem;
		padding: 0.35rem 0.8rem;
		border: none;
		border-radius: var(--control-radius);
		background: transparent;
		color: var(--w-50);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		transition:
			background var(--dur-interactive) ease,
			color var(--dur-interactive) ease;
		white-space: nowrap;
		min-width: 80px;
	}

	.seg-btn:hover {
		color: var(--w-70);
	}

	.seg-btn.seg-active {
		background: var(--btn-bg-hover);
		color: var(--stellar-white);
	}

	.optional-tag {
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		opacity: 0.7;
	}

	.activity-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 6.5rem), 1fr));
		gap: 0.35rem;
		width: 100%;
		max-width: 320px;
		border: var(--btn-border);
		border-radius: var(--radius-xl);
		padding: 3px;
		background: var(--sd-80);
	}

	.act-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
		padding: 0.4rem 0.25rem;
		border: none;
		border-radius: var(--control-radius);
		background: transparent;
		color: var(--w-50);
		cursor: pointer;
		transition:
			background var(--dur-interactive) ease,
			color var(--dur-interactive) ease;
		min-width: 0;
		white-space: normal;
	}

	.act-btn:hover {
		color: var(--w-70);
		background: var(--w-4);
	}

	.act-btn.act-active {
		background: var(--btn-bg-hover);
		color: var(--stellar-white);
	}

	.act-label {
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		line-height: 1.15;
		text-align: center;
		overflow-wrap: anywhere;
	}

	.act-factor {
		font-size: 0.55rem;
		font-family: var(--font-mono-short);
		opacity: 0.6;
	}

	.act-btn.act-active .act-factor {
		opacity: 0.8;
	}

	@media (hover: none) and (pointer: coarse) {
		.segmented-control,
		.activity-grid {
			contain: layout style;
		}

		.seg-btn,
		.act-btn {
			animation: none !important;
			transition: none !important;
			transform: none !important;
			filter: none !important;
			text-shadow: none !important;
			-webkit-backdrop-filter: none !important;
			backdrop-filter: none !important;
			touch-action: manipulation;
		}

		.seg-btn:hover,
		.act-btn:hover {
			transform: none !important;
		}
	}
</style>
