import { describe, expect, it } from 'vitest';
import { faviconUrls } from './favicon';

describe('faviconUrls', () => {
	it('uses distinct theme paths with a shared cache version', () => {
		expect(faviconUrls(42, '2026-06-13T10:00:00.000Z')).toEqual({
			light: '/websites/42/favicon/static/light?v=2026-06-13T10%3A00%3A00.000Z',
			dark: '/websites/42/favicon/static/dark?v=2026-06-13T10%3A00%3A00.000Z'
		});
	});

	it('omits the cache version when no timestamp exists', () => {
		expect(faviconUrls(42)).toEqual({
			light: '/websites/42/favicon/static/light',
			dark: '/websites/42/favicon/static/dark'
		});
	});
});
