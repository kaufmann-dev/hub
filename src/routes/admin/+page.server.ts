import { fail, redirect } from '@sveltejs/kit';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { website, githubProject, city, marketWatchlist } from '$lib/server/db/schema';
import { syncGithubProjects } from '$lib/server/github';
import { refreshAllWebsiteFavicons } from '$lib/server/favicon';
import { SESSION_COOKIE } from '$lib/server/auth';
import {
	getMarketStatuses,
	marketDisplayName,
	marketStatusKey,
	unconfiguredMarketStatuses
} from '$lib/server/markets';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [websites, projects, cities, markets, marketStatus] = await Promise.all([
		db.select().from(website).orderBy(asc(website.sortOrder), asc(website.title)),
		db
			.select()
			.from(githubProject)
			.orderBy(
				asc(githubProject.hidden),
				asc(githubProject.sortOrder),
				desc(githubProject.stars),
				asc(githubProject.id)
			),
		db.select().from(city).orderBy(asc(city.sortOrder), asc(city.name)),
		db
			.select()
			.from(marketWatchlist)
			.orderBy(asc(marketWatchlist.sortOrder), asc(marketWatchlist.displayName)),
		getMarketStatuses()
	]);
	const availableMarkets = unconfiguredMarketStatuses(markets, marketStatus.markets);
	return { websites, projects, cities, markets, availableMarkets, marketStatus };
};

function idFrom(form: FormData): number | null {
	const id = Number(form.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

async function nextMarketSortOrder(): Promise<number> {
	const [last] = await db
		.select({ sortOrder: marketWatchlist.sortOrder })
		.from(marketWatchlist)
		.orderBy(desc(marketWatchlist.sortOrder))
		.limit(1);
	return (last?.sortOrder ?? -1) + 1;
}

export const actions: Actions = {
	deleteWebsite: async ({ request, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const id = idFrom(await request.formData());
		if (!id) return fail(400);
		await db.delete(website).where(eq(website.id, id));
		return { success: true };
	},

	deleteCity: async ({ request, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const id = idFrom(await request.formData());
		if (!id) return fail(400);
		await db.delete(city).where(eq(city.id, id));
		return { success: true };
	},

	deleteMarket: async ({ request, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const id = idFrom(await request.formData());
		if (!id) return fail(400);
		await db.delete(marketWatchlist).where(eq(marketWatchlist.id, id));
		return { success: true };
	},

	toggleProjectHidden: async ({ request, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400);
		const hidden = form.get('hidden') === 'true';
		await db.update(githubProject).set({ hidden }).where(eq(githubProject.id, id));
		return { success: true };
	},

	toggleMarketHidden: async ({ request, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400);
		const hidden = form.get('hidden') === 'true';
		await db.update(marketWatchlist).set({ hidden }).where(eq(marketWatchlist.id, id));
		return { success: true };
	},

	importSupportedMarkets: async ({ locals }) => {
		if (!locals.isAdmin) return fail(403);
		const marketStatus = await getMarketStatuses();
		if (marketStatus.markets.length === 0) {
			return fail(502, { marketImportFailed: true, error: marketStatus.error });
		}

		const rows = await db.select().from(marketWatchlist);
		const existingKeys = new Set(rows.map((row) => marketStatusKey(row.marketType, row.region)));
		const missing = marketStatus.markets.filter(
			(status) => !existingKeys.has(marketStatusKey(status.marketType, status.region))
		);
		const startSortOrder = await nextMarketSortOrder();

		if (missing.length > 0) {
			await db.insert(marketWatchlist).values(
				missing.map((status, index) => ({
					marketType: status.marketType,
					region: status.region,
					displayName: marketDisplayName(status),
					sortOrder: startSortOrder + index
				}))
			);
		}

		return { success: true, imported: missing.length };
	},

	setAllProjectsHidden: async ({ request, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const form = await request.formData();
		const hidden = form.get('hidden') === 'true';
		await db.update(githubProject).set({ hidden });
		return { success: true };
	},

	syncNow: async ({ locals }) => {
		if (!locals.isAdmin) return fail(403);
		try {
			const count = await syncGithubProjects();
			return { success: true, synced: count };
		} catch (err) {
			console.error('GitHub sync error:', err);
			return fail(502, { syncFailed: true });
		}
	},

	refreshFavicons: async ({ locals }) => {
		if (!locals.isAdmin) return fail(403);
		const counts = await refreshAllWebsiteFavicons();
		return { success: true, ...counts };
	},

	logout: async ({ cookies, locals }) => {
		if (!locals.isAdmin) return fail(403);
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/');
	}
};
