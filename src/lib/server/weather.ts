import type { City } from './db/schema';
import { weatherCodeToInfo, type WeatherIconKey } from '$lib/weather-codes';

export interface CityWeather {
	temperature: number;
	unit: string;
	label: string;
	icon: WeatherIconKey;
}

interface CacheEntry {
	at: number;
	value: CityWeather | null;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const cache = new Map<number, CacheEntry>();

/**
 * Current weather for a city from Open-Meteo (no API key). Cached in-process for
 * ~15 minutes per city. Best-effort: returns null on any failure so the UI can
 * simply omit the weather.
 */
export async function getWeather(
	c: Pick<City, 'id' | 'latitude' | 'longitude'>
): Promise<CityWeather | null> {
	const cached = cache.get(c.id);
	if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

	let value: CityWeather | null = null;
	try {
		const url = new URL('https://api.open-meteo.com/v1/forecast');
		url.searchParams.set('latitude', String(c.latitude));
		url.searchParams.set('longitude', String(c.longitude));
		url.searchParams.set('current', 'temperature_2m,weather_code');
		url.searchParams.set('timezone', 'auto');

		const res = await fetch(url);
		if (res.ok) {
			const data = (await res.json()) as {
				current?: { temperature_2m?: number; weather_code?: number };
				current_units?: { temperature_2m?: string };
			};
			const temp = data.current?.temperature_2m;
			const code = data.current?.weather_code;
			if (typeof temp === 'number' && typeof code === 'number') {
				const info = weatherCodeToInfo(code);
				value = {
					temperature: Math.round(temp),
					unit: data.current_units?.temperature_2m ?? '°C',
					label: info.label,
					icon: info.icon
				};
			}
		} else {
			console.error(`Weather fetch failed for city ${c.id}: ${res.status}`);
		}
	} catch (err) {
		console.error(`Weather fetch error for city ${c.id}:`, err);
	}

	cache.set(c.id, { at: Date.now(), value });
	return value;
}
