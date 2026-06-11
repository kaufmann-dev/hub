import { describe, expect, it, vi } from 'vitest';
import { GeocodingError, searchCities } from './geocoding';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
		...init
	});
}

describe('searchCities', () => {
	it('normalizes valid Open-Meteo results', async () => {
		const fetchMock = vi.fn(async () =>
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
		);

		const results = await searchCities(' Vienna ', fetchMock);

		expect(results).toEqual([
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
		]);
		expect(fetchMock).toHaveBeenCalledOnce();
		const [[url]] = fetchMock.mock.calls as unknown as [[URL]];
		expect(url).toBeInstanceOf(URL);
		expect(url.searchParams.get('name')).toBe('Vienna');
		expect(url.searchParams.get('count')).toBe('8');
		expect(url.searchParams.get('language')).toBe('en');
		expect(url.searchParams.get('format')).toBe('json');
	});

	it('filters malformed results missing coordinates or timezone', async () => {
		const fetchMock = vi.fn(async () =>
			jsonResponse({
				results: [
					{
						id: 1,
						name: 'Valid City',
						country: 'Austria',
						timezone: 'Europe/Vienna',
						latitude: 47,
						longitude: 15
					},
					{
						id: 2,
						name: 'No Timezone',
						country: 'Austria',
						latitude: 47,
						longitude: 15
					},
					{
						id: 3,
						name: 'No Coordinates',
						country: 'Austria',
						timezone: 'Europe/Vienna'
					}
				]
			})
		);

		const results = await searchCities('valid', fetchMock);

		expect(results).toHaveLength(1);
		expect(results[0]?.name).toBe('Valid City');
	});

	it('returns an empty list when the upstream response has no results', async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ generationtime_ms: 0.2 }));

		await expect(searchCities('xy', fetchMock)).resolves.toEqual([]);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('returns an empty list for short queries without fetching', async () => {
		const fetchMock = vi.fn();

		await expect(searchCities(' v ', fetchMock)).resolves.toEqual([]);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('surfaces upstream failures as GeocodingError', async () => {
		const fetchMock = vi.fn(async () => jsonResponse({}, { status: 503 }));

		await expect(searchCities('Vienna', fetchMock)).rejects.toBeInstanceOf(GeocodingError);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('surfaces network failures as GeocodingError', async () => {
		const fetchMock = vi.fn(async () => {
			throw new Error('network down');
		});

		await expect(searchCities('Vienna', fetchMock)).rejects.toBeInstanceOf(GeocodingError);
		expect(fetchMock).toHaveBeenCalledOnce();
	});
});
