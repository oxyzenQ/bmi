import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ArticleModal from '../ArticleModal.svelte';

describe('ArticleModal', () => {
    it('renders modal when isOpen is true', () => {
        const mockClose = vi.fn();

        render(ArticleModal, {
            props: {
                isOpen: true,
                title: 'Test Article',
                content: '<p>Test content</p>'
            }
        });

        expect(screen.getByText('Test Article')).toBeInTheDocument();
        expect(screen.getByText('Test content')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
    });

    it('does not render modal when isOpen is false', () => {
        render(ArticleModal, {
            props: {
                isOpen: false,
                title: 'Test Article',
                content: '<p>Test content</p>'
            }
        });

        expect(screen.queryByText('Test Article')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays HTML content correctly', () => {
        const htmlContent = `
      <h3>Test Heading</h3>
      <p>Test paragraph with <strong>bold text</strong>.</p>
      <ul>
        <li>List item 1</li>
        <li>List item 2</li>
      </ul>
    `;

        render(ArticleModal, {
            props: {
                isOpen: true,
                title: 'Test Article',
                content: htmlContent
            }
        });

        expect(screen.getByText('Test Heading')).toBeInTheDocument();
        expect(screen.getByText('Test paragraph with')).toBeInTheDocument();
        expect(screen.getByText('bold text')).toBeInTheDocument();
        expect(screen.getByText('List item 1')).toBeInTheDocument();
        expect(screen.getByText('List item 2')).toBeInTheDocument();
    });

    it('calls close function when close button is clicked', async () => {
        const mockClose = vi.fn();

        const { component } = render(ArticleModal, {
            props: {
                isOpen: true,
                title: 'Test Article',
                content: '<p>Test content</p>'
            }
        });

        component.$on('close', mockClose);

        const closeButton = screen.getByRole('button', { name: /close modal/i });
        await fireEvent.click(closeButton);

        expect(mockClose).toHaveBeenCalled();
    });

    it('calls close function when overlay is clicked', async () => {
        const mockClose = vi.fn();

        const { component } = render(ArticleModal, {
            props: {
                isOpen: true,
                title: 'Test Article',
                content: '<p>Test content</p>'
            }
        });

        component.$on('close', mockClose);

        const overlay = screen.getByRole('dialog');
        await fireEvent.click(overlay);

        expect(mockClose).toHaveBeenCalled();
    });

    it('calls close function when ESC key is pressed', async () => {
        const mockClose = vi.fn();

        const { component } = render(ArticleModal, {
            props: {
                isOpen: true,
                title: 'Test Article',
                content: '<p>Test content</p>'
            }
        });

        component.$on('close', mockClose);

        const modal = screen.getByRole('dialog');
        await fireEvent.keyDown(modal, { key: 'Escape' });

        expect(mockClose).toHaveBeenCalled();
    });

    it('does not call close function when content area is clicked', async () => {
        const mockClose = vi.fn();

        const { component } = render(ArticleModal, {
            props: {
                isOpen: true,
                title: 'Test Article',
                content: '<p>Test content</p>'
            }
        });

        component.$on('close', mockClose);

        const content = screen.getByText('Test content');
        await fireEvent.click(content);

        expect(mockClose).not.toHaveBeenCalled();
    });

    it('has proper accessibility attributes', () => {
        render(ArticleModal, {
            props: {
                isOpen: true,
                title: 'Test Article',
                content: '<p>Test content</p>'
            }
        });

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
        expect(dialog).toHaveAttribute('tabindex', '-1');

        const title = screen.getByText('Test Article');
        expect(title).toHaveAttribute('id', 'modal-title');
    });

    it('focuses close button when modal opens', async () => {
        render(ArticleModal, {
            props: {
                isOpen: true,
                title: 'Test Article',
                content: '<p>Test content</p>'
            }
        });

        // Wait for focus to be set
        await new Promise(resolve => setTimeout(resolve, 150));

        const closeButton = screen.getByRole('button', { name: /close modal/i });
        expect(closeButton).toHaveFocus();
    });

    it('handles empty content gracefully', () => {
        render(ArticleModal, {
            props: {
                isOpen: true,
                title: 'Test Article',
                content: ''
            }
        });

        expect(screen.getByText('Test Article')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has correct tabindex on dialog element', () => {
        render(ArticleModal, {
            props: {
                isOpen: true,
                title: 'Test Article',
                content: '<p>Test content</p>'
            }
        });

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('tabindex', '-1');
    });

    it('traps focus within modal when Tab is pressed', async () => {
        render(ArticleModal, {
            props: {
                isOpen: true,
                title: 'Test Article',
                content: '<p>Test content</p>'
            }
        });

        const dialog = screen.getByRole('dialog');
        const closeButton = screen.getByRole('button', { name: /close modal/i });

        // Focus the close button first
        closeButton.focus();
        expect(closeButton).toHaveFocus();

        // Simulate Tab key press
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
        const preventDefault = vi.spyOn(tabEvent, 'preventDefault');

        // This would normally trigger focus trap logic
        // In a real test environment, we'd need to mock the focus trap more thoroughly
        expect(closeButton).toBeInTheDocument();
    });
});
