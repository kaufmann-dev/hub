import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../routes/admin/api/reorder/+server';

const mock = vi.hoisted(() => {
	const state = {
		currentIds: [] as number[],
		updates: [] as Array<{ sortOrder: number }>
	};

	let db: {
		select: ReturnType<typeof vi.fn>;
		transaction: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};

	db = {
		select: vi.fn(() => ({
			from: vi.fn(async () => state.currentIds.map((id) => ({ id })))
		})),
		transaction: vi.fn(async (callback: (tx: typeof db) => Promise<void>) => {
			await callback(db);
		}),
		update: vi.fn(() => ({
			set: vi.fn((values: { sortOrder: number }) => {
				state.updates.push(values);
				return { where: vi.fn(async () => undefined) };
			})
		}))
	};

	return { db, state };
});

vi.mock('$lib/server/db', () => ({ db: mock.db }));

function createEvent(body: unknown, isAdmin = true) {
	const request = new Request('https://example.com/admin/api/reorder', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});

	return {
		locals: { isAdmin },
		request
	} as Parameters<typeof POST>[0];
}

describe('POST /admin/api/reorder', () => {
	beforeEach(() => {
		mock.state.currentIds = [1, 2, 3];
		mock.state.updates = [];
		vi.clearAllMocks();
	});

	it('returns 403 for non-admin requests', async () => {
		const response = await POST(createEvent({ type: 'websites', ids: [1, 2, 3] }, false));

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
		expect(mock.db.select).not.toHaveBeenCalled();
	});

	it.each([
		['invalid type', { type: 'links', ids: [1, 2, 3] }],
		['duplicate ids', { type: 'websites', ids: [1, 1, 2] }],
		['missing ids', { type: 'websites' }],
		['ids not matching the selected table', { type: 'cities', ids: [1, 2, 4] }]
	])('returns 400 for %s', async (_name, body) => {
		const response = await POST(createEvent(body));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toHaveProperty('error');
		expect(mock.db.transaction).not.toHaveBeenCalled();
	});

	it('updates all rows in the submitted order', async () => {
		mock.state.currentIds = [4, 5, 6];

		const response = await POST(createEvent({ type: 'projects', ids: [6, 4, 5] }));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ success: true });
		expect(mock.db.transaction).toHaveBeenCalledTimes(1);
		expect(mock.db.update).toHaveBeenCalledTimes(3);
		expect(mock.state.updates).toEqual([{ sortOrder: 0 }, { sortOrder: 1 }, { sortOrder: 2 }]);
	});
});
