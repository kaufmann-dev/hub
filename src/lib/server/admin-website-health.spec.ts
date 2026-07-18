import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
	const updateWhere = vi.fn(async () => undefined);
	const deleteWhere = vi.fn(async () => undefined);
	const tx = {
		update: vi.fn(() => ({
			set: vi.fn(() => ({ where: updateWhere }))
		})),
		delete: vi.fn(() => ({ where: deleteWhere }))
	};
	const db = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(async () => [{ url: 'https://old.example.com' }])
			}))
		})),
		transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx))
	};
	return { db, tx, updateWhere, deleteWhere, refreshWebsiteFavicon: vi.fn() };
});

vi.mock('$lib/server/db', () => ({ db: mock.db }));
vi.mock('$lib/server/favicon', () => ({ refreshWebsiteFavicon: mock.refreshWebsiteFavicon }));

const { actions } = await import('../../routes/admin/websites/[[id]]/+page.server');

describe('admin website health invalidation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mock.refreshWebsiteFavicon.mockResolvedValue(true);
	});

	it('updates the URL and clears its health cache in one transaction', async () => {
		const form = new FormData();
		form.set('title', 'Example');
		form.set('url', 'https://new.example.com');
		form.set('description', '');
		form.set('kind', 'personal');
		form.set('sortOrder', '0');

		await expect(
			actions.default({
				request: new Request('https://hub.example.com/admin/websites/1', {
					method: 'POST',
					body: form
				}),
				params: { id: '1' },
				locals: { isAdmin: true }
			} as never)
		).rejects.toMatchObject({ status: 303, location: '/admin?tab=websites' });

		expect(mock.db.transaction).toHaveBeenCalledOnce();
		expect(mock.tx.update).toHaveBeenCalledOnce();
		expect(mock.tx.delete).toHaveBeenCalledOnce();
		expect(mock.updateWhere).toHaveBeenCalledOnce();
		expect(mock.deleteWhere).toHaveBeenCalledOnce();
		expect(mock.refreshWebsiteFavicon).toHaveBeenCalledWith(1, 'https://new.example.com');
	});
});
