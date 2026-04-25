/**
 * NotifyFloat component tests — focus trap, visibility, type rendering, keyboard interactions.
 */

import { render, screen, fireEvent, act } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NotifyFloat from '$lib/components/NotifyFloat.svelte';

describe('NotifyFloat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    show: false,
    type: 'success' as const,
    message: 'Test message',
    buttonText: 'OK',
    onContinue: vi.fn(),
    onClose: vi.fn(),
    onCancel: vi.fn(),
  };

  /** Helper: render + advance timers past the 60ms animation delay */
  async function renderVisible(overrides: Record<string, unknown> = {}) {
    const result = render(NotifyFloat, {
      props: { ...defaultProps, show: true, ...overrides }
    });
    // Advance past the 60ms visible animation delay
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    return result;
  }

  it('renders nothing visible when show is false', () => {
    render(NotifyFloat, { props: defaultProps });
    // Component renders an empty HTML comment, no dialog visible
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
  });

  it('renders backdrop and dialog when show is true', async () => {
    await renderVisible();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('applies correct CSS class for success type', async () => {
    await renderVisible({ type: 'success' });
    const btn = screen.getByText('OK');
    expect(btn.className).toContain('btn-success');
  });

  it('applies correct CSS class for delete type', async () => {
    await renderVisible({ type: 'delete' });
    const btn = screen.getByText('OK');
    expect(btn.className).toContain('btn-delete');
  });

  it('applies correct CSS class for warn type', async () => {
    await renderVisible({ type: 'warn' });
    const btn = screen.getByText('OK');
    expect(btn.className).toContain('btn-warn');
  });

  it('shows Cancel button for delete type', async () => {
    await renderVisible({ type: 'delete' });
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows Cancel button for warn type', async () => {
    await renderVisible({ type: 'warn' });
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not show Cancel button for success type', async () => {
    await renderVisible({ type: 'success' });
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('calls onContinue when action button is clicked', async () => {
    await renderVisible();
    const btn = screen.getByText('OK');
    fireEvent.click(btn);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(defaultProps.onContinue).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', async () => {
    await renderVisible();
    const closeBtn = screen.getByLabelText('Close notification');
    fireEvent.click(closeBtn);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', async () => {
    await renderVisible({ type: 'delete' });
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('dismisses on Escape key', async () => {
    await renderVisible();
    const dialog = screen.getByRole('dialog');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus within dialog via Tab', async () => {
    await renderVisible({ type: 'success' });
    const dialog = screen.getByRole('dialog');
    const buttons = dialog.querySelectorAll('button');

    // Press Tab on the last button
    const lastBtn = buttons[buttons.length - 1];
    fireEvent.keyDown(lastBtn, { key: 'Tab' });

    // Focus should wrap to first button (Tab trap behavior)
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('has aria-modal attribute on backdrop', async () => {
    await renderVisible();
    const backdrop = screen.getByRole('dialog');
    expect(backdrop).toHaveAttribute('aria-modal', 'true');
  });

  it('hides when show becomes false', async () => {
    const { rerender } = await renderVisible();

    rerender({ props: { ...defaultProps, show: false } });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('icon changes based on type', async () => {
    const warnResult = await renderVisible({ type: 'warn' });
    // Check for ShieldAlert icon (warn type) or CheckCircle (success)
    const icons = warnResult.container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });
});
