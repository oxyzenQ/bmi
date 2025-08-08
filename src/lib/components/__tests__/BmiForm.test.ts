import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BmiForm from '../BmiForm.svelte';

describe('BmiForm', () => {
    it('renders form with all required elements', () => {
        const mockOnCalculate = vi.fn();
        const mockOnReset = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onReset: mockOnReset
            }
        });

        // Check for form elements
        expect(screen.getByText('Calculate Your BMI')).toBeInTheDocument();
        expect(screen.getByText('Enter your measurements below.')).toBeInTheDocument();

        // Check for input fields
        expect(screen.getByLabelText('Age (years)')).toBeInTheDocument();
        expect(screen.getByLabelText('Height (cm)')).toBeInTheDocument();
        expect(screen.getByLabelText('Weight (kg)')).toBeInTheDocument();

        // Check for buttons
        expect(screen.getByRole('button', { name: /calculate bmi/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reset form/i })).toBeInTheDocument();
    });

    it('accepts input values for all fields', async () => {
        const mockOnCalculate = vi.fn();
        const mockOnReset = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onReset: mockOnReset
            }
        });

        const ageInput = screen.getByLabelText('Age (years)') as HTMLInputElement;
        const heightInput = screen.getByLabelText('Height (cm)') as HTMLInputElement;
        const weightInput = screen.getByLabelText('Weight (kg)') as HTMLInputElement;

        // Test input acceptance
        await fireEvent.input(ageInput, { target: { value: '25' } });
        await fireEvent.input(heightInput, { target: { value: '170' } });
        await fireEvent.input(weightInput, { target: { value: '70.5' } });

        expect(ageInput.value).toBe('25');
        expect(heightInput.value).toBe('170');
        expect(weightInput.value).toBe('70.5');
    });

    it('calls onCalculate when form is submitted with valid data', async () => {
        const mockOnCalculate = vi.fn();
        const mockOnReset = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onReset: mockOnReset
            }
        });

        const ageInput = screen.getByLabelText('Age (years)');
        const heightInput = screen.getByLabelText('Height (cm)');
        const weightInput = screen.getByLabelText('Weight (kg)');
        const calculateButton = screen.getByRole('button', { name: /calculate bmi/i });

        // Fill in form
        await fireEvent.input(ageInput, { target: { value: '25' } });
        await fireEvent.input(heightInput, { target: { value: '170' } });
        await fireEvent.input(weightInput, { target: { value: '70.5' } });

        // Submit form
        await fireEvent.click(calculateButton);

        // Wait for the calculation delay
        await new Promise(resolve => setTimeout(resolve, 600));

        expect(mockOnCalculate).toHaveBeenCalledWith(25, 170, 70.5);
    });

    it('calls onReset when reset button is clicked', async () => {
        const mockOnCalculate = vi.fn();
        const mockOnReset = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onReset: mockOnReset
            }
        });

        const resetButton = screen.getByRole('button', { name: /reset form/i });
        await fireEvent.click(resetButton);

        expect(mockOnReset).toHaveBeenCalled();
    });

    it('disables calculate button when inputs are empty', () => {
        const mockOnCalculate = vi.fn();
        const mockOnReset = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onReset: mockOnReset
            }
        });

        const calculateButton = screen.getByRole('button', { name: /calculate bmi/i });
        expect(calculateButton).toBeDisabled();
    });

    it('enables calculate button when all inputs have values', async () => {
        const mockOnCalculate = vi.fn();
        const mockOnReset = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onReset: mockOnReset
            }
        });

        const ageInput = screen.getByLabelText('Age (years)');
        const heightInput = screen.getByLabelText('Height (cm)');
        const weightInput = screen.getByLabelText('Weight (kg)');
        const calculateButton = screen.getByRole('button', { name: /calculate bmi/i });

        // Initially disabled
        expect(calculateButton).toBeDisabled();

        // Fill in form
        await fireEvent.input(ageInput, { target: { value: '25' } });
        await fireEvent.input(heightInput, { target: { value: '170' } });
        await fireEvent.input(weightInput, { target: { value: '70.5' } });

        // Should be enabled
        expect(calculateButton).not.toBeDisabled();
    });

    it('shows loading state during calculation', async () => {
        const mockOnCalculate = vi.fn();
        const mockOnReset = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onReset: mockOnReset
            }
        });

        const ageInput = screen.getByLabelText('Age (years)');
        const heightInput = screen.getByLabelText('Height (cm)');
        const weightInput = screen.getByLabelText('Weight (kg)');
        const calculateButton = screen.getByRole('button', { name: /calculate bmi/i });

        // Fill in form
        await fireEvent.input(ageInput, { target: { value: '25' } });
        await fireEvent.input(heightInput, { target: { value: '170' } });
        await fireEvent.input(weightInput, { target: { value: '70.5' } });

        // Submit form
        await fireEvent.click(calculateButton);

        // Should show loading state
        expect(screen.getByText('Calculating...')).toBeInTheDocument();
        expect(calculateButton).toBeDisabled();
    });

    it('validates input ranges correctly', async () => {
        const mockOnCalculate = vi.fn();
        const mockOnReset = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onReset: mockOnReset
            }
        });

        const ageInput = screen.getByLabelText('Age (years)') as HTMLInputElement;
        const heightInput = screen.getByLabelText('Height (cm)') as HTMLInputElement;
        const weightInput = screen.getByLabelText('Weight (kg)') as HTMLInputElement;

        // Check min/max attributes
        expect(ageInput.min).toBe('1');
        expect(ageInput.max).toBe('120');
        expect(heightInput.min).toBe('50');
        expect(heightInput.max).toBe('300');
        expect(weightInput.min).toBe('10');
        expect(weightInput.max).toBe('500');
    });
});
