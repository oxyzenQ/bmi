// Copyright (c) 2025 - 2026 rezky_nightky
// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import {
	bmiToChartY,
	clampPlotCoordinate,
	DEFAULT_BMI_SPARKLINE_DOMAIN,
	getBmiSparklineDomain
} from '../bmi-sparkline-chart';

describe('bmi-sparkline-chart helpers', () => {
	it('keeps the default domain for normal in-range values', () => {
		expect(getBmiSparklineDomain([18.5, 22, 29.9])).toEqual(DEFAULT_BMI_SPARKLINE_DOMAIN);
	});

	it('extends the lower domain for very low underweight values', () => {
		const domain = getBmiSparklineDomain([10.4, 11.2, 13]);
		expect(domain.min).toBeLessThan(10.4);
		expect(domain.max).toBe(DEFAULT_BMI_SPARKLINE_DOMAIN.max);
	});

	it('maps lower BMI values lower on the plot area', () => {
		const domain = getBmiSparklineDomain([10, 22, 34]);
		const lowY = bmiToChartY(10, domain, 20, 196);
		const highY = bmiToChartY(34, domain, 20, 196);

		expect(lowY).toBeGreaterThan(highY);
	});

	it('clamps coordinates with marker inset accounted for', () => {
		expect(clampPlotCoordinate(240, 20, 216, 6)).toBe(210);
		expect(clampPlotCoordinate(10, 20, 216, 6)).toBe(26);
	});
});
