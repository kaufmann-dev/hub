import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWeather } from './weather';

describe('getWeather', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('fetches and maps current weather for a city', async () => {
		const fetchMock = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => {
			return new Response(
				JSON.stringify({
					current: {
						temperature_2m: 21.6,
						weather_code: 0
					},
					current_units: {
						temperature_2m: '°C'
					}
				})
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await getWeather({
			id: 1001,
			latitude: 48.2082,
			longitude: 16.3738
		});

		expect(result).toEqual({
			temperature: 22,
			unit: '°C',
			label: 'Clear',
			icon: 'sun'
		});
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url] = fetchMock.mock.calls[0];
		expect(url).toBeInstanceOf(URL);
		const requestUrl = url as URL;
		expect(requestUrl.searchParams.get('latitude')).toBe('48.2082');
		expect(requestUrl.searchParams.get('longitude')).toBe('16.3738');
	});
});
