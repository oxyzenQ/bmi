<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script lang="ts">
	import { PAGER, SECTIONS, SPRING } from '$lib/utils/animation-config';
	import { pagerSpring } from '$lib/utils/pager-spring';
	import type { Activity, Gender, ImportNotifyResult } from '$lib/types/bmi-form';
	import Hero from '$lib/ui/Hero.svelte';
	import CalculatorSection from '$lib/components/page/CalculatorSection.svelte';
	import GaugeSection from '$lib/components/page/GaugeSection.svelte';
	import AboutSection from '$lib/components/sections/AboutSection.svelte';
	import SettingsSection from '$lib/components/sections/SettingsSection.svelte';

	type BmiFormComponentType = typeof import('$lib/components/BmiForm.svelte').default;
	type BmiResultsComponentType = typeof import('$lib/components/BmiResults.svelte').default;
	type BmiRadialGaugeComponentType = typeof import('$lib/components/BmiRadialGauge.svelte').default;
	type BmiHealthRiskComponentType = typeof import('$lib/components/BmiHealthRisk.svelte').default;
	type BmiSnapshotComponentType = typeof import('$lib/components/BmiSnapshot.svelte').default;
	type BodyFatEstimateComponentType =
		typeof import('$lib/components/BodyFatEstimate.svelte').default;
	type ReferenceTableComponentType = typeof import('$lib/components/ReferenceTable.svelte').default;
	type BmiGoalTrackerComponentType = typeof import('$lib/components/BmiGoalTracker.svelte').default;

	interface Props {
		activeIndex: number;
		sections: typeof SECTIONS;
		pagerDirection: number;
		pagerMotionDistance: number;
		pagerMotionDuration: number;
		reducedMotionEffective: boolean;
		BmiFormComponent: BmiFormComponentType | null;
		BmiResultsComponent: BmiResultsComponentType | null;
		BmiRadialGaugeComponent: BmiRadialGaugeComponentType | null;
		BmiHealthRiskComponent: BmiHealthRiskComponentType | null;
		BmiSnapshotComponent: BmiSnapshotComponentType | null;
		BodyFatEstimateComponent: BodyFatEstimateComponentType | null;
		ReferenceTableComponent: ReferenceTableComponentType | null;
		BmiGoalTrackerComponent: BmiGoalTrackerComponentType | null;
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
		isTouchDevice: boolean;
		gitCommitId: string;
		gitBranch: string;
		currentYear: number;
		onClear: () => void;
		onCalculate: () => void;
		onNotify: (result: ImportNotifyResult) => void;
	}

	let {
		activeIndex,
		sections,
		pagerDirection,
		pagerMotionDistance,
		pagerMotionDuration,
		reducedMotionEffective,
		BmiFormComponent,
		BmiResultsComponent,
		BmiRadialGaugeComponent,
		BmiHealthRiskComponent,
		BmiSnapshotComponent,
		BodyFatEstimateComponent,
		ReferenceTableComponent,
		BmiGoalTrackerComponent,
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
		isTouchDevice,
		gitCommitId,
		gitBranch,
		currentYear,
		onClear,
		onCalculate,
		onNotify
	}: Props = $props();
</script>

<main class="pager-view">
	{#key activeIndex}
		<section
			class="pager-section"
			id={sections[activeIndex].id}
			data-pager-scroll="true"
			data-section-id={sections[activeIndex].id}
			in:pagerSpring={{
				x: pagerDirection * pagerMotionDistance,
				duration: pagerMotionDuration,
				phase: 'in',
				strength: reducedMotionEffective ? 0 : SPRING.STRENGTH_ENHANCED
			}}
			out:pagerSpring={{
				x: -pagerDirection * pagerMotionDistance,
				duration: reducedMotionEffective ? 0 : Math.round(pagerMotionDuration * PAGER.OUT_RATIO),
				phase: 'out',
				strength: 0
			}}
		>
			{#if activeIndex === 0}
				<div class="main-container">
					<Hero />
				</div>
			{/if}

			{#if activeIndex === 1}
				<CalculatorSection
					{BmiFormComponent}
					{BmiResultsComponent}
					bind:age
					bind:height
					bind:weight
					bind:gender
					bind:activity
					bind:unitSystem
					{calculating}
					{resultsRunId}
					{bmiValue}
					{category}
					{contentReducedMotion}
					{onClear}
					{onCalculate}
					{onNotify}
				/>
			{/if}

			{#if activeIndex === 2}
				<GaugeSection
					{BmiRadialGaugeComponent}
					{BmiHealthRiskComponent}
					{BmiSnapshotComponent}
					{BodyFatEstimateComponent}
					{BmiGoalTrackerComponent}
					{bmiValue}
					{category}
					{resultsRunId}
					{isTouchDevice}
					{age}
					{gender}
				/>
			{/if}

			{#if activeIndex === 3}
				<div class="main-container">
					{#if ReferenceTableComponent}
						<ReferenceTableComponent />
					{:else}
						<div class="skeleton-card">
							<div class="skeleton skeleton-line w-60 h-lg" style="margin-bottom:1.5rem"></div>
							<div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.5rem"></div>
							<div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.5rem"></div>
							<div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.5rem"></div>
							<div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.5rem"></div>
							<div class="skeleton skeleton-line w-full h-sm"></div>
						</div>
					{/if}
				</div>
			{/if}

			{#if activeIndex === 4}
				<AboutSection {gitCommitId} {gitBranch} />
			{/if}

			{#if activeIndex === 5}
				<SettingsSection {currentYear} />
			{/if}
		</section>
	{/key}
</main>
