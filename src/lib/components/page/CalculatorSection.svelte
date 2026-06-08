<!-- Copyright (C) 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import type { Activity, Gender, ImportNotifyResult } from '$lib/types/bmi-form';

	type BmiFormComponentType = typeof import('$lib/components/BmiForm.svelte').default;
	type BmiResultsComponentType = typeof import('$lib/components/BmiResults.svelte').default;

	interface Props {
		BmiFormComponent: BmiFormComponentType | null;
		BmiResultsComponent: BmiResultsComponentType | null;
		age?: string;
		height?: string;
		weight?: string;
		gender?: Gender;
		activity?: Activity;
		unitSystem?: 'metric' | 'imperial';
		calculating: boolean;
		resultsRunId: number;
		bmiValue: number | null;
		category: string | null;
		contentReducedMotion: boolean;
		onClear: () => void;
		onCalculate: () => void;
		onNotify: (result: ImportNotifyResult) => void;
	}

	let {
		BmiFormComponent,
		BmiResultsComponent,
		age = $bindable(''),
		height = $bindable(''),
		weight = $bindable(''),
		gender = $bindable<Gender>(''),
		activity = $bindable<Activity>(''),
		unitSystem = $bindable<'metric' | 'imperial'>('metric'),
		calculating,
		resultsRunId,
		bmiValue,
		category,
		contentReducedMotion,
		onClear,
		onCalculate,
		onNotify
	}: Props = $props();
</script>

<div class="main-container">
	<section class="bmi-section">
		<div class="bmi-grid">
			<div class="form-card">
				{#if BmiFormComponent}
					<BmiFormComponent
						bind:age
						bind:height
						bind:weight
						bind:gender
						bind:activity
						bind:unitSystem
						{calculating}
						{onClear}
						{onCalculate}
						{onNotify}
					/>
				{:else}
					<div class="skeleton-form">
						<div class="skeleton skeleton-input"></div>
						<div class="skeleton skeleton-input"></div>
						<div class="skeleton skeleton-input"></div>
						<div class="skeleton skeleton-input" style="width:50%"></div>
					</div>
				{/if}
			</div>
			<div class="bmi-card">
				{#key resultsRunId}
					{#if BmiResultsComponent}
						<BmiResultsComponent
							{bmiValue}
							{category}
							{unitSystem}
							height={height === '' ? null : parseFloat(height)}
							weight={weight === '' ? null : parseFloat(weight)}
							age={age === '' ? null : parseInt(age)}
							gender={gender || null}
							activity={activity || null}
							reducedMotion={contentReducedMotion}
						/>
					{:else}
						<div class="skeleton-card">
							<div class="skeleton skeleton-circle"></div>
							<div class="skeleton skeleton-line w-60 h-lg" style="margin:0 auto 1rem"></div>
							<div class="skeleton skeleton-line w-80 h-md" style="margin:0 auto 0.5rem"></div>
							<div class="skeleton skeleton-line w-40 h-sm" style="margin:0 auto 1.5rem"></div>
							<div class="skeleton skeleton-line w-full h-sm"></div>
							<div class="skeleton skeleton-line w-full h-sm"></div>
							<div class="skeleton skeleton-line w-60 h-sm"></div>
						</div>
					{/if}
				{/key}
			</div>
		</div>
	</section>
</div>
