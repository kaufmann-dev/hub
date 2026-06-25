import { asc, desc, eq, getTableColumns } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	website,
	websiteFavicon,
	githubProject,
	city,
	marketWatchlist
} from '$lib/server/db/schema';
import { getWeather } from '$lib/server/weather';
import { syncIfStale } from '$lib/server/github';
import { refreshStaleFavicons } from '$lib/server/favicon';
import { buildWatchedMarketStatuses, getMarketStatuses } from '$lib/server/markets';
import type { PageServerLoad } from './$types';

const PROJECTS_MAX_AGE_MS = 6 * 60 * 60 * 1000; // re-sync if older than 6h
const FAVICONS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async () => {
	// Best-effort background refresh of GitHub projects; never blocks the response.
	void syncIfStale(PROJECTS_MAX_AGE_MS);
	void refreshStaleFavicons(FAVICONS_MAX_AGE_MS).catch((err) =>
		console.error('Favicon stale-check error:', err)
	);

	const [websites, projects, cities, marketRows, marketStatus] = await Promise.all([
		db
			.select({ ...getTableColumns(website), faviconCheckedAt: websiteFavicon.checkedAt })
			.from(website)
			.leftJoin(websiteFavicon, eq(website.id, websiteFavicon.websiteId))
			.orderBy(asc(website.sortOrder), asc(website.title)),
		db
			.select()
			.from(githubProject)
			.where(eq(githubProject.hidden, false))
			.orderBy(asc(githubProject.sortOrder), desc(githubProject.stars), asc(githubProject.id)),
		db.select().from(city).orderBy(asc(city.sortOrder), asc(city.name)),
		db
			.select()
			.from(marketWatchlist)
			.where(eq(marketWatchlist.hidden, false))
			.orderBy(asc(marketWatchlist.sortOrder), asc(marketWatchlist.displayName)),
		getMarketStatuses()
	]);

	const weather = await Promise.all(
		cities.map(async (c) => ({ cityId: c.id, weather: await getWeather(c) }))
	);
	const weatherByCity = Object.fromEntries(weather.map((w) => [w.cityId, w.weather]));
	const markets = buildWatchedMarketStatuses(marketRows, marketStatus.markets);

	return {
		websites,
		projects,
		cities,
		weatherByCity,
		markets,
		marketStatusFetchedAt: marketStatus.fetchedAt,
		marketStatusStale: marketStatus.stale
	};
};
