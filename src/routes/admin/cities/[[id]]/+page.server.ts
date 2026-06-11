import { error, fail, redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import { city } from '$lib/server/db/schema';
import { citySchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

function parseId(raw: string | undefined): number | null {
	if (raw === undefined) return null;
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) return null;
	return id;
}

async function nextSortOrder(): Promise<number> {
	const [last] = await db
		.select({ sortOrder: city.sortOrder })
		.from(city)
		.orderBy(desc(city.sortOrder))
		.limit(1);
	return (last?.sortOrder ?? -1) + 1;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id === undefined ? null : parseId(params.id);
	if (params.id !== undefined && id === null) error(404, 'Not found');

	if (id === null) {
		return { form: await superValidate(zod4(citySchema)), isEdit: false };
	}

	const [row] = await db.select().from(city).where(eq(city.id, id));
	if (!row) error(404, 'City not found');

	const form = await superValidate(
		{
			name: row.name,
			timezone: row.timezone,
			latitude: row.latitude,
			longitude: row.longitude,
			sortOrder: row.sortOrder
		},
		zod4(citySchema)
	);
	return { form, isEdit: true };
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const form = await superValidate(request, zod4(citySchema));
		if (!form.valid) return fail(400, { form });

		const id = parseId(params.id);
		const values = {
			name: form.data.name,
			timezone: form.data.timezone,
			latitude: form.data.latitude,
			longitude: form.data.longitude
		};

		if (id === null) {
			await db.insert(city).values({ ...values, sortOrder: await nextSortOrder() });
		} else {
			await db.update(city).set(values).where(eq(city.id, id));
		}

		redirect(303, '/admin?tab=cities');
	}
};
