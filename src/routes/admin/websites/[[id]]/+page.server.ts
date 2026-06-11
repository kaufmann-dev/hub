import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import { website } from '$lib/server/db/schema';
import { websiteSchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

function parseId(raw: string | undefined): number | null {
	if (raw === undefined) return null;
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) return null;
	return id;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id === undefined ? null : parseId(params.id);
	if (params.id !== undefined && id === null) error(404, 'Not found');

	if (id === null) {
		return { form: await superValidate(zod4(websiteSchema)), isEdit: false };
	}

	const [row] = await db.select().from(website).where(eq(website.id, id));
	if (!row) error(404, 'Website not found');

	const form = await superValidate(
		{
			title: row.title,
			url: row.url,
			description: row.description ?? undefined,
			iconUrl: row.iconUrl ?? undefined,
			kind: row.kind as 'personal' | 'third_party',

			sortOrder: row.sortOrder
		},
		zod4(websiteSchema)
	);
	return { form, isEdit: true };
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const form = await superValidate(request, zod4(websiteSchema));
		if (!form.valid) return fail(400, { form });

		const id = parseId(params.id);
		const values = {
			title: form.data.title,
			url: form.data.url,
			description: form.data.description ?? null,
			iconUrl: form.data.iconUrl ?? null,
			kind: form.data.kind,

			sortOrder: form.data.sortOrder
		};

		if (id === null) {
			await db.insert(website).values(values);
		} else {
			await db
				.update(website)
				.set({ ...values, updatedAt: new Date() })
				.where(eq(website.id, id));
		}

		redirect(303, '/admin');
	}
};
