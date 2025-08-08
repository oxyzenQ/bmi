import '@testing-library/jest-dom';

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
