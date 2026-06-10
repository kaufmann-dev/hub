import { fail, redirect } from '@sveltejs/kit';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { website, githubProject, city } from '$lib/server/db/schema';
import { syncGithubProjects } from '$lib/server/github';
import { SESSION_COOKIE } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [websites, projects, cities] = await Promise.all([
		db.select().from(website).orderBy(asc(website.sortOrder), asc(website.title)),
		db
			.select()
			.from(githubProject)
			.orderBy(asc(githubProject.sortOrder), desc(githubProject.stars)),
		db.select().from(city).orderBy(asc(city.sortOrder), asc(city.name))
	]);
	return { websites, projects, cities };
};

function idFrom(form: FormData): number | null {
	const id = Number(form.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
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

	toggleProjectHidden: async ({ request, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400);
		const hidden = form.get('hidden') === 'true';
		await db.update(githubProject).set({ hidden }).where(eq(githubProject.id, id));
		return { success: true };
	},

	syncNow: async ({ locals }) => {
		if (!locals.isAdmin) return fail(403);
		const count = await syncGithubProjects();
		return { success: true, synced: count };
	},

	logout: async ({ cookies, locals }) => {
		if (!locals.isAdmin) return fail(403);
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/');
	}
};
