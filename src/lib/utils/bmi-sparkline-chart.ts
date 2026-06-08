// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only

export interface BmiSparklineDomain {
	min: number;
	max: number;
}

export const DEFAULT_BMI_SPARKLINE_DOMAIN: BmiSparklineDomain = {
	min: 12,
	max: 42
};

const EDGE_PADDING = 0.8;
const EDGE_EPSILON = 0.4;
const MIN_VISIBLE_RANGE = 8;

export function getBmiSparklineDomain(
	values: readonly number[],
	fallback: BmiSparklineDomain = DEFAULT_BMI_SPARKLINE_DOMAIN
): BmiSparklineDomain {
	const finiteValues = values.filter(Number.isFinite);
	let min = fallback.min;
	let max = fallback.max;

	if (finiteValues.length > 0) {
		const dataMin = Math.min(...finiteValues);
		const dataMax = Math.max(...finiteValues);
		const dataRange = Math.max(0, dataMax - dataMin);
		const dataPadding = Math.max(EDGE_PADDING, dataRange * 0.12);

		if (dataMin <= fallback.min + EDGE_EPSILON) {
			min = dataMin - dataPadding;
		}

		if (dataMax >= fallback.max - EDGE_EPSILON) {
			max = dataMax + dataPadding;
		}
	}

	if (max - min < MIN_VISIBLE_RANGE) {
		const center = (min + max) / 2;
		min = center - MIN_VISIBLE_RANGE / 2;
		max = center + MIN_VISIBLE_RANGE / 2;
	}

	return {
		min: Math.floor(min * 2) / 2,
		max: Math.ceil(max * 2) / 2
	};
}

export function bmiToChartY(
	bmi: number,
	domain: BmiSparklineDomain,
	plotTop: number,
	plotHeight: number
): number {
	const span = Math.max(domain.max - domain.min, 1);
	return plotTop + (1 - (bmi - domain.min) / span) * plotHeight;
}

export function clampPlotCoordinate(value: number, min: number, max: number, inset = 0): number {
	return Math.max(min + inset, Math.min(max - inset, value));
}
