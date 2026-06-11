import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { city, githubProject, website } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const websiteKindSchema = z.enum(['personal', 'third_party']);
const idsSchema = z.array(z.number().int().positive());

const reorderSchema = z
	.discriminatedUnion('type', [
		z
			.object({
				type: z.literal('websites'),
				ids: idsSchema,
				kindById: z.record(z.string(), websiteKindSchema)
			})
			.strict(),
		z
			.object({
				type: z.literal('projects'),
				ids: idsSchema,
				hiddenById: z.record(z.string(), z.boolean())
			})
			.strict(),
		z
			.object({
				type: z.literal('cities'),
				ids: idsSchema
			})
			.strict()
	])
	.superRefine((data, ctx) => {
		const { ids } = data;
		if (new Set(ids).size !== ids.length) {
			ctx.addIssue({
				code: 'custom',
				path: ['ids'],
				message: 'IDs must be unique'
			});
		}

		if (data.type === 'websites' && !sameIdKeys(data.kindById, ids)) {
			ctx.addIssue({
				code: 'custom',
				path: ['kindById'],
				message: 'Website kinds must match submitted IDs'
			});
		}

		if (data.type === 'projects' && !sameIdKeys(data.hiddenById, ids)) {
			ctx.addIssue({
				code: 'custom',
				path: ['hiddenById'],
				message: 'Project visibility values must match submitted IDs'
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

function sameIdKeys(valuesById: Record<string, unknown>, ids: number[]): boolean {
	const keys = Object.keys(valuesById);
	if (keys.length !== ids.length) return false;
	const idKeys = new Set(ids.map(String));
	return keys.every((key) => idKeys.has(key));
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
			if (parsed.data.type === 'websites') {
				await tx
					.update(website)
					.set({ sortOrder, kind: parsed.data.kindById[String(id)] })
					.where(eq(website.id, id));
				continue;
			}

			if (parsed.data.type === 'projects') {
				await tx
					.update(githubProject)
					.set({ sortOrder, hidden: parsed.data.hiddenById[String(id)] })
					.where(eq(githubProject.id, id));
				continue;
			}

			await setSortOrder(tx, type, id, sortOrder);
		}
	});

	return json({ success: true });
};
