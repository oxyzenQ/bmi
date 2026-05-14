import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatBmiText, copyToClipboard } from '../share';

describe('share utils', () => {
  describe('formatBmiText', () => {
    it('formats basic BMI data correctly', () => {
      const text = formatBmiText({
        bmi: 22.5,
        category: 'Normal Weight'
      });
      expect(text).toContain('BMI: 22.50');
      expect(text).toContain('Normal Weight');
      expect(text).toContain('BMI Stellar');
    });

    it('includes BMI Prime when provided', () => {
      const text = formatBmiText({
        bmi: 22.5,
        category: 'Normal Weight',
        bmiPrime: 0.9
      });
      expect(text).toContain('BMI Prime: 0.90');
    });

    it('includes height and weight in metric', () => {
      const text = formatBmiText({
        bmi: 22.5,
        category: 'Normal Weight',
        height: 170,
        weight: 65,
        unitSystem: 'metric'
      });
      expect(text).toContain('Height: 170 cm');
      expect(text).toContain('Weight: 65 kg');
    });

    it('converts to imperial units', () => {
      const text = formatBmiText({
        bmi: 22.5,
        category: 'Normal Weight',
        height: 67,
        weight: 154,
        unitSystem: 'imperial'
      });
      expect(text).toContain('Height: 67 in');
      expect(text).toContain('Weight: 154 lbs');
    });

    it('includes TDEE when provided', () => {
      const text = formatBmiText({
        bmi: 22.5,
        category: 'Normal Weight',
        tdee: 2300
      });
      expect(text).toContain('TDEE: 2300 kcal/day');
    });

    it('handles null height/weight gracefully', () => {
      const text = formatBmiText({
        bmi: 22.5,
        category: 'Normal Weight',
        height: null,
        weight: null
      });
      expect(text).toContain('BMI: 22.50');
      // Should not crash on null
    });
  });

  describe('copyToClipboard', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('copies text using navigator.clipboard API', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true
      });

      const result = await copyToClipboard('test text');
      expect(result).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('test text');
    });

    it('returns false when clipboard API throws', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
        writable: true
      });

      // Mock execCommand fallback
      const execMock = vi.fn().mockReturnValue(false);
      document.execCommand = execMock;

      const result = await copyToClipboard('test text');
      expect(result).toBe(false);
    });
  });
});