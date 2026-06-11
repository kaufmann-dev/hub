import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../routes/admin/api/city-search/+server';

function createEvent(path: string, isAdmin: boolean) {
	return {
		locals: { isAdmin },
		url: new URL(path, 'https://example.com')
	} as Parameters<typeof GET>[0];
}

function jsonResponse(body: unknown) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

describe('GET /admin/api/city-search', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns 403 for non-admin requests', async () => {
		const response = await GET(createEvent('/admin/api/city-search?q=Vienna', false));

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
	});

	it('returns an empty suggestion list for too-short queries', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const response = await GET(createEvent('/admin/api/city-search?q=v', true));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ suggestions: [] });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns normalized suggestion JSON for a normal query', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				jsonResponse({
					results: [
						{
							id: 2761369,
							name: 'Vienna',
							country: 'Austria',
							admin1: 'Vienna',
							timezone: 'Europe/Vienna',
							latitude: 48.2085,
							longitude: 16.3721
						}
					]
				})
			)
		);

		const response = await GET(createEvent('/admin/api/city-search?q=Vienna', true));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			suggestions: [
				{
					id: 2761369,
					name: 'Vienna',
					country: 'Austria',
					admin1: 'Vienna',
					timezone: 'Europe/Vienna',
					latitude: 48.2085,
					longitude: 16.3721,
					label: 'Vienna, Austria'
				}
			]
		});
	});
});
