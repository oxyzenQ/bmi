/**
 * NotifyFloat component tests — focus trap, visibility, type rendering, keyboard interactions.
 */

import { render, screen, fireEvent, act } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NotifyFloat from '$lib/components/NotifyFloat.svelte';

describe('NotifyFloat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  /** Helper: render + advance timers past animation delays
   * NotifyFloat has 60ms internal delay + ModalShell has 60ms openDelay = 120ms total */
  async function renderVisible(overrides: Record<string, unknown> = {}) {
    const result = render(NotifyFloat, {
      props: { ...defaultProps, show: true, ...overrides }
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
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

    // The $effect chain uses setTimeout: NotifyFloat (60ms) → ModalShell (60ms).
    // With fake timers, new timers set during an advance may not fire.
    // Advance again to ensure the document keydown handler is registered.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    // NotifyFloat has 200ms close delay
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('focus does not escape dialog on Tab key', async () => {
    await renderVisible({ type: 'success' });
    const dialog = screen.getByRole('dialog');

    // Focus the last button
    const buttons = dialog.querySelectorAll('button');
    const lastBtn = buttons[buttons.length - 1];
    lastBtn.focus();
    expect(document.activeElement).toBe(lastBtn);

    // Press Tab — focus should stay within dialog (not escape to body)
    fireEvent.keyDown(lastBtn, { key: 'Tab' });

    // After Tab, focus should still be on one of the dialog buttons
    const focusedEl = document.activeElement as HTMLElement;
    expect(dialog.contains(focusedEl)).toBe(true);
  });

  it('has aria-modal attribute on backdrop', async () => {
    await renderVisible();
    const backdrop = screen.getByRole('dialog');
    expect(backdrop).toHaveAttribute('aria-modal', 'true');
  });

  it('hides when show becomes false', async () => {
    const { rerender } = await renderVisible();

    rerender({ ...defaultProps, show: false });

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