import { asc, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { website, githubProject, city } from '$lib/server/db/schema';
import { getWeather } from '$lib/server/weather';
import { syncIfStale } from '$lib/server/github';
import type { PageServerLoad } from './$types';

const PROJECTS_MAX_AGE_MS = 6 * 60 * 60 * 1000; // re-sync if older than 6h

export const load: PageServerLoad = async () => {
	// Best-effort background refresh of GitHub projects; never blocks the response.
	void syncIfStale(PROJECTS_MAX_AGE_MS);

	const [websites, projects, cities] = await Promise.all([
		db.select().from(website).orderBy(asc(website.sortOrder), asc(website.title)),
		db
			.select()
			.from(githubProject)
			.where(eq(githubProject.hidden, false))
			.orderBy(asc(githubProject.sortOrder), desc(githubProject.stars), asc(githubProject.id)),
		db.select().from(city).orderBy(asc(city.sortOrder), asc(city.name))
	]);

	const weather = await Promise.all(
		cities.map(async (c) => ({ cityId: c.id, weather: await getWeather(c) }))
	);
	const weatherByCity = Object.fromEntries(weather.map((w) => [w.cityId, w.weather]));

	return { websites, projects, cities, weatherByCity };
};
