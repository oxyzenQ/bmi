import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BodyFatEstimate from '../BodyFatEstimate.svelte';

describe('BodyFatEstimate', () => {
    it('renders the header "Body Fat Estimate"', () => {
        render(BodyFatEstimate);
        expect(screen.getByRole('heading', { name: 'Body Fat Estimate' })).toBeInTheDocument();
    });

    it('shows empty state when no bmi is provided', () => {
        render(BodyFatEstimate);
        expect(screen.getByText('Calculate your BMI to see body fat estimation')).toBeInTheDocument();
    });

    it('shows age prompt when bmi is set but age is not', () => {
        render(BodyFatEstimate, { props: { bmi: 25 } });
        expect(screen.getByText('Enter your age to see body fat estimation')).toBeInTheDocument();
    });

    it('calculates body fat correctly for male using Deurenberg formula', () => {
        // BMI=25, Age=30, Male: 1.20*25 + 0.23*30 - 10.8*1 - 5.4 = 20.7
        render(BodyFatEstimate, { props: { bmi: 25, age: 30 } });
        expect(screen.getByText('20.7%')).toBeInTheDocument();
    });

    it('calculates body fat correctly for female using Deurenberg formula', () => {
        // BMI=25, Age=30, Female: 1.20*25 + 0.23*30 - 10.8*0 - 5.4 = 31.5
        render(BodyFatEstimate, { props: { bmi: 25, age: 30 } });
        // Switch to female
        const femaleBtn = screen.getByRole('radio', { name: 'Female' });
        fireEvent.click(femaleBtn);
        expect(screen.getByText('31.5%')).toBeInTheDocument();
    });

    it('shows body fat percentage value when both bmi and age provided', () => {
        render(BodyFatEstimate, { props: { bmi: 22, age: 25 } });
        // Male default: 1.20*22 + 0.23*25 - 10.8 - 5.4 = 26.4 + 5.75 - 10.8 - 5.4 = 15.95 → 15.9
        expect(screen.getByText('15.9%')).toBeInTheDocument();
    });

    it('shows category label', () => {
        // Male bmi=25, age=30 → 20.7% → "Average" (18-24% range for males)
        render(BodyFatEstimate, { props: { bmi: 25, age: 30 } });
        // Target the .bf-category element specifically ("Average" also appears in ranges table)
        const categoryEl = document.querySelector('.bf-category');
        expect(categoryEl).toHaveTextContent('Average');
    });

    it('has male button active by default', () => {
        render(BodyFatEstimate, { props: { bmi: 25, age: 30 } });
        const maleBtn = screen.getByRole('radio', { name: 'Male' });
        expect(maleBtn).toHaveAttribute('aria-checked', 'true');
    });

    it('makes female button active when clicked', () => {
        render(BodyFatEstimate, { props: { bmi: 25, age: 30 } });
        const femaleBtn = screen.getByRole('radio', { name: 'Female' });
        fireEvent.click(femaleBtn);
        expect(femaleBtn).toHaveAttribute('aria-checked', 'true');

        const maleBtn = screen.getByRole('radio', { name: 'Male' });
        expect(maleBtn).toHaveAttribute('aria-checked', 'false');
    });

    it('shows composition bar with fat and lean percentages', () => {
        render(BodyFatEstimate, { props: { bmi: 25, age: 30 } });
        expect(screen.getByText('Body Composition')).toBeInTheDocument();
        expect(screen.getByText(/Fat: 20\.7%/)).toBeInTheDocument();
        expect(screen.getByText(/Lean: 79\.3%/)).toBeInTheDocument();
    });

    it('has body fat ranges reference table', () => {
        render(BodyFatEstimate, { props: { bmi: 25, age: 30 } });
        // Default is male, so expect men's ranges heading
        expect(screen.getByRole('heading', { name: "Men's Body Fat Ranges" })).toBeInTheDocument();

        // Check for range categories (target .range-label to avoid duplicates with category)
        const rangeLabels = document.querySelectorAll('.range-label');
        const labels = Array.from(rangeLabels).map((el) => el.textContent);
        expect(labels).toContain('Essential');
        expect(labels).toContain('Athletic');
        expect(labels).toContain('Fitness');
        expect(labels).toContain('Average');
        expect(labels).toContain('Obese');
    });

    it('switches ranges table to women when female is selected', () => {
        render(BodyFatEstimate, { props: { bmi: 25, age: 30 } });
        const femaleBtn = screen.getByRole('radio', { name: 'Female' });
        fireEvent.click(femaleBtn);

        expect(screen.getByRole('heading', { name: "Women's Body Fat Ranges" })).toBeInTheDocument();
    });

    it('renders sex toggle with radiogroup role', () => {
        render(BodyFatEstimate);
        expect(screen.getByRole('radiogroup', { name: 'Biological sex' })).toBeInTheDocument();
    });
});
