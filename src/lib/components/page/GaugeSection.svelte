<!-- // Copyright (c) 2025 - 2026 rezky_nightky -->
<script lang="ts">
	type BmiRadialGaugeComponentType = typeof import('$lib/components/BmiRadialGauge.svelte').default;
	type BmiHealthRiskComponentType = typeof import('$lib/components/BmiHealthRisk.svelte').default;
	type BmiSnapshotComponentType = typeof import('$lib/components/BmiSnapshot.svelte').default;
	type BodyFatEstimateComponentType =
		typeof import('$lib/components/BodyFatEstimate.svelte').default;
	type BmiGoalTrackerComponentType = typeof import('$lib/components/BmiGoalTracker.svelte').default;

	interface Props {
		BmiRadialGaugeComponent: BmiRadialGaugeComponentType | null;
		BmiHealthRiskComponent: BmiHealthRiskComponentType | null;
		BmiSnapshotComponent: BmiSnapshotComponentType | null;
		BodyFatEstimateComponent: BodyFatEstimateComponentType | null;
		BmiGoalTrackerComponent: BmiGoalTrackerComponentType | null;
		bmiValue: number | null;
		category: string | null;
		resultsRunId: number;
		isTouchDevice: boolean;
		age: string;
		gender: 'male' | 'female' | '';
	}

	let {
		BmiRadialGaugeComponent,
		BmiHealthRiskComponent,
		BmiSnapshotComponent,
		BodyFatEstimateComponent,
		BmiGoalTrackerComponent,
		bmiValue,
		category,
		resultsRunId,
		isTouchDevice,
		age,
		gender
	}: Props = $props();
</script>

<div class="main-container">
	<div class="charts-section">
		{#if BmiRadialGaugeComponent}
			<BmiRadialGaugeComponent bmi={bmiValue || 0} {category} ultraSmooth={!isTouchDevice} />
		{:else}
			<div class="skeleton-card">
				<div class="skeleton-gauge">
					<div class="skeleton skeleton-ring"></div>
					<div class="skeleton skeleton-line w-60 h-md" style="margin:0 auto"></div>
					<div class="skeleton-bar">
						<span class="skeleton" style="background:var(--cyan2-40)"></span>
						<span class="skeleton" style="background:var(--green-50)"></span>
						<span class="skeleton" style="background:var(--yellow-60)"></span>
						<span class="skeleton" style="background:var(--red-50)"></span>
					</div>
				</div>
			</div>
		{/if}

		{#if BmiHealthRiskComponent}
			<BmiHealthRiskComponent bmi={bmiValue} {category} />
		{:else}
			<div class="skeleton-card">
				<div class="skeleton skeleton-line w-40 h-md" style="margin-bottom:1rem"></div>
				<div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.75rem"></div>
				<div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:1.5rem"></div>
				<div class="skeleton skeleton-line w-80 h-sm"></div>
				<div class="skeleton skeleton-line w-60 h-sm" style="margin-top:0.75rem"></div>
			</div>
		{/if}

		{#if BmiSnapshotComponent}
			<BmiSnapshotComponent currentBmi={bmiValue} {category} refreshKey={resultsRunId} />
		{:else}
			<div class="skeleton-card">
				<div class="skeleton skeleton-line w-60 h-md" style="margin-bottom:1rem"></div>
				<div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.75rem"></div>
				<div class="skeleton skeleton-line w-80 h-sm"></div>
			</div>
		{/if}

		{#if BodyFatEstimateComponent}
			<BodyFatEstimateComponent
				bmi={bmiValue}
				age={age === '' ? null : parseInt(age)}
				gender={gender || null}
			/>
		{:else}
			<div class="skeleton-card">
				<div class="skeleton skeleton-circle"></div>
				<div class="skeleton skeleton-line w-40 h-lg" style="margin:0 auto 1rem"></div>
				<div class="skeleton skeleton-line w-full h-sm" style="margin-bottom:0.5rem"></div>
				<div class="skeleton skeleton-line w-full h-sm"></div>
			</div>
		{/if}

		{#if BmiGoalTrackerComponent}
			<BmiGoalTrackerComponent currentBmi={bmiValue} />
		{:else}
			<div class="skeleton-card">
				<div class="skeleton skeleton-line w-60 h-sm" style="margin-bottom:0.75rem"></div>
				<div class="skeleton skeleton-line w-full h-sm"></div>
			</div>
		{/if}
	</div>
</div>
