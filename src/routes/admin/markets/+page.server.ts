import { fail, redirect } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import { marketWatchlist } from '$lib/server/db/schema';
import { marketCreateSchema } from '$lib/schemas';
import { getSupportedMarkets, unconfiguredSupportedMarkets } from '$lib/server/markets';
import type { Actions, PageServerLoad } from './$types';

async function nextSortOrder(): Promise<number> {
	const [last] = await db
		.select({ sortOrder: marketWatchlist.sortOrder })
		.from(marketWatchlist)
		.orderBy(desc(marketWatchlist.sortOrder))
		.limit(1);
	return (last?.sortOrder ?? -1) + 1;
}

export const load: PageServerLoad = async () => {
	const [configured, supportedMarkets] = await Promise.all([
		db.select().from(marketWatchlist),
		getSupportedMarkets()
	]);
	const availableMarkets = unconfiguredSupportedMarkets(configured, supportedMarkets);

	return {
		form: await superValidate(zod4(marketCreateSchema)),
		availableMarkets
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const form = await superValidate(request, zod4(marketCreateSchema));
		if (!form.valid) return fail(400, { form });

		const [configured, supportedMarkets] = await Promise.all([
			db.select().from(marketWatchlist),
			getSupportedMarkets()
		]);
		const availableMarkets = unconfiguredSupportedMarkets(configured, supportedMarkets);
		const selected = availableMarkets.find(
			(market) => market.id === Number.parseInt(form.data.supportedMarketId, 10)
		);
		if (!selected) {
			return fail(400, { form, marketUnavailable: true });
		}

		await db.insert(marketWatchlist).values({
			supportedMarketId: selected.id,
			hidden: form.data.hidden,
			sortOrder: await nextSortOrder()
		});

		redirect(303, '/admin?tab=markets');
	}
};
