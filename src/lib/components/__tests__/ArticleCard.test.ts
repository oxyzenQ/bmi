import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ArticleCard from '../ArticleCard.svelte';
import ArticleCardTestWrapper from './mocks/ArticleCardTestWrapper.svelte';
import { Heart } from 'lucide-svelte';

describe('ArticleCard', () => {
    it('renders article card with title and description', () => {
        render(ArticleCard, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: Heart
            }
        });

        expect(screen.getByText('Test Article')).toBeInTheDocument();
        expect(screen.getByText('Test description')).toBeInTheDocument();
        expect(screen.getByText('Read Full Article')).toBeInTheDocument();
    });

    it('dispatches openModal when clicked', async () => {
        const handler = vi.fn();

        render(ArticleCardTestWrapper, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: Heart,
                onCardOpen: handler
            }
        });

        const button = screen.getByRole('button');
        await fireEvent.click(button);

        expect(handler).toHaveBeenCalled();
        const evt = handler.mock.calls[0][0] as CustomEvent<{ title: string; description: string }>;
        expect(evt.detail.title).toBe('Test Article');
        expect(typeof evt.detail.description).toBe('string');
    });

    it('dispatches openModal when Enter key is pressed', async () => {
        const handler = vi.fn();

        render(ArticleCardTestWrapper, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: Heart,
                onCardOpen: handler
            }
        });

        const button = screen.getByRole('button');
        await fireEvent.keyDown(button, { key: 'Enter' });

        expect(handler).toHaveBeenCalled();
    });

    it('dispatches openModal when Space key is pressed', async () => {
        const handler = vi.fn();

        render(ArticleCardTestWrapper, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: Heart,
                onCardOpen: handler
            }
        });

        const button = screen.getByRole('button');
        await fireEvent.keyDown(button, { key: ' ' });

        expect(handler).toHaveBeenCalled();
    });

    it('prevents default behavior on Enter and Space keys', async () => {
        render(ArticleCard, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: Heart
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
        render(ArticleCard, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: Heart
            }
        });

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('type', 'button');
        expect(button).toHaveAttribute('aria-label', 'Read full article: Test Article');
    });

    it('does not dispatch openModal for other keys', async () => {
        const handler = vi.fn();

        render(ArticleCardTestWrapper, {
            props: {
                title: 'Test Article',
                description: 'Test description',
                icon: Heart,
                onCardOpen: handler
            }
        });

        const button = screen.getByRole('button');
        await fireEvent.keyDown(button, { key: 'Tab' });
        await fireEvent.keyDown(button, { key: 'ArrowDown' });

        expect(handler).not.toHaveBeenCalled();
    });

    it('handles empty content gracefully', () => {
        render(ArticleCard, {
            props: {
                title: 'Unknown Article',
                description: 'Test description',
                icon: Heart
            }
        });

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
    });
});
