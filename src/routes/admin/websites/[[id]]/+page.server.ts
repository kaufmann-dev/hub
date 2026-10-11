import { error, fail, redirect } from '@sveltejs/kit';
import { desc, eq, sql } from 'drizzle-orm';
import { superValidate, setError, withFiles } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { db } from '#lib/server/db/index.js';
import {
	website,
	websiteFavicon,
	websiteHealth,
	websiteIconOverride
} from '#lib/server/db/schema.js';
import { websiteIconSchema, websiteSchema } from '#lib/schemas.js';
import { refreshWebsiteFavicon } from '#lib/server/favicon.js';
import {
	iconVersion,
	readIconUpload,
	removeIconOverride,
	saveIconOverride
} from '#lib/server/icon-override.js';
import type { Actions, PageServerLoad } from './$types';

function parseId(raw: string | undefined): number | null {
	if (raw === undefined) return null;
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) return null;
	return id;
}

async function nextSortOrder(): Promise<number> {
	const [last] = await db
		.select({ sortOrder: website.sortOrder })
		.from(website)
		.orderBy(desc(website.sortOrder))
		.limit(1);
	return (last?.sortOrder ?? -1) + 1;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id === undefined ? null : parseId(params.id);
	if (params.id !== undefined && id === null) error(404, 'Not found');

	if (id === null) {
		return { form: await superValidate(zod4(websiteSchema)), isEdit: false as const };
	}

	const [found] = await db
		.select({
			row: website,
			iconVersion,
			hasIconOverride: sql<boolean>`${websiteIconOverride.websiteId} is not null`
		})
		.from(website)
		.leftJoin(websiteFavicon, eq(website.id, websiteFavicon.websiteId))
		.leftJoin(websiteIconOverride, eq(website.id, websiteIconOverride.websiteId))
		.where(eq(website.id, id));
	if (!found) error(404, 'Website not found');
	const { row } = found;

	const form = await superValidate(
		{
			title: row.title,
			url: row.url,
			description: row.description ?? undefined,
			kind: row.kind as 'personal' | 'third_party',

			sortOrder: row.sortOrder
		},
		zod4(websiteSchema)
	);
	return {
		form,
		iconForm: await superValidate(zod4(websiteIconSchema), { id: 'icon' }),
		isEdit: true as const,
		websiteId: id,
		iconVersion: found.iconVersion,
		hasIconOverride: found.hasIconOverride
	};
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const form = await superValidate(request, zod4(websiteSchema));
		if (!form.valid) return fail(400, { form });

		const id = parseId(params.id);
		const values = {
			title: form.data.title,
			url: form.data.url,
			description: form.data.description ?? null,
			kind: form.data.kind
		};

		if (id === null) {
			const [created] = await db
				.insert(website)
				.values({ ...values, sortOrder: await nextSortOrder() })
				.returning({ id: website.id });
			await refreshWebsiteFavicon(created.id, values.url);
		} else {
			const [existing] = await db
				.select({ url: website.url })
				.from(website)
				.where(eq(website.id, id));
			if (!existing) error(404, 'Website not found');
			if (existing.url !== values.url) {
				await db.transaction(async (tx) => {
					await tx
						.update(website)
						.set({ ...values, updatedAt: new Date() })
						.where(eq(website.id, id));
					await tx.delete(websiteHealth).where(eq(websiteHealth.websiteId, id));
				});
				await refreshWebsiteFavicon(id, values.url);
			} else {
				await db
					.update(website)
					.set({ ...values, updatedAt: new Date() })
					.where(eq(website.id, id));
			}
		}

		redirect(303, '/admin?tab=websites');
	},

	icon: async ({ request, params, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const id = parseId(params.id);
		if (id === null) error(404, 'Website not found');
		const form = await superValidate(request, zod4(websiteIconSchema), { id: 'icon' });
		if (!form.valid) return fail(400, withFiles({ form }));

		const icon = await readIconUpload(form.data.icon);
		if (!icon) return setError(form, 'icon', 'Unsupported image file');
		const darkIcon = form.data.darkIcon ? await readIconUpload(form.data.darkIcon) : null;
		if (form.data.darkIcon && !darkIcon) {
			return setError(form, 'darkIcon', 'Unsupported image file');
		}

		const [existing] = await db.select({ id: website.id }).from(website).where(eq(website.id, id));
		if (!existing) error(404, 'Website not found');
		await saveIconOverride(id, icon, darkIcon);
		return withFiles({ form });
	},

	removeIcon: async ({ params, locals }) => {
		if (!locals.isAdmin) return fail(403);
		const id = parseId(params.id);
		if (id === null) error(404, 'Website not found');
		await removeIconOverride(id);
	}
};
