import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import { marketWatchlist, supportedMarket } from '$lib/server/db/schema';
import { marketWatchlistSchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

function parseId(raw: string): number | null {
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = parseId(params.id);
	if (id === null) error(404, 'Not found');

	const [row] = await db
		.select({ watchlist: marketWatchlist, market: supportedMarket })
		.from(marketWatchlist)
		.innerJoin(supportedMarket, eq(marketWatchlist.supportedMarketId, supportedMarket.id))
		.where(eq(marketWatchlist.id, id));
	if (!row) error(404, 'Market not found');

	const form = await superValidate(
		{
			hidden: row.watchlist.hidden
		},
		zod4(marketWatchlistSchema)
	);
	return { form, market: { ...row.watchlist, market: row.market } };
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const id = parseId(params.id);
		if (id === null) return fail(400);

		const form = await superValidate(request, zod4(marketWatchlistSchema));
		if (!form.valid) return fail(400, { form });

		await db
			.update(marketWatchlist)
			.set({
				hidden: form.data.hidden,
				updatedAt: new Date()
			})
			.where(eq(marketWatchlist.id, id));

		redirect(303, '/admin?tab=markets');
	}
};
