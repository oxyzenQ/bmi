import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ArticleCard from '../ArticleCard.svelte';

describe('ArticleCard', () => {
    it('renders article card with title and description', () => {
        const mockOnOpenModal = vi.fn();

        render(ArticleCard, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: 'fa6-solid:heart',
                onOpenModal: mockOnOpenModal
            }
        });

        expect(screen.getByText('Test Article')).toBeInTheDocument();
        expect(screen.getByText('Test description')).toBeInTheDocument();
        expect(screen.getByText('Read Full Article →')).toBeInTheDocument();
    });

    it('calls onOpenModal when clicked', async () => {
        const mockOnOpenModal = vi.fn();

        render(ArticleCard, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: 'fa6-solid:heart',
                onOpenModal: mockOnOpenModal
            }
        });

        const button = screen.getByRole('button');
        await fireEvent.click(button);

        expect(mockOnOpenModal).toHaveBeenCalledWith('Test Article', expect.any(String));
    });

    it('calls onOpenModal when Enter key is pressed', async () => {
        const mockOnOpenModal = vi.fn();

        render(ArticleCard, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: 'fa6-solid:heart',
                onOpenModal: mockOnOpenModal
            }
        });

        const button = screen.getByRole('button');
        await fireEvent.keyDown(button, { key: 'Enter' });

        expect(mockOnOpenModal).toHaveBeenCalledWith('Test Article', expect.any(String));
    });

    it('calls onOpenModal when Space key is pressed', async () => {
        const mockOnOpenModal = vi.fn();

        render(ArticleCard, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: 'fa6-solid:heart',
                onOpenModal: mockOnOpenModal
            }
        });

        const button = screen.getByRole('button');
        await fireEvent.keyDown(button, { key: ' ' });

        expect(mockOnOpenModal).toHaveBeenCalledWith('Test Article', expect.any(String));
    });

    it('prevents default behavior on Enter and Space keys', async () => {
        const mockOnOpenModal = vi.fn();

        render(ArticleCard, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: 'fa6-solid:heart',
                onOpenModal: mockOnOpenModal
            }
        });

        const button = screen.getByRole('button');

        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
        const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });

        const enterPreventDefault = vi.spyOn(enterEvent, 'preventDefault');
        const spacePreventDefault = vi.spyOn(spaceEvent, 'preventDefault');

        await fireEvent(button, enterEvent);
        await fireEvent(button, spaceEvent);

        expect(enterPreventDefault).toHaveBeenCalled();
        expect(spacePreventDefault).toHaveBeenCalled();
    });

    it('has proper accessibility attributes', () => {
        const mockOnOpenModal = vi.fn();

        render(ArticleCard, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: 'fa6-solid:heart',
                onOpenModal: mockOnOpenModal
            }
        });

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('type', 'button');
        expect(button).toHaveAttribute('aria-label', 'Read full article: Test Article');
    });

    it('does not call onOpenModal for other keys', async () => {
        const mockOnOpenModal = vi.fn();

        render(ArticleCard, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: 'fa6-solid:heart',
                onOpenModal: mockOnOpenModal
            }
        });

        const button = screen.getByRole('button');
        await fireEvent.keyDown(button, { key: 'Tab' });
        await fireEvent.keyDown(button, { key: 'ArrowDown' });

        expect(mockOnOpenModal).not.toHaveBeenCalled();
    });

    it('handles empty content gracefully', () => {
        const mockOnOpenModal = vi.fn();

        render(ArticleCard, {
            props: {
                title: 'Unknown Article',
                description: 'Test description',
                icon: 'fa6-solid:heart',
                onOpenModal: mockOnOpenModal
            }
        });

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
    });
});
