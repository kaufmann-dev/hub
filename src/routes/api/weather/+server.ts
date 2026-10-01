import type { RequestHandler } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { city } from '#lib/server/db/schema.js';
import { getWeather } from '#lib/server/weather.js';

/**
 * Current weather for every city, keyed by city id. Backs the homepage's live
 * weather refresh. `getWeather` is cached in-process (~15 min), so frequent
 * polling here does not hammer the upstream provider.
 */
export const GET: RequestHandler = async () => {
	const cities = await db.select().from(city).orderBy(asc(city.sortOrder), asc(city.name));
	const weather = await Promise.all(cities.map(async (c) => [c.id, await getWeather(c)] as const));

	return Response.json({ weatherByCity: Object.fromEntries(weather) });
};
