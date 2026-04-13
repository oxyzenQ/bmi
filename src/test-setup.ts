import '@testing-library/jest-dom';
import { vi, beforeAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// Mock SvelteKit modules
vi.mock('$app/environment', () => ({
	browser: true,
	dev: false,
	building: false,
	version: 'test'
}));

vi.mock('$app/stores', () => ({
	page: { subscribe: vi.fn() },
	navigating: { subscribe: vi.fn() },
	updated: { subscribe: vi.fn() }
}));

// Setup jsdom environment
beforeAll(() => {
	if (typeof document === 'undefined') {
		throw new Error('jsdom environment not properly configured');
	}
});

// Cleanup after each test
afterEach(() => {
	cleanup();
});
