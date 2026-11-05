import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
	const set = vi.fn(async () => undefined);
	return { set, db: { update: vi.fn(() => ({ set })) } };
});

vi.mock('#lib/server/db/index.js', () => ({ db: mock.db }));
vi.mock('#lib/server/github.js', () => ({ syncGithubProjects: vi.fn() }));

const { actions } = await import('../../routes/admin/+page.server');

describe('admin project order reset action', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns 403 for non-admin requests', async () => {
		const result = await actions.resetProjectOrder({ locals: { isAdmin: false } } as never);

		expect(result).toMatchObject({ status: 403 });
		expect(mock.db.update).not.toHaveBeenCalled();
	});

	it('clears every manual project sort order for admins', async () => {
		const result = await actions.resetProjectOrder({ locals: { isAdmin: true } } as never);

		expect(result).toEqual({ success: true });
		expect(mock.set).toHaveBeenCalledWith({ sortOrder: 0 });
	});
});
