/**
 * Phase 3 — Regression Fortress: ErrorBoundary.svelte tests
 *
 * Covers: component smoke tests (renders without crashing),
 * props handling, and rendering structure verification.
 *
 * Note: ErrorBoundary's handleError/retry flow requires triggering errors
 * from child components, which is difficult to test with @testing-library/svelte
 * in Svelte 5 due to snippet rendering limitations. These tests verify
 * the component renders correctly in its default state.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';

// Mock logger to suppress console output in tests
vi.mock('$lib/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import ErrorBoundary from '../ErrorBoundary.svelte';

describe('ErrorBoundary', () => {
  it('renders without crashing when no props provided', () => {
    const { container } = render(ErrorBoundary, {
      props: {
        children: vi.fn().mockReturnValue(''),
      },
    });

    // Component should render an empty wrapper, not crash
    expect(container).toBeTruthy();
  });

  it('renders without crashing with module prop', () => {
    const { container } = render(ErrorBoundary, {
      props: {
        module: 'test-module',
        children: vi.fn().mockReturnValue(''),
      },
    });

    expect(container).toBeTruthy();
  });

  it('renders without crashing with all props', () => {
    const { container } = render(ErrorBoundary, {
      props: {
        module: 'results',
        showErrorUi: false,
        children: vi.fn().mockReturnValue(''),
      },
    });

    expect(container).toBeTruthy();
  });

  it('error UI is not visible by default', () => {
    render(ErrorBoundary, {
      props: {
        module: 'test',
        children: vi.fn().mockReturnValue(''),
      },
    });

    // Error state elements should NOT be visible when no error occurred
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });
});
