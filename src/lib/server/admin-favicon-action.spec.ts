import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
	refreshAllWebsiteFavicons: vi.fn()
}));

vi.mock('$lib/server/favicon', () => ({
	refreshAllWebsiteFavicons: mock.refreshAllWebsiteFavicons
}));

vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/github', () => ({ syncGithubProjects: vi.fn() }));

const { actions } = await import('../../routes/admin/+page.server');

describe('admin favicon refresh action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mock.refreshAllWebsiteFavicons.mockResolvedValue({ refreshed: 3, failed: 1 });
	});

	it('returns 403 for non-admin requests', async () => {
		const result = await actions.refreshFavicons({ locals: { isAdmin: false } } as never);

		expect(result).toMatchObject({ status: 403 });
		expect(mock.refreshAllWebsiteFavicons).not.toHaveBeenCalled();
	});

	it('returns refresh counts for admins', async () => {
		const result = await actions.refreshFavicons({ locals: { isAdmin: true } } as never);

		expect(result).toEqual({ success: true, refreshed: 3, failed: 1 });
		expect(mock.refreshAllWebsiteFavicons).toHaveBeenCalledTimes(1);
	});
});
