import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import BmiSnapshot from '../BmiSnapshot.svelte';

// Mock BmiHistorySparkline to keep tests focused on BmiSnapshot
vi.mock('../BmiHistorySparkline.svelte', () => ({
  default: vi.fn(({ currentBmi }) => {
    return {
      props: { currentBmi },
      render: () => `<div data-testid="sparkline-mock">BmiHistorySparkline</div>`
    };
  })
}));

describe('BmiSnapshot', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders header "BMI Snapshot"', () => {
    render(BmiSnapshot);
    expect(screen.getByText('BMI Snapshot')).toBeInTheDocument();
  });

  it('renders subtitle "Your progress toward optimal health"', () => {
    render(BmiSnapshot);
    expect(screen.getByText('Your progress toward optimal health')).toBeInTheDocument();
  });

  it('shows empty state when no BMI is provided', () => {
    render(BmiSnapshot);
    expect(screen.getByText('Calculate your BMI to see your health snapshot')).toBeInTheDocument();
  });

  it('shows dash placeholders for all cards when no BMI is provided', () => {
    render(BmiSnapshot);
    // All three cards show "—" when currentBmi is null
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(3);
  });

  it('shows "N/A" category for Current and Best cards when no BMI', () => {
    render(BmiSnapshot);
    // Two "N/A" labels: Current category and Your Best category (and Target also shows "N/A" when no bmi)
    const naLabels = screen.getAllByText('N/A');
    expect(naLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('shows current BMI value when currentBmi is provided', () => {
    render(BmiSnapshot, { props: { currentBmi: 27.5, category: 'Overweight' } });
    expect(screen.getByText('27.50')).toBeInTheDocument();
    expect(screen.getByText('Overweight')).toBeInTheDocument();
  });

  it('shows target BMI as "22.00" and "Optimal BMI" when currentBmi is provided', () => {
    render(BmiSnapshot, { props: { currentBmi: 27.5 } });
    expect(screen.getByText('22.00')).toBeInTheDocument();
    expect(screen.getByText('Optimal BMI')).toBeInTheDocument();
  });

  it('shows "Your Best" card with "—" when no history data in localStorage', () => {
    render(BmiSnapshot, { props: { currentBmi: 27.5 } });
    // Best BMI should show "—" since localStorage is empty
    const container = document.querySelector('.bmi-snapshot');
    const bestCards = container?.querySelectorAll('.snapshot-card.best .card-value');
    expect(bestCards?.length).toBe(1);
    expect(bestCards?.[0].textContent).toBe('—');
    // Best category should be "N/A"
    const bestCategories = container?.querySelectorAll('.snapshot-card.best .card-category');
    expect(bestCategories?.[0].textContent).toBe('N/A');
  });

  it('shows progress percentage when currentBmi is provided', () => {
    render(BmiSnapshot, { props: { currentBmi: 27.5 } });
    // Progress section should be visible with a percentage value
    expect(screen.getByText('Progress to Target')).toBeInTheDocument();
    // The progress value is rendered as a span next to the label
    const progressValue = document.querySelector('.progress-value');
    expect(progressValue).not.toBeNull();
    expect(progressValue?.textContent).toMatch(/^\d+%$/);
  });

  it('shows "Progress to Target" label', () => {
    render(BmiSnapshot, { props: { currentBmi: 27.5 } });
    expect(screen.getByText('Progress to Target')).toBeInTheDocument();
  });

  it('shows "Need to lose X BMI points" when currentBmi > 22 (overweight)', () => {
    render(BmiSnapshot, { props: { currentBmi: 28 } });
    const diff = (28 - 22).toFixed(2);
    // Text is split across <span> and <strong>, so query the insight container
    const insight = document.querySelector('.progress-insights');
    expect(insight?.textContent).toContain('Need to lose');
    expect(insight?.textContent).toContain(`${diff} BMI points`);
    expect(insight?.textContent).toContain('to reach optimal');
  });

  it('shows "Need to gain X BMI points" when currentBmi < 22 (underweight)', () => {
    render(BmiSnapshot, { props: { currentBmi: 18 } });
    const diff = (22 - 18).toFixed(2);
    // Text is split across <span> and <strong>, so query the insight container
    const insight = document.querySelector('.progress-insights');
    expect(insight?.textContent).toContain('Need to gain');
    expect(insight?.textContent).toContain(`${diff} BMI points`);
    expect(insight?.textContent).toContain('to reach optimal');
  });

  it('shows "You\'re at your optimal BMI!" when currentBmi === 22', () => {
    render(BmiSnapshot, { props: { currentBmi: 22 } });
    expect(screen.getByText("You're at your optimal BMI! Great job maintaining your health.")).toBeInTheDocument();
  });

  it('shows progress bar with correct width for overweight BMI', () => {
    render(BmiSnapshot, { props: { currentBmi: 27.5 } });
    const progressFill = document.querySelector('.progress-fill');
    expect(progressFill).not.toBeNull();
    // Width should be a percentage string
    expect((progressFill as HTMLElement).style.width).toMatch(/^\d+\.?\d*%$/);
  });

  it('shows 100% progress when currentBmi equals ideal', () => {
    render(BmiSnapshot, { props: { currentBmi: 22 } });
    const progressValue = document.querySelector('.progress-value');
    expect(progressValue?.textContent).toBe('100%');
  });

  it('shows progress markers (0%, Ideal, 100%)', () => {
    render(BmiSnapshot, { props: { currentBmi: 27.5 } });
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Ideal')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows current category from props', () => {
    render(BmiSnapshot, { props: { currentBmi: 17.5, category: 'Underweight' } });
    expect(screen.getByText('Underweight')).toBeInTheDocument();
  });

  it('shows category as "N/A" when category prop is not provided but currentBmi is set', () => {
    render(BmiSnapshot, { props: { currentBmi: 27.5 } });
    const container = document.querySelector('.bmi-snapshot');
    const currentCategory = container?.querySelector('.snapshot-card.current .card-category');
    expect(currentCategory?.textContent).toBe('N/A');
  });

  it('applies correct status class for normal weight BMI', () => {
    render(BmiSnapshot, { props: { currentBmi: 23 } });
    const container = document.querySelector('.bmi-snapshot');
    const currentCard = container?.querySelector('.snapshot-card.current');
    expect(currentCard?.classList.contains('status-normal')).toBe(true);
  });

  it('applies correct status class for overweight BMI', () => {
    render(BmiSnapshot, { props: { currentBmi: 27 } });
    const container = document.querySelector('.bmi-snapshot');
    const currentCard = container?.querySelector('.snapshot-card.current');
    expect(currentCard?.classList.contains('status-overweight')).toBe(true);
  });

  it('applies status-unknown class when no BMI provided', () => {
    render(BmiSnapshot);
    const container = document.querySelector('.bmi-snapshot');
    const cards = container?.querySelectorAll('.snapshot-card.status-unknown');
    // Current and Best cards get status-unknown; Target also gets it when no BMI
    expect(cards?.length).toBe(3);
  });
});
