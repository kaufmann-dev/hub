import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '$lib/server/db';
import { githubProject } from '$lib/server/db/schema';
import { projectSchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

function parseId(raw: string): number | null {
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = parseId(params.id);
	if (id === null) error(404, 'Not found');

	const [row] = await db.select().from(githubProject).where(eq(githubProject.id, id));
	if (!row) error(404, 'Project not found');

	const form = await superValidate(
		{
			descriptionOverride: row.descriptionOverride ?? undefined,
			hidden: row.hidden,
			sortOrder: row.sortOrder
		},
		zod4(projectSchema)
	);
	return { form, project: row };
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const id = parseId(params.id);
		if (id === null) return fail(400);

		const form = await superValidate(request, zod4(projectSchema));
		if (!form.valid) return fail(400, { form });

		await db
			.update(githubProject)
			.set({
				descriptionOverride: form.data.descriptionOverride ?? null,
				hidden: form.data.hidden,
				sortOrder: form.data.sortOrder
			})
			.where(eq(githubProject.id, id));

		redirect(303, '/admin');
	}
};
