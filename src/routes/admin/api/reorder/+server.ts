import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { city, githubProject, website } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const reorderSchema = z
	.object({
		type: z.enum(['websites', 'projects', 'cities']),
		ids: z.array(z.number().int().positive())
	})
	.strict()
	.superRefine(({ ids }, ctx) => {
		if (new Set(ids).size !== ids.length) {
			ctx.addIssue({
				code: 'custom',
				path: ['ids'],
				message: 'IDs must be unique'
			});
		}
	});

type ReorderType = z.infer<typeof reorderSchema>['type'];
type SortOrderClient = Pick<typeof db, 'update'>;

function sameIdSet(submitted: number[], current: number[]): boolean {
	if (submitted.length !== current.length) return false;
	const submittedIds = new Set(submitted);
	return current.every((id) => submittedIds.has(id));
}

async function currentIdsFor(type: ReorderType): Promise<number[]> {
	if (type === 'websites') {
		const rows = await db.select({ id: website.id }).from(website);
		return rows.map((row) => row.id);
	}

	if (type === 'projects') {
		const rows = await db.select({ id: githubProject.id }).from(githubProject);
		return rows.map((row) => row.id);
	}

	const rows = await db.select({ id: city.id }).from(city);
	return rows.map((row) => row.id);
}

async function setSortOrder(
	tx: SortOrderClient,
	type: ReorderType,
	id: number,
	sortOrder: number
): Promise<void> {
	if (type === 'websites') {
		await tx.update(website).set({ sortOrder }).where(eq(website.id, id));
		return;
	}

	if (type === 'projects') {
		await tx.update(githubProject).set({ sortOrder }).where(eq(githubProject.id, id));
		return;
	}

	await tx.update(city).set({ sortOrder }).where(eq(city.id, id));
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.isAdmin) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const parsed = reorderSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: 'Invalid reorder request' }, { status: 400 });
	}

	const { type, ids } = parsed.data;
	const currentIds = await currentIdsFor(type);
	if (!sameIdSet(ids, currentIds)) {
		return json({ error: 'Submitted ids do not match current rows' }, { status: 400 });
	}

	await db.transaction(async (tx) => {
		for (const [sortOrder, id] of ids.entries()) {
			await setSortOrder(tx, type, id, sortOrder);
		}
	});

	return json({ success: true });
};
