import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';

// Svelte 5's tweened() calls window.matchMedia internally; jsdom does not provide it.
// vi.hoisted runs before any imports so the mock is in place when the component loads.
vi.hoisted(() => {
        Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: (query: string) => ({
                        matches: false,
                        media: query,
                        onchange: null,
                        addListener: vi.fn(),
                        removeListener: vi.fn(),
                        addEventListener: vi.fn(),
                        removeEventListener: vi.fn(),
                        dispatchEvent: vi.fn(),
                }),
        });
});

import BmiRadialGauge from '../BmiRadialGauge.svelte';

vi.mock('$lib/utils/performance', () => ({
        getPerformanceTier: () => 'medium' as const,
        prefersReducedMotion: () => false,
}));

describe('BmiRadialGauge', () => {
        it('renders gauge container with header text "BMI Gauge"', () => {
                render(BmiRadialGauge);
                expect(screen.getByText('BMI Gauge')).toBeInTheDocument();
        });

        it('shows "\u2014" when no BMI is provided (bmi=0)', () => {
                render(BmiRadialGauge, { props: { bmi: 0, category: null } });
                expect(screen.getByText('\u2014')).toBeInTheDocument();
        });

        it('shows BMI value when bmi prop is set with category', () => {
                const { container } = render(BmiRadialGauge, {
                        props: { bmi: 22.5, category: 'Normal Weight' }
                });

                const bmiValueEl = container.querySelector('.bmi-value');
                expect(bmiValueEl).not.toBeNull();
                // appliedBmi > 0 means "—" is replaced by a numeric tweened value (may start at 0.00)
                expect(bmiValueEl!.textContent).not.toBe('\u2014');
                expect(bmiValueEl!.textContent).toMatch(/^\d+\.\d{2}$/);
        });

        it('shows category label when both bmi and category are provided', () => {
                const { container } = render(BmiRadialGauge, {
                        props: { bmi: 22.5, category: 'Normal Weight' }
                });

                // Use SVG selector to avoid collision with scale indicator text
                const categoryLabel = container.querySelector('.category-label');
                expect(categoryLabel).toHaveTextContent('Normal Weight');
        });

        it('shows "N/A" when bmi is 0 and no category', () => {
                const { container } = render(BmiRadialGauge, {
                        props: { bmi: 0, category: null }
                });

                const categoryLabel = container.querySelector('.category-label');
                expect(categoryLabel).toHaveTextContent('N/A');
        });

        it('renders all 4 scale indicator items', () => {
                render(BmiRadialGauge);

                expect(screen.getByText('Underweight')).toBeInTheDocument();
                expect(screen.getByText('Normal Weight')).toBeInTheDocument();
                expect(screen.getByText('Overweight')).toBeInTheDocument();
                expect(screen.getByText('Obese')).toBeInTheDocument();
        });

        it('shows empty CTA when bmi is 0', () => {
                render(BmiRadialGauge, { props: { bmi: 0, category: null } });

                expect(
                        screen.getByText('Enter your measurements to visualize your BMI')
                ).toBeInTheDocument();
        });

        it('does NOT show CTA when bmi > 0', () => {
                render(BmiRadialGauge, {
                        props: { bmi: 22.5, category: 'Normal Weight' }
                });

                expect(
                        screen.queryByText('Enter your measurements to visualize your BMI')
                ).not.toBeInTheDocument();
        });
});
