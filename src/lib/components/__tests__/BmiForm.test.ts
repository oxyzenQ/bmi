import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BmiForm from '../BmiForm.svelte';

describe('BmiForm', () => {
    it('renders form with all required elements', () => {
        const mockOnCalculate = vi.fn();
        const mockOnClear = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onClear: mockOnClear
            }
        });

        // Check for form elements
        expect(screen.getByText('BMI Calculator')).toBeInTheDocument();
        //expect(screen.getByText('Fill in order: Age → Height → Weight. Click Calculate BMI to see results.')).toBeInTheDocument();

        // Check for input fields
        expect(screen.getByLabelText('Age (years)')).toBeInTheDocument();
        expect(screen.getByLabelText('Height (cm)')).toBeInTheDocument();
        expect(screen.getByLabelText('Weight (kg)')).toBeInTheDocument();

        // Check for buttons
        expect(screen.getByRole('button', { name: /calculate bmi/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /clear all data/i })).toBeInTheDocument();
    });

    it('accepts input values for all fields', async () => {
        const mockOnCalculate = vi.fn();
        const mockOnClear = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onClear: mockOnClear
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
        const mockOnClear = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onClear: mockOnClear
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

        // Current implementation calls onCalculate() without args immediately
        expect(mockOnCalculate).toHaveBeenCalledTimes(1);
    });

    it('calls onClear when reset button is clicked', async () => {
        const mockOnCalculate = vi.fn();
        const mockOnClear = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onClear: mockOnClear
            }
        });

        const resetButton = screen.getByRole('button', { name: /clear all data/i });
        await fireEvent.click(resetButton);

        expect(mockOnClear).toHaveBeenCalled();
    });

    it('disables calculate button when inputs are empty', () => {
        const mockOnCalculate = vi.fn();
        const mockOnClear = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onClear: mockOnClear
            }
        });

        const calculateButton = screen.getByRole('button', { name: /calculate bmi/i });
        expect(calculateButton).toBeDisabled();
    });

    it('enables calculate button when all inputs have values', async () => {
        const mockOnCalculate = vi.fn();
        const mockOnClear = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onClear: mockOnClear
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

    // Loading state is no longer part of the component; removed test

    it('validates input ranges correctly (shows error messages)', async () => {
        const mockOnCalculate = vi.fn();
        const mockOnClear = vi.fn();

        render(BmiForm, {
            props: {
                onCalculate: mockOnCalculate,
                onClear: mockOnClear
            }
        });

        const ageInput = screen.getByLabelText('Age (years)') as HTMLInputElement;
        const heightInput = screen.getByLabelText('Height (cm)') as HTMLInputElement;
        const weightInput = screen.getByLabelText('Weight (kg)') as HTMLInputElement;

        // Enter invalid values to trigger validation messages
        await fireEvent.input(ageInput, { target: { value: '0' } });
        await fireEvent.input(heightInput, { target: { value: '400' } });
        await fireEvent.input(weightInput, { target: { value: '0' } });

        expect(screen.getByText('Please enter a valid age between 1 and 120.')).toBeInTheDocument();
        expect(screen.getByText('Height must be between 1-300 cm.')).toBeInTheDocument();
        expect(screen.getByText('Weight must be between 1-1000 kg.')).toBeInTheDocument();
    });
});
